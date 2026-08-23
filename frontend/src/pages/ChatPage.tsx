import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { askQuestion, ApiError, type ChatResponse } from "../api";
import { ChatIcon, FileIcon, SendIcon, SparkleIcon } from "../components/icons";

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
      <div className="page-header">
        <h1>Ask a question</h1>
        <p>Answers are grounded only in the documents your organization has uploaded.</p>
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Ask something about your uploaded documents..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={loading || !query.trim()}>
          {loading ? <span className="spinner" /> : <SendIcon width={16} height={16} />}
          {loading ? "Thinking" : "Ask"}
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      {result && (
        <div className="chat-result">
          <div className="chat-answer-label">
            <SparkleIcon width={14} height={14} />
            Answer
          </div>
          <p className="chat-answer">{result.answer}</p>

          {result.sources.length > 0 && (
            <div className="chat-sources">
              <h2>Sources</h2>
              {result.sources.map((source, index) => (
                <div className="source-card" key={index}>
                  <FileIcon width={16} height={16} />
                  <div>
                    <div className="source-card-meta">
                      {source.source} <span>· page {source.page}</span>
                    </div>
                    <div className="source-card-text">{source.text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!result && !loading && !error && (
        <div className="empty-state">
          <ChatIcon width={28} height={28} />
          <p>Ask a question to get started.</p>
        </div>
      )}
    </div>
  );
}
