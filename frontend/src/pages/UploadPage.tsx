import { useState, type DragEvent, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { uploadDocument, ApiError } from "../api";
import { CloudUploadIcon, FileIcon, UploadIcon } from "../components/icons";

export function UploadPage() {
  const { token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      setMessage(null);
      setError(null);
    }
  }

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
      <div className="page-header">
        <h1>Upload a document</h1>
        <p>PDFs are chunked, embedded, and stored entirely on your own infrastructure.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div
          className={dragActive ? "dropzone dropzone-active" : "dropzone"}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setMessage(null);
              setError(null);
            }}
          />
          <div className="dropzone-icon">
            <CloudUploadIcon />
          </div>
          <div className="dropzone-title">Drag and drop a PDF here</div>
          <div className="dropzone-hint">or click to browse</div>
        </div>

        {file && (
          <div className="selected-file">
            <FileIcon width={16} height={16} />
            {file.name}
          </div>
        )}

        <div className="upload-actions">
          <button type="submit" disabled={!file || uploading}>
            {uploading ? <span className="spinner" /> : <UploadIcon width={16} height={16} />}
            {uploading ? "Uploading" : "Upload"}
          </button>
        </div>
      </form>

      {message && <p className="form-success">{message}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
