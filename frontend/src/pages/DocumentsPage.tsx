import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { listDocuments, deleteDocument, type DocumentRead } from "../api";
import { mapError } from "../lib/errorMessages";
import { DocumentsIcon, TrashIcon } from "../components/icons";
import { Notice } from "../components/Notice";

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx + 1).toUpperCase() : "FILE";
}

function labelForExtension(ext: string): string {
  if (ext === "PDF") return "PDF documents";
  if (ext === "MD") return "Markdown documents";
  if (ext === "TXT") return "Text documents";
  if (ext === "DOCX" || ext === "DOC") return "Word documents";
  return `${ext} documents`;
}

function titleFromFilename(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx > 0 ? filename.slice(0, idx) : filename;
}

export function DocumentsPage() {
  const { token } = useAuth();
  const [documents, setDocuments] = useState<DocumentRead[]>([]);
  const [error, setError] = useState<ReturnType<typeof mapError> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    listDocuments(token)
      .then(setDocuments)
      .catch((err) => setError(mapError(err, "Couldn't load documents")))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleDelete(documentId: number) {
    if (!token) return;
    setError(null);
    try {
      await deleteDocument(token, documentId);
      setDocuments((docs) => docs.filter((doc) => doc.id !== documentId));
    } catch (err) {
      // Deletion is restricted to the uploader - a 403 here is expected for
      // documents someone else uploaded, since visibility is shared org-wide.
      setError(mapError(err, "Couldn't delete document"));
    }
  }

  const groups = useMemo(() => {
    const byExt = new Map<string, DocumentRead[]>();
    for (const doc of documents) {
      const ext = getExtension(doc.filename);
      if (!byExt.has(ext)) byExt.set(ext, []);
      byExt.get(ext)!.push(doc);
    }
    return [...byExt.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ext, items]) => ({ ext, label: labelForExtension(ext), items }));
  }, [documents]);

  return (
    <div className="page">
      <div className="page-header">
        <span className="eyebrow">Document library</span>
        <h1 className="heading-display">Documents</h1>
        <p>Everyone in your organization can search these. Only the uploader can delete one.</p>
      </div>

      {error && (
        <Notice type="error" title={error.title} message={error.message} details={error.details} onDismiss={() => setError(null)} />
      )}

      {loading ? (
        <p>Loading...</p>
      ) : documents.length === 0 ? (
        <div className="empty-state">
          <DocumentsIcon width={28} height={28} />
          <p>No documents uploaded yet.</p>
        </div>
      ) : (
        groups.map((group) => (
          <div className="library-group" key={group.ext}>
            <div className="library-group-header">
              <h2>{group.label}</h2>
              <span className="library-group-count">
                {group.items.length} document{group.items.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="library-rows">
              {group.items.map((doc, index) => (
                <div className="library-row" key={doc.id}>
                  <span className="library-row-index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="library-row-main">
                    <div className="library-row-title">{titleFromFilename(doc.filename)}</div>
                    <div className="library-row-meta">
                      <span>{group.ext}</span>
                      <span>·</span>
                      <span>Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="icon-button library-row-delete"
                    aria-label={`Delete ${doc.filename}`}
                    onClick={() => handleDelete(doc.id)}
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
