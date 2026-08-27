import re

# Strips a leading question phrase ("How does", "What is", ...) so the
# remainder reads as a topic rather than a full question.
_LEADING_QUESTION_PHRASE = re.compile(
    r"^(how (does|do|is|are|can|to)|what(’s|'s| is| are| does| do)"
    r"|where (is|are|does|do)|which|who|when (does|do|is)|why (does|do|is)"
    r"|can you|could you|please)\s+",
    re.IGNORECASE,
)
_STOPWORDS = {"the", "a", "an", "our", "your", "of", "for", "in", "on", "to", "and", "or"}
_MAX_TITLE_WORDS = 4
_MAX_TITLE_LENGTH = 60


def derive_title(question: str) -> str:
    """Best-effort short topic title from a first question, e.g. "How does our
    authentication system work?" -> "Authentication System Work".

    No LLM call: the app has no general-purpose title/summarization utility,
    and adding one just for this would be more machinery than a V1 needs.
    """
    text = question.strip().rstrip("?!.").strip()
    if not text:
        return "New exploration"

    text = _LEADING_QUESTION_PHRASE.sub("", text, count=1)
    words = [w for w in text.split() if w.lower() not in _STOPWORDS] or text.split()
    title = " ".join(words[:_MAX_TITLE_WORDS]) or question.strip()

    title = title[0].upper() + title[1:] if title else title
    return title[:_MAX_TITLE_LENGTH]
