def build_rag_prompt(query: str, context_chunks: list[str]) -> str:
    context = "\n\n".join(context_chunks)
    return f"""Answer the question using ONLY the context below.

Context:
{context}

Question:
{query}
"""
