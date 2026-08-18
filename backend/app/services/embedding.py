from app.services.providers.factory import get_embedding_provider


def embed_texts(texts: list[str]) -> list[list[float]]:
    return get_embedding_provider().embed_texts(texts)
