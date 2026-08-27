def build_rag_prompt(
    query: str, context_chunks: list[str], history: list[tuple[str, str]] | None = None
) -> str:
    history_section = ""
    if history:
        turns = "\n\n".join(f"Q: {question}\nA: {answer}" for question, answer in history)
        history_section = f"""Recent conversation in this investigation, provided only so you can
resolve references like "it", "that service", or "the previous system" in the
current question - do not treat it as source material for the answer:
{turns}

"""

    context = "\n\n".join(f"[{i + 1}] {chunk}" for i, chunk in enumerate(context_chunks))
    return f"""Answer the question using ONLY the context below. Each context passage is numbered.
After any statement drawn from a passage, cite it inline with its bracketed number, e.g. [1].
Use multiple citations like [1][2] if a statement draws on more than one passage.
{history_section}
Context:
{context}

Question:
{query}

After your answer, on a new line write exactly "Continue exploring:" followed by up to 3 short,
natural follow-up questions this context could also answer, each on its own line starting with "- ".
Base them only on the context above, not general knowledge. If none fit well, omit this section entirely.
"""
