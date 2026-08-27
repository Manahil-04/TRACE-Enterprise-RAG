import { ApiError } from "../api";

export interface DisplayError {
  title: string;
  message: string;
  details?: string;
}

interface KnownMapping {
  match: (detail: string, status: number) => boolean;
  title: string;
  message: string;
}

const KNOWN_MAPPINGS: KnownMapping[] = [
  {
    match: (detail) => /no extractable text|no text found/i.test(detail),
    title: "Couldn't extract text",
    message: "We couldn't find readable text in this PDF. Scanned or image-only PDFs aren't supported - try one with selectable text.",
  },
  {
    match: (_detail, status) => status === 401,
    title: "Session expired",
    message: "Your session has expired. Please sign in again.",
  },
  {
    match: (_detail, status) => status === 0,
    title: "Connection lost",
    message: "We couldn't reach the server. Check your connection and try again.",
  },
  {
    match: (_detail, status) => status >= 500,
    title: "Something went wrong",
    message: "We couldn't complete that request. Please try again.",
  },
];

/** Maps a caught error to a human-facing {title, message}. The raw technical
 * detail is preserved separately for an optional "View details" disclosure -
 * never dumped into the UI directly.
 *
 * `fallbackTitle` covers ApiErrors that don't match a known technical pattern -
 * their `message` is already a human-readable backend detail (ownership /
 * validation messages, "Exploration not found", etc.), so it's shown as-is
 * under a contextual title rather than further paraphrased. */
export function mapError(err: unknown, fallbackTitle: string): DisplayError {
  if (err instanceof ApiError) {
    const known = KNOWN_MAPPINGS.find((m) => m.match(err.message, err.status));
    if (known) return { title: known.title, message: known.message, details: `HTTP ${err.status}: ${err.message}` };
    return { title: fallbackTitle, message: err.message, details: `HTTP ${err.status}` };
  }
  return {
    title: "Something went wrong",
    message: "Check your connection and try again.",
    details: err instanceof Error ? err.message : String(err),
  };
}
