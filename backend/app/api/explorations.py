from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import ensure_workspace_access, get_current_user
from app.models.exploration import Exploration
from app.models.user import User
from app.schemas.exploration import ExplorationDetail, ExplorationRename, ExplorationSummary, MessageRead

router = APIRouter(prefix="/explorations", tags=["explorations"])


def _get_owned_exploration_or_404(db: Session, user: User, exploration_id: int) -> Exploration:
    exploration = db.get(Exploration, exploration_id)
    if exploration is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exploration not found")
    if exploration.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this exploration"
        )
    return exploration


@router.get("", response_model=list[ExplorationSummary])
def list_explorations(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ExplorationSummary]:
    ensure_workspace_access(db, current_user, workspace_id)
    explorations = (
        db.execute(
            select(Exploration)
            .where(Exploration.owner_id == current_user.id, Exploration.workspace_id == workspace_id)
            .order_by(Exploration.updated_at.desc())
        )
        .scalars()
        .all()
    )
    return [
        ExplorationSummary(
            id=e.id,
            title=e.title,
            workspace_id=e.workspace_id,
            created_at=e.created_at,
            updated_at=e.updated_at,
            message_count=len(e.messages),
        )
        for e in explorations
    ]


@router.get("/{exploration_id}", response_model=ExplorationDetail)
def get_exploration(
    exploration_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExplorationDetail:
    exploration = _get_owned_exploration_or_404(db, current_user, exploration_id)
    return ExplorationDetail(
        id=exploration.id,
        title=exploration.title,
        workspace_id=exploration.workspace_id,
        created_at=exploration.created_at,
        updated_at=exploration.updated_at,
        messages=[MessageRead.model_validate(m) for m in exploration.messages],
    )


@router.patch("/{exploration_id}", response_model=ExplorationSummary)
def rename_exploration(
    exploration_id: int,
    payload: ExplorationRename,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExplorationSummary:
    exploration = _get_owned_exploration_or_404(db, current_user, exploration_id)
    exploration.title = payload.title
    db.commit()
    db.refresh(exploration)
    return ExplorationSummary(
        id=exploration.id,
        title=exploration.title,
        workspace_id=exploration.workspace_id,
        created_at=exploration.created_at,
        updated_at=exploration.updated_at,
        message_count=len(exploration.messages),
    )


@router.delete("/{exploration_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exploration(
    exploration_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    exploration = _get_owned_exploration_or_404(db, current_user, exploration_id)
    db.delete(exploration)  # cascades to Message rows (ORM relationship)
    db.commit()
