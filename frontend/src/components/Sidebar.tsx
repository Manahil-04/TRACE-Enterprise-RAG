import { useState, type FormEvent, type KeyboardEvent } from "react";
import { NavLink, matchPath, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { formatRelativeTime, groupByRecency, useExplorations } from "../explorations/ExplorationsContext";
import { deleteExploration, renameExploration, ApiError, type ExplorationSummary } from "../api";
import { ChevronDownIcon, FolderIcon, PencilIcon, TrashIcon } from "./icons";
import { ConfirmDialog } from "./ConfirmDialog";

const NAV_ITEMS = [
  { to: "/documents", label: "Documents" },
  { to: "/search", label: "Search documents" },
  { to: "/upload", label: "Add documents" },
];

function WorkspaceSwitcher() {
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const active = workspaces.find((w) => w.id === activeWorkspaceId);

  if (workspaces.length === 0) return null;

  return (
    <div className={open ? "workspace-switcher open" : "workspace-switcher"}>
      <button type="button" className="workspace-switcher-button" onClick={() => setOpen((v) => !v)}>
        <span className="workspace-switcher-button-label">
          <FolderIcon width={15} height={15} />
          <span>{active?.name ?? "Select workspace"}</span>
        </span>
        <ChevronDownIcon className="workspace-switcher-chevron" width={15} height={15} />
      </button>
      {open && (
        <div className="workspace-switcher-menu">
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              className={w.id === activeWorkspaceId ? "workspace-switcher-item active" : "workspace-switcher-item"}
              onClick={() => {
                setActiveWorkspaceId(w.id);
                setOpen(false);
              }}
            >
              {w.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { token } = useAuth();
  const { summaries, refresh } = useExplorations();
  const navigate = useNavigate();
  const location = useLocation();

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ExplorationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) return null;

  const match = matchPath("/chat/:explorationId", location.pathname);
  const activeId = match ? Number(match.params.explorationId) : null;
  const groups = groupByRecency(summaries);

  function startRename(item: ExplorationSummary) {
    setRenamingId(item.id);
    setRenameDraft(item.title);
  }

  async function commitRename(itemId: number) {
    const title = renameDraft.trim();
    setRenamingId(null);
    if (!token || !title) return;
    try {
      await renameExploration(token, itemId, title);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to rename exploration");
    }
  }

  function handleRenameSubmit(event: FormEvent, itemId: number) {
    event.preventDefault();
    commitRename(itemId);
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") setRenamingId(null);
  }

  async function confirmDelete() {
    if (!token || !pendingDelete) return;
    setDeleting(true);
    try {
      await deleteExploration(token, pendingDelete.id);
      refresh();
      if (activeId === pendingDelete.id) navigate("/chat");
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete exploration");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <aside className="sidebar">
      <WorkspaceSwitcher />

      <button type="button" className="new-exploration-button" onClick={() => navigate("/chat")}>
        <span className="new-exploration-plus">+</span>
        New Exploration
      </button>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Library</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section sidebar-section-grow">
        <div className="sidebar-section-label">Explorations</div>
        {error && <p className="sidebar-exploration-empty">{error}</p>}
        {groups.length === 0 ? (
          <p className="sidebar-exploration-empty">Questions you ask will show up here as explorations.</p>
        ) : (
          <div className="sidebar-explorations">
            {groups.map((group) => (
              <div className="sidebar-exploration-group" key={group.label}>
                <div className="sidebar-exploration-group-label">{group.label}</div>
                {group.items.map((item) => {
                  const isActive = item.id === activeId;
                  const isRenaming = renamingId === item.id;
                  return (
                    <div key={item.id} className="sidebar-exploration-row">
                      {isRenaming ? (
                        <form className="rename-form" onSubmit={(e) => handleRenameSubmit(e, item.id)}>
                          <input
                            className="rename-input"
                            value={renameDraft}
                            autoFocus
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onBlur={() => commitRename(item.id)}
                            onKeyDown={handleRenameKeyDown}
                          />
                        </form>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={isActive ? "sidebar-exploration-item active" : "sidebar-exploration-item"}
                            title={`${item.title} — ${formatRelativeTime(item.updated_at)}`}
                            onClick={() => navigate(`/chat/${item.id}`)}
                          >
                            <span className={isActive ? "sidebar-exploration-dot active" : "sidebar-exploration-dot"} />
                            <span className="sidebar-exploration-text">
                              <span className="sidebar-exploration-title">{item.title}</span>
                              <span className="sidebar-exploration-count">
                                {item.message_count} question{item.message_count === 1 ? "" : "s"}
                              </span>
                            </span>
                          </button>
                          <span className="row-actions">
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`Rename ${item.title}`}
                              onClick={() => startRename(item)}
                            >
                              <PencilIcon width={13} height={13} />
                            </button>
                            <button
                              type="button"
                              className="icon-button row-action-danger"
                              aria-label={`Delete ${item.title}`}
                              onClick={() => setPendingDelete(item)}
                            >
                              <TrashIcon width={13} height={13} />
                            </button>
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this exploration?"
          message={`"${pendingDelete.title}" and its ${pendingDelete.message_count} question${pendingDelete.message_count === 1 ? "" : "s"} will be permanently deleted. This can't be undone.`}
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </aside>
  );
}
