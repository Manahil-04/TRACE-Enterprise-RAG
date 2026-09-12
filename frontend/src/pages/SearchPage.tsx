import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { searchDocuments, viewDocument, type SearchResult } from "../api";
import { mapError } from "../lib/errorMessages";
import { DocumentsIcon, EyeIcon, SearchIcon } from "../components/icons";
import { Notice } from "../components/Notice";

export function SearchPage() {
  const { token } = useAuth();
  const { activeWorkspaceId } = useWorkspace();

  const [queryInput, setQueryInput] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ReturnType<typeof mapError> | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const query = queryInput.trim();
    if (!token || !query || activeWorkspaceId === null) return;

    setLoading(true);
    setError(null);
    try {
      const found = await searchDocuments(token, activeWorkspaceId, query);
      setResults(found);
    } catch (err) {
      setError(mapError(err, "Search failed"));
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleView(documentId: number, page: number) {
    if (!token) return;
    try {
      await viewDocument(token, documentId, page);
    } catch (err) {
      setError(mapError(err, "Couldn't open document"));
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <span className="eyebrow">Find in documents</span>
        <h1 className="heading-display">Search documents</h1>
        <p>Look for a word or phrase across every document in this workspace - no generated answer, just where it appears.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="search-input-wrap">
          <input
            type="text"
            placeholder="Search document content"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            autoFocus
          />
          <button type="submit" className="search-input-submit" disabled={!queryInput.trim() || loading || activeWorkspaceId === null}>
            <SearchIcon width={16} height={16} />
          </button>
        </div>
      </form>

      {error && (
        <Notice type="error" title={error.title} message={error.message} details={error.details} onDismiss={() => setError(null)} />
      )}

      {loading ? (
        <p className="search-results-status">Searching...</p>
      ) : results === null ? null : results.length === 0 ? (
        <div className="empty-state search-results">
          <DocumentsIcon width={28} height={28} />
          <p>No matches for that search in this workspace.</p>
        </div>
      ) : (
        <div className="library-rows search-results">
          {results.map((result, index) => (
            <div className="library-row" key={`${result.document_id}-${result.chunk_index}`}>
              <span className="library-row-index">{String(index + 1).padStart(2, "0")}</span>
              <div className="library-row-main">
                <div className="library-row-title">{result.filename}</div>
                <p className="search-result-snippet">{result.snippet.trim()}</p>
                <div className="library-row-meta">
                  <span>Page {result.page}</span>
                </div>
              </div>
              {result.file_available && (
                <span className="row-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`View ${result.filename}`}
                    onClick={() => handleView(result.document_id, result.page)}
                  >
                    <EyeIcon width={15} height={15} />
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
