import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { listUsers, updateUserRole, updateUserStatus, type Role, type UserSummary } from "../api";
import { mapError } from "../lib/errorMessages";
import { Notice } from "../components/Notice";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { UserCheckIcon, UserXIcon } from "../components/icons";

export function AdminUsersPage() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReturnType<typeof mapError> | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<UserSummary | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<{ user: UserSummary; role: Role } | null>(null);

  useEffect(() => {
    if (!token) return;
    listUsers(token)
      .then(setUsers)
      .catch((err) => setError(mapError(err, "Couldn't load users")))
      .finally(() => setLoading(false));
  }, [token]);

  async function confirmRoleChange() {
    if (!token || !pendingRoleChange) return;
    const { user, role } = pendingRoleChange;
    setUpdatingId(user.id);
    setError(null);
    try {
      const updated = await updateUserRole(token, user.id, role);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: updated.role } : u)));
      setPendingRoleChange(null);
    } catch (err) {
      setError(mapError(err, "Couldn't update role"));
      setPendingRoleChange(null);
    } finally {
      setUpdatingId(null);
    }
  }

  async function confirmStatusChange() {
    if (!token || !pendingStatusChange) return;
    const userId = pendingStatusChange.id;
    const isActive = !pendingStatusChange.is_active;
    setUpdatingId(userId);
    setError(null);
    try {
      const updated = await updateUserStatus(token, userId, isActive);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: updated.is_active } : u)));
      setPendingStatusChange(null);
    } catch (err) {
      setError(mapError(err, isActive ? "Couldn't reactivate user" : "Couldn't deactivate user"));
      setPendingStatusChange(null);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <span className="eyebrow">Admin</span>
        <h1 className="heading-display">Users</h1>
        <p>Admins have full access across every workspace and can manage settings, workspaces, and other users.</p>
      </div>

      {error && (
        <Notice type="error" title={error.title} message={error.message} details={error.details} onDismiss={() => setError(null)} />
      )}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="admin-list">
          {users.map((u) => (
            <div className="admin-list-row" key={u.id}>
              <div className="admin-list-row-main">
                <div className="admin-list-row-title">{u.email}</div>
                <div className="admin-list-row-meta">Joined {new Date(u.created_at).toLocaleDateString()}</div>
              </div>
              <div className="admin-list-row-actions">
                <span className={u.role === "admin" ? "role-badge admin" : "role-badge"}>{u.role}</span>
                <select
                  value={u.role}
                  disabled={updatingId === u.id || u.id === currentUser?.id}
                  onChange={(e) => setPendingRoleChange({ user: u, role: e.target.value as Role })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="button"
                  className={u.is_active ? "icon-button status-active" : "icon-button status-inactive"}
                  title={
                    u.id === currentUser?.id
                      ? "You can't deactivate your own account"
                      : u.is_active
                        ? "Active - click to deactivate"
                        : "Deactivated - click to reactivate"
                  }
                  aria-label={u.is_active ? `Deactivate ${u.email}` : `Reactivate ${u.email}`}
                  disabled={updatingId === u.id || u.id === currentUser?.id}
                  onClick={() => setPendingStatusChange(u)}
                >
                  {u.is_active ? <UserCheckIcon width={16} height={16} /> : <UserXIcon width={16} height={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingRoleChange && (
        <ConfirmDialog
          title={pendingRoleChange.role === "admin" ? "Make this user an admin?" : "Remove admin access?"}
          message={
            pendingRoleChange.role === "admin"
              ? `${pendingRoleChange.user.email} will get full access across every workspace and be able to manage settings, workspaces, and other users.`
              : `${pendingRoleChange.user.email} will lose admin access and be limited to the workspaces they're a member of.`
          }
          confirmLabel={pendingRoleChange.role === "admin" ? "Make admin" : "Remove admin"}
          destructive={pendingRoleChange.role !== "admin"}
          busy={updatingId === pendingRoleChange.user.id}
          onConfirm={confirmRoleChange}
          onCancel={() => setPendingRoleChange(null)}
        />
      )}

      {pendingStatusChange && (
        <ConfirmDialog
          title={pendingStatusChange.is_active ? "Deactivate this user?" : "Reactivate this user?"}
          message={
            pendingStatusChange.is_active
              ? `${pendingStatusChange.email} will no longer be able to sign in. Their documents and explorations are kept as-is, and you can reactivate them any time.`
              : `${pendingStatusChange.email} will be able to sign in again.`
          }
          confirmLabel={pendingStatusChange.is_active ? "Deactivate" : "Reactivate"}
          destructive={pendingStatusChange.is_active}
          busy={updatingId === pendingStatusChange.id}
          onConfirm={confirmStatusChange}
          onCancel={() => setPendingStatusChange(null)}
        />
      )}
    </div>
  );
}
