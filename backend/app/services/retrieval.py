from app.schemas.chunk import ChunkMetadata
from app.services.embedding import embed_texts
from app.services.vector_store import get_vector_store


def retrieve(query: str, k: int = 3) -> list[ChunkMetadata]:
    query_embedding = embed_texts([query])[0]
    return get_vector_store().search(query_embedding, k)
