import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useWorkspace } from "../workspace/WorkspaceContext";
import {
  listDocuments,
  deleteDocument,
  renameDocument,
  viewDocument,
  downloadDocument,
  type DocumentRead,
} from "../api";
import { mapError } from "../lib/errorMessages";
import { DocumentsIcon, DownloadIcon, EyeIcon, PencilIcon, TrashIcon, UploadIcon } from "../components/icons";
import { Notice } from "../components/Notice";
import { ConfirmDialog } from "../components/ConfirmDialog";

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

function formatSize(bytes: number | null): string | null {
  if (bytes === null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsPage() {
  const { token, user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const [documents, setDocuments] = useState<DocumentRead[]>([]);
  const [error, setError] = useState<ReturnType<typeof mapError> | null>(null);
  const [loading, setLoading] = useState(true);

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<DocumentRead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    if (!token || activeWorkspaceId === null) return;
    setLoading(true);
    listDocuments(token, activeWorkspaceId)
      .then(setDocuments)
      .catch((err) => setError(mapError(err, "Couldn't load documents")))
      .finally(() => setLoading(false));
  }, [token, activeWorkspaceId]);

  function canManage(doc: DocumentRead): boolean {
    return doc.owner_id === user?.id || user?.role === "admin";
  }

  function startRename(doc: DocumentRead) {
    setRenamingId(doc.id);
    setRenameDraft(titleFromFilename(doc.filename));
  }

  async function commitRename(doc: DocumentRead) {
    const draft = renameDraft.trim();
    setRenamingId(null);
    if (!token || !draft) return;
    const ext = getExtension(doc.filename);
    const filename = ext === "FILE" ? draft : `${draft}.${doc.filename.slice(doc.filename.lastIndexOf(".") + 1)}`;
    if (filename === doc.filename) return;
    try {
      const updated = await renameDocument(token, doc.id, filename);
      setDocuments((docs) => docs.map((d) => (d.id === doc.id ? updated : d)));
    } catch (err) {
      setError(mapError(err, "Couldn't rename document"));
    }
  }

  function handleRenameSubmit(event: FormEvent, doc: DocumentRead) {
    event.preventDefault();
    commitRename(doc);
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") setRenamingId(null);
  }

  async function handleView(doc: DocumentRead) {
    if (!token) return;
    try {
      await viewDocument(token, doc.id);
    } catch (err) {
      setError(mapError(err, "Couldn't open document"));
    }
  }

  async function handleDownload(doc: DocumentRead) {
    if (!token) return;
    try {
      await downloadDocument(token, doc.id, doc.filename);
    } catch (err) {
      setError(mapError(err, "Couldn't download document"));
    }
  }

  async function confirmDelete() {
    if (!token || !pendingDelete) return;
    setDeleting(true);
    try {
      await deleteDocument(token, pendingDelete.id);
      setDocuments((docs) => docs.filter((doc) => doc.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err) {
      // Deletion is restricted to the uploader/admin - a 403 here means
      // permissions changed between page load and this click.
      setError(mapError(err, "Couldn't delete document"));
    } finally {
      setDeleting(false);
    }
  }

  const filteredDocuments = useMemo(() => {
    const needle = filterText.trim().toLowerCase();
    if (!needle) return documents;
    return documents.filter((doc) => doc.filename.toLowerCase().includes(needle));
  }, [documents, filterText]);

  const groups = useMemo(() => {
    const byExt = new Map<string, DocumentRead[]>();
    for (const doc of filteredDocuments) {
      const ext = getExtension(doc.filename);
      if (!byExt.has(ext)) byExt.set(ext, []);
      byExt.get(ext)!.push(doc);
    }
    return [...byExt.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ext, items]) => ({ ext, label: labelForExtension(ext), items }));
  }, [filteredDocuments]);

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <span className="eyebrow">Document library</span>
          <h1 className="heading-display">Documents</h1>
          <p>Everyone with access to this workspace can search these. Only the uploader or an admin can rename or delete one.</p>
        </div>
        <Link to="/upload" className="header-action-button">
          <UploadIcon width={16} height={16} />
          Add documents
        </Link>
      </div>

      {error && (
        <Notice type="error" title={error.title} message={error.message} details={error.details} onDismiss={() => setError(null)} />
      )}

      {documents.length > 0 && (
        <div className="filter-input-wrap">
          <input
            type="text"
            placeholder="Filter by filename"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : documents.length === 0 ? (
        <div className="empty-state">
          <DocumentsIcon width={28} height={28} />
          <p>No documents in this workspace yet.</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="empty-state">
          <DocumentsIcon width={28} height={28} />
          <p>No documents match "{filterText.trim()}".</p>
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
              {group.items.map((doc, index) => {
                const isRenaming = renamingId === doc.id;
                const size = formatSize(doc.size_bytes);
                return (
                  <div className="library-row" key={doc.id}>
                    <span className="library-row-index">{String(index + 1).padStart(2, "0")}</span>
                    <div className="library-row-main">
                      {isRenaming ? (
                        <form className="rename-form" onSubmit={(e) => handleRenameSubmit(e, doc)}>
                          <input
                            className="rename-input"
                            value={renameDraft}
                            autoFocus
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onBlur={() => commitRename(doc)}
                            onKeyDown={handleRenameKeyDown}
                          />
                        </form>
                      ) : (
                        <div className="library-row-title">{titleFromFilename(doc.filename)}</div>
                      )}
                      <div className="library-row-meta">
                        <span>{group.ext}</span>
                        <span>·</span>
                        <span>Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</span>
                        {size && (
                          <>
                            <span>·</span>
                            <span>{size}</span>
                          </>
                        )}
                        {doc.ocr_used && (
                          <>
                            <span>·</span>
                            <span>OCR</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="row-actions">
                      {doc.file_available && (
                        <>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`View ${doc.filename}`}
                            onClick={() => handleView(doc)}
                          >
                            <EyeIcon width={15} height={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`Download ${doc.filename}`}
                            onClick={() => handleDownload(doc)}
                          >
                            <DownloadIcon width={15} height={15} />
                          </button>
                        </>
                      )}
                      {canManage(doc) && (
                        <>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`Rename ${doc.filename}`}
                            onClick={() => startRename(doc)}
                          >
                            <PencilIcon width={15} height={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-button row-action-danger"
                            aria-label={`Delete ${doc.filename}`}
                            onClick={() => setPendingDelete(doc)}
                          >
                            <TrashIcon width={15} height={15} />
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this document?"
          message={`"${pendingDelete.filename}" and its indexed data will be permanently deleted from this workspace. This can't be undone.`}
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
