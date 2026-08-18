import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { uploadDocument, ApiError } from "../api";

export function UploadPage() {
  const { token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || !file) return;
    setError(null);
    setMessage(null);
    setUploading(true);
    try {
      const result = await uploadDocument(token, file);
      setMessage(result.message);
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="page">
      <h1>Upload a document</h1>
      <form className="upload-form" onSubmit={handleSubmit}>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button type="submit" disabled={!file || uploading}>
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </form>
      {message && <p className="form-success">{message}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
