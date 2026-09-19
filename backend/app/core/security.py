from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.models.user import ADMIN_ROLE, User
from app.models.workspace import Workspace
from app.models.workspace_membership import WorkspaceMembership

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload: dict[str, Any] = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.InvalidTokenError as exc:
        raise credentials_exception from exc

    subject = payload.get("sub")
    if subject is None:
        raise credentials_exception

    return str(subject)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    email = decode_access_token(token)
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if not user.is_active:
        # Deactivated mid-session: cut the existing token off immediately
        # rather than letting it work until natural expiry.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account has been deactivated")

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != ADMIN_ROLE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def ensure_workspace_access(db: Session, user: User, workspace_id: int) -> Workspace:
    """404 if the workspace doesn't exist, 403 if the user can't access it.
    Admins bypass membership entirely; everyone else needs an explicit
    WorkspaceMembership row. Returns the Workspace so callers don't have to
    fetch it again."""
    workspace = db.get(Workspace, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    if user.role == ADMIN_ROLE:
        return workspace

    is_member = (
        db.execute(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == workspace_id,
                WorkspaceMembership.user_id == user.id,
            )
        ).scalar_one_or_none()
        is not None
    )
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this workspace"
        )
    return workspace
