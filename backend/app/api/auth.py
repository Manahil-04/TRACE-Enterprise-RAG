from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    verify_password,
)
from app.models.user import ADMIN_ROLE, DEFAULT_ROLE, User
from app.models.workspace import Workspace
from app.models.workspace_membership import WorkspaceMembership
from app.schemas.auth import Token, UserCreate, UserRead, UserRoleUpdate, UserSummary

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    existing = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    is_first_user = db.execute(select(func.count()).select_from(User)).scalar_one() == 0

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=ADMIN_ROLE if is_first_user else DEFAULT_ROLE,
    )
    db.add(user)
    db.flush()  # assign user.id before the membership row references it

    # Auto-enroll into the default workspace so nobody registers into a
    # workspace-less dead end; admins can add them to others afterward.
    default_workspace = db.execute(select(Workspace).where(Workspace.is_default.is_(True))).scalar_one_or_none()
    if default_workspace is not None:
        db.add(WorkspaceMembership(workspace_id=default_workspace.id, user_id=user.id))

    db.commit()
    db.refresh(user)

    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> Token:
    user = db.execute(select(User).where(User.email == form_data.username)).scalar_one_or_none()

    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password"
        )

    return Token(access_token=create_access_token(subject=user.email))


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.get("/users", response_model=list[UserSummary], dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)) -> list[User]:
    return list(db.execute(select(User).order_by(User.created_at.asc())).scalars())


@router.patch("/users/{user_id}/role", response_model=UserSummary)
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == current_user.id and payload.role != ADMIN_ROLE:
        remaining_admins = db.execute(
            select(func.count()).select_from(User).where(User.role == ADMIN_ROLE, User.id != user.id)
        ).scalar_one()
        if remaining_admins == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are the only admin - promote someone else first",
            )

    user.role = payload.role
    db.commit()
    db.refresh(user)
    return user
