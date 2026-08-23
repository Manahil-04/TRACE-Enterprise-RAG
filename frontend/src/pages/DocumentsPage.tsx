import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { listDocuments, deleteDocument, ApiError, type DocumentRead } from "../api";
import { DocumentsIcon, FileIcon, TrashIcon } from "../components/icons";

export function DocumentsPage() {
  const { token } = useAuth();
  const [documents, setDocuments] = useState<DocumentRead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    listDocuments(token)
      .then(setDocuments)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load documents"))
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
      setError(err instanceof ApiError ? err.message : "Failed to delete document");
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Documents</h1>
        <p>Everyone in your organization can search these. Only the uploader can delete one.</p>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : documents.length === 0 ? (
        <div className="empty-state">
          <DocumentsIcon width={28} height={28} />
          <p>No documents uploaded yet.</p>
        </div>
      ) : (
        <table className="documents-table">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Uploaded</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td>
                  <div className="doc-filename">
                    <FileIcon width={16} height={16} />
                    {doc.filename}
                  </div>
                </td>
                <td>{new Date(doc.uploaded_at).toLocaleString()}</td>
                <td>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete ${doc.filename}`}
                    onClick={() => handleDelete(doc.id)}
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
