from functools import lru_cache

import psycopg
from pgvector.psycopg import register_vector

from app.core.config import settings
from app.schemas.chunk import ChunkMetadata


class PgVectorStore:
    def __init__(self, database_url: str, dimension: int) -> None:
        self._conn = psycopg.connect(database_url, autocommit=True)
        self._conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        register_vector(self._conn)
        # Requires the `documents` table (Alembic-managed) to already exist -
        # run `alembic upgrade head` before the app's first boot.
        self._conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS chunks (
                id SERIAL PRIMARY KEY,
                text TEXT NOT NULL,
                source TEXT NOT NULL,
                page INTEGER NOT NULL,
                chunk_index INTEGER NOT NULL,
                embedding VECTOR({dimension}) NOT NULL,
                document_id INTEGER REFERENCES documents(id)
            )
            """
        )
        self._conn.execute(
            "CREATE INDEX IF NOT EXISTS chunks_embedding_idx "
            "ON chunks USING hnsw (embedding vector_cosine_ops)"
        )

    def add(self, chunks: list[ChunkMetadata], embeddings: list[list[float]]) -> None:
        if not chunks:
            return
        rows = [
            (chunk.text, chunk.source, chunk.page, chunk.chunk_index, chunk.document_id, embedding)
            for chunk, embedding in zip(chunks, embeddings, strict=True)
        ]
        with self._conn.cursor() as cursor:
            cursor.executemany(
                "INSERT INTO chunks (text, source, page, chunk_index, document_id, embedding) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                rows,
            )

    def search(self, query_embedding: list[float], k: int) -> list[ChunkMetadata]:
        with self._conn.cursor() as cursor:
            cursor.execute(
                "SELECT text, source, page, chunk_index, document_id FROM chunks "
                "ORDER BY embedding <=> %s LIMIT %s",
                (query_embedding, k),
            )
            rows = cursor.fetchall()
        return [
            ChunkMetadata(
                text=text, source=source, page=page, chunk_index=chunk_index, document_id=document_id
            )
            for text, source, page, chunk_index, document_id in rows
        ]

    def delete_by_document(self, document_id: int) -> None:
        self._conn.execute("DELETE FROM chunks WHERE document_id = %s", (document_id,))


@lru_cache(maxsize=1)
def get_vector_store() -> PgVectorStore:
    return PgVectorStore(database_url=settings.DATABASE_URL, dimension=settings.EMBEDDING_DIM)
