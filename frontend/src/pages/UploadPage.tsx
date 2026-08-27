import { useState, type DragEvent, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { uploadDocument } from "../api";
import { mapError } from "../lib/errorMessages";
import { CloudUploadIcon, FileIcon, UploadIcon } from "../components/icons";
import { Notice } from "../components/Notice";

type UploadStatus = "idle" | "uploading" | "indexing" | "success" | "error";

export function UploadPage() {
  const { token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [indexedName, setIndexedName] = useState<string | null>(null);
  const [error, setError] = useState<ReturnType<typeof mapError> | null>(null);

  function selectFile(next: File | null) {
    setFile(next);
    setStatus("idle");
    setError(null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) selectFile(dropped);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || !file) return;
    setError(null);
    setProgress(0);
    setStatus("uploading");
    try {
      const result = await uploadDocument(token, file, (pct) => {
        setProgress(pct);
        if (pct >= 100) setStatus("indexing");
      });
      setStatus("success");
      setIndexedName(result.filename);
      setFile(null);
    } catch (err) {
      setStatus("error");
      setError(mapError(err, "Upload failed"));
    }
  }

  const busy = status === "uploading" || status === "indexing";

  return (
    <div className="page">
      <div className="page-header">
        <span className="eyebrow">Add to the archive</span>
        <h1 className="heading-display">Add document</h1>
        <p>Documents are chunked, embedded, and stored entirely on your own infrastructure.</p>
      </div>

      {status === "success" && indexedName && (
        <Notice type="success" title="Indexed" message={indexedName} onDismiss={() => setStatus("idle")} />
      )}

      {status === "error" && error && (
        <Notice
          type="error"
          title={error.title}
          message={error.message}
          details={error.details}
          onDismiss={() => setStatus("idle")}
        />
      )}

      {busy ? (
        <div className="upload-progress-panel">
          <div className="upload-progress-header">
            <span className="upload-progress-filename">{file?.name}</span>
            <span className="upload-progress-pct">{status === "indexing" ? "Indexing…" : `${progress}%`}</span>
          </div>
          <div className="upload-progress-track">
            <div
              className={status === "indexing" ? "upload-progress-fill indeterminate" : "upload-progress-fill"}
              style={status === "indexing" ? undefined : { width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div
            className={dragActive ? "upload-dropzone dropzone-active" : "upload-dropzone"}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <input type="file" accept="application/pdf" onChange={(e) => selectFile(e.target.files?.[0] ?? null)} />
            <div className="upload-dropzone-icon">
              <CloudUploadIcon />
            </div>
            <div className="upload-dropzone-title">Drop a file here or choose one</div>
            <div className="upload-dropzone-hint">PDF</div>
          </div>

          {file && (
            <div className="selected-file">
              <FileIcon width={16} height={16} />
              {file.name}
            </div>
          )}

          <div className="upload-actions">
            <button type="submit" disabled={!file}>
              <UploadIcon width={16} height={16} />
              Add document
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
