/** Best-effort decode of the JWT payload to surface the user's email in the header. Returns null on any failure - there is no /auth/me endpoint to fall back on. */
export function decodeJwtEmail(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const json = JSON.parse(atob(padded)) as Record<string, unknown>;
    if (typeof json.sub === "string") return json.sub;
    if (typeof json.email === "string") return json.email;
    return null;
  } catch {
    return null;
  }
}
