from app.services.providers.factory import get_llm_provider


def generate_answer(
    query: str, context_chunks: list[str], history: list[tuple[str, str]] | None = None
) -> str:
    return get_llm_provider().generate_answer(query, context_chunks, history)
