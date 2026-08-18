import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { askQuestion, ApiError, type ChatResponse } from "../api";

export function ChatPage() {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || !query.trim()) return;
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      setResult(await askQuestion(token, query));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>Ask a question</h1>
      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Ask something about your uploaded documents..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      {result && (
        <div className="chat-result">
          <p className="chat-answer">{result.answer}</p>
          {result.sources.length > 0 && (
            <div className="chat-sources">
              <h2>Sources</h2>
              <ul>
                {result.sources.map((source, index) => (
                  <li key={index}>
                    <strong>{source.source}</strong> (page {source.page}) - {source.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
