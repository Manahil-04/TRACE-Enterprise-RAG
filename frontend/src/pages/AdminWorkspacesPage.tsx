import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { useWorkspace } from "../workspace/WorkspaceContext";
import {
  addWorkspaceMember,
  createWorkspace,
  deleteWorkspace,
  listUsers,
  listWorkspaceMembers,
  removeWorkspaceMember,
  renameWorkspace,
  type UserSummary,
  type WorkspaceMember,
  type WorkspaceRead,
} from "../api";
import { mapError } from "../lib/errorMessages";
import { Notice } from "../components/Notice";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ChevronDownIcon, PencilIcon, TrashIcon } from "../components/icons";

function WorkspaceMembersPanel({ workspace, allUsers }: { workspace: WorkspaceRead; allUsers: UserSummary[] }) {
  const { token } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [error, setError] = useState<ReturnType<typeof mapError> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    listWorkspaceMembers(token, workspace.id)
      .then(setMembers)
      .catch((err) => setError(mapError(err, "Couldn't load members")));
  }, [token, workspace.id]);

  const nonMembers = allUsers.filter((u) => !members?.some((m) => m.user_id === u.id));

  async function handleAdd() {
    if (!token || selectedUserId === "") return;
    setBusy(true);
    setError(null);
    try {
      const member = await addWorkspaceMember(token, workspace.id, selectedUserId);
      setMembers((prev) => [...(prev ?? []), member]);
      setSelectedUserId("");
    } catch (err) {
      setError(mapError(err, "Couldn't add member"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(userId: number) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await removeWorkspaceMember(token, workspace.id, userId);
      setMembers((prev) => prev?.filter((m) => m.user_id !== userId) ?? null);
    } catch (err) {
      setError(mapError(err, "Couldn't remove member"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-section">
      {error && (
        <Notice type="error" title={error.title} message={error.message} details={error.details} onDismiss={() => setError(null)} />
      )}
      {members === null ? (
        <p>Loading members…</p>
      ) : (
        <div className="admin-list">
          {members.map((m) => (
            <div className="admin-list-row" key={m.user_id}>
              <div className="admin-list-row-main">
                <div className="admin-list-row-title">{m.email}</div>
              </div>
              <span className="row-actions">
                <button
                  type="button"
                  className="icon-button row-action-danger"
                  aria-label={`Remove ${m.email}`}
                  disabled={busy}
                  onClick={() => handleRemove(m.user_id)}
                >
                  <TrashIcon width={15} height={15} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      {nonMembers.length > 0 && (
        <div className="new-workspace-form admin-add-member-form">
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Add a user…</option>
            {nonMembers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
          <button type="button" className="btn-ghost" onClick={handleAdd} disabled={selectedUserId === "" || busy}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminWorkspacesPage() {
  const { token } = useAuth();
  const { workspaces, refresh } = useWorkspace();
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [error, setError] = useState<ReturnType<typeof mapError> | null>(null);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<WorkspaceRead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    listUsers(token)
      .then(setAllUsers)
      .catch(() => {
        // The workspace list itself still works without this - member
        // management just won't have a user picker until this succeeds.
      });
  }, [token]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!token || !newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createWorkspace(token, newName.trim());
      setNewName("");
      refresh();
    } catch (err) {
      setError(mapError(err, "Couldn't create workspace"));
    } finally {
      setCreating(false);
    }
  }

  function startRename(workspace: WorkspaceRead) {
    setRenamingId(workspace.id);
    setRenameDraft(workspace.name);
  }

  async function commitRename(workspace: WorkspaceRead) {
    const name = renameDraft.trim();
    setRenamingId(null);
    if (!token || !name || name === workspace.name) return;
    try {
      await renameWorkspace(token, workspace.id, name);
      refresh();
    } catch (err) {
      setError(mapError(err, "Couldn't rename workspace"));
    }
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") setRenamingId(null);
  }

  async function confirmDelete() {
    if (!token || !pendingDelete) return;
    setDeleting(true);
    try {
      await deleteWorkspace(token, pendingDelete.id);
      refresh();
      setPendingDelete(null);
    } catch (err) {
      setError(mapError(err, "Couldn't delete workspace"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <span className="eyebrow">Admin</span>
        <h1 className="heading-display">Workspaces</h1>
        <p>Each workspace has its own documents and explorations. Members can only see workspaces they belong to.</p>
      </div>

      {error && (
        <Notice type="error" title={error.title} message={error.message} details={error.details} onDismiss={() => setError(null)} />
      )}

      <form className="new-workspace-form" onSubmit={handleCreate}>
        <input
          placeholder="New workspace name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" disabled={!newName.trim() || creating}>
          {creating ? <span className="spinner" /> : "Create"}
        </button>
      </form>

      <div className="admin-list">
        {workspaces.map((workspace) => {
          const isRenaming = renamingId === workspace.id;
          const isExpanded = expandedId === workspace.id;
          return (
            <div key={workspace.id}>
              <div className="admin-list-row">
                <div className="admin-list-row-main">
                  {isRenaming ? (
                    <form className="rename-form" onSubmit={(e) => { e.preventDefault(); commitRename(workspace); }}>
                      <input
                        className="rename-input"
                        value={renameDraft}
                        autoFocus
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={() => commitRename(workspace)}
                        onKeyDown={handleRenameKeyDown}
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      className={isExpanded ? "admin-list-row-title workspace-expand-toggle expanded" : "admin-list-row-title workspace-expand-toggle"}
                      onClick={() => setExpandedId(isExpanded ? null : workspace.id)}
                    >
                      <ChevronDownIcon width={13} height={13} />
                      {workspace.name}
                    </button>
                  )}
                  <div className="admin-list-row-meta">
                    {workspace.document_count} document{workspace.document_count === 1 ? "" : "s"} ·{" "}
                    {workspace.member_count} member{workspace.member_count === 1 ? "" : "s"}
                    {workspace.is_default ? " · default" : ""}
                  </div>
                </div>
                <span className="row-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Rename ${workspace.name}`}
                    onClick={() => startRename(workspace)}
                  >
                    <PencilIcon width={15} height={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button row-action-danger"
                    aria-label={`Delete ${workspace.name}`}
                    onClick={() => setPendingDelete(workspace)}
                  >
                    <TrashIcon width={15} height={15} />
                  </button>
                </span>
              </div>
              {isExpanded && <WorkspaceMembersPanel workspace={workspace} allUsers={allUsers} />}
            </div>
          );
        })}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this workspace?"
          message={`"${pendingDelete.name}" and all ${pendingDelete.document_count} of its documents and explorations will be permanently deleted. This can't be undone.`}
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
