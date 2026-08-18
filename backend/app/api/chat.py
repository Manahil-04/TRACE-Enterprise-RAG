from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.models.user import User
from app.schemas.chat import ChatRequest, ChatResponse, SourceChunk
from app.services.llm import generate_answer
from app.services.retrieval import retrieve

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, current_user: User = Depends(get_current_user)) -> ChatResponse:
    chunks = retrieve(request.query, k=request.k)
    answer = generate_answer(request.query, [c.text for c in chunks])
    sources = [SourceChunk(text=c.text, source=c.source, page=c.page) for c in chunks]

    return ChatResponse(answer=answer, sources=sources)
