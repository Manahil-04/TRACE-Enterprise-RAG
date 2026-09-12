from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import ensure_workspace_access, get_current_user, require_admin
from app.models.document import Document
from app.models.exploration import Exploration
from app.models.user import ADMIN_ROLE, User
from app.models.workspace import Workspace
from app.models.workspace_membership import WorkspaceMembership
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceMemberAdd,
    WorkspaceMemberRead,
    WorkspaceRead,
    WorkspaceRename,
)
from app.services.storage import delete_document_file
from app.services.vector_store import get_vector_store

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def _to_read(db: Session, workspace: Workspace) -> WorkspaceRead:
    document_count = len(workspace.documents)
    member_count = len(workspace.memberships)
    return WorkspaceRead(
        id=workspace.id,
        name=workspace.name,
        is_default=workspace.is_default,
        created_at=workspace.created_at,
        updated_at=workspace.updated_at,
        document_count=document_count,
        member_count=member_count,
    )


@router.get("", response_model=list[WorkspaceRead])
def list_workspaces(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[WorkspaceRead]:
    if current_user.role == ADMIN_ROLE:
        workspaces = db.execute(select(Workspace).order_by(Workspace.name.asc())).scalars().all()
    else:
        workspaces = (
            db.execute(
                select(Workspace)
                .join(WorkspaceMembership)
                .where(WorkspaceMembership.user_id == current_user.id)
                .order_by(Workspace.name.asc())
            )
            .scalars()
            .all()
        )
    return [_to_read(db, w) for w in workspaces]


@router.post("", response_model=WorkspaceRead, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> WorkspaceRead:
    existing = db.execute(select(Workspace).where(Workspace.name == payload.name)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A workspace with this name already exists")

    workspace = Workspace(name=payload.name)
    db.add(workspace)
    db.flush()
    db.add(WorkspaceMembership(workspace_id=workspace.id, user_id=current_user.id))
    db.commit()
    db.refresh(workspace)
    return _to_read(db, workspace)


@router.patch("/{workspace_id}", response_model=WorkspaceRead)
def rename_workspace(
    workspace_id: int,
    payload: WorkspaceRename,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> WorkspaceRead:
    workspace = db.get(Workspace, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    existing = db.execute(
        select(Workspace).where(Workspace.name == payload.name, Workspace.id != workspace_id)
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A workspace with this name already exists")

    workspace.name = payload.name
    db.commit()
    db.refresh(workspace)
    return _to_read(db, workspace)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(
    workspace_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    workspace = db.get(Workspace, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    if workspace.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The default workspace can't be deleted - every new user is enrolled into it",
        )

    # Deleting a workspace deletes everything scoped to it. Chunks and stored
    # files aren't ORM-managed, so they're cleaned up explicitly, same pattern
    # as a single document delete - just looped across every document here.
    documents = db.execute(select(Document).where(Document.workspace_id == workspace_id)).scalars().all()
    for document in documents:
        get_vector_store().delete_by_document(document.id)
        delete_document_file(document.storage_path)
        db.delete(document)

    # Explorations cascade-delete their own messages (ORM relationship), so a
    # plain delete here is enough.
    explorations = db.execute(select(Exploration).where(Exploration.workspace_id == workspace_id)).scalars().all()
    for exploration in explorations:
        db.delete(exploration)

    db.delete(workspace)  # cascades WorkspaceMembership rows
    db.commit()


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberRead])
def list_workspace_members(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkspaceMemberRead]:
    ensure_workspace_access(db, current_user, workspace_id)
    rows = db.execute(
        select(User.id, User.email, User.role)
        .join(WorkspaceMembership, WorkspaceMembership.user_id == User.id)
        .where(WorkspaceMembership.workspace_id == workspace_id)
        .order_by(User.email.asc())
    ).all()
    return [WorkspaceMemberRead(user_id=row.id, email=row.email, role=row.role) for row in rows]


@router.post("/{workspace_id}/members", response_model=WorkspaceMemberRead, status_code=status.HTTP_201_CREATED)
def add_workspace_member(
    workspace_id: int,
    payload: WorkspaceMemberAdd,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> WorkspaceMemberRead:
    workspace = db.get(Workspace, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    user = db.get(User, payload.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing = db.execute(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id, WorkspaceMembership.user_id == payload.user_id
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is already a member")

    db.add(WorkspaceMembership(workspace_id=workspace_id, user_id=payload.user_id))
    db.commit()
    return WorkspaceMemberRead(user_id=user.id, email=user.email, role=user.role)


@router.delete("/{workspace_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_workspace_member(
    workspace_id: int,
    user_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    membership = db.execute(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id, WorkspaceMembership.user_id == user_id
        )
    ).scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")

    db.delete(membership)
    db.commit()
