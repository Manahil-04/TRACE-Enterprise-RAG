import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { listDocuments, deleteDocument, ApiError, type DocumentRead } from "../api";

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
      <h1>Documents</h1>
      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : documents.length === 0 ? (
        <p>No documents uploaded yet.</p>
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
                <td>{doc.filename}</td>
                <td>{new Date(doc.uploaded_at).toLocaleString()}</td>
                <td>
                  <button type="button" onClick={() => handleDelete(doc.id)}>
                    Delete
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
