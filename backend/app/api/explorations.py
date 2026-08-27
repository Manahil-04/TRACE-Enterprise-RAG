from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user
from app.models.exploration import Exploration
from app.models.user import User
from app.schemas.exploration import ExplorationDetail, ExplorationSummary, MessageRead

router = APIRouter(prefix="/explorations", tags=["explorations"])


@router.get("", response_model=list[ExplorationSummary])
def list_explorations(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ExplorationSummary]:
    explorations = (
        db.execute(
            select(Exploration)
            .where(Exploration.owner_id == current_user.id)
            .order_by(Exploration.updated_at.desc())
        )
        .scalars()
        .all()
    )
    return [
        ExplorationSummary(
            id=e.id,
            title=e.title,
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
    exploration = db.get(Exploration, exploration_id)
    if exploration is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exploration not found")
    if exploration.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this exploration"
        )

    return ExplorationDetail(
        id=exploration.id,
        title=exploration.title,
        created_at=exploration.created_at,
        updated_at=exploration.updated_at,
        messages=[MessageRead.model_validate(m) for m in exploration.messages],
    )
