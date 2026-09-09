import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { listUsers, updateUserRole, type Role, type UserSummary } from "../api";
import { mapError } from "../lib/errorMessages";
import { Notice } from "../components/Notice";

export function AdminUsersPage() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReturnType<typeof mapError> | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    listUsers(token)
      .then(setUsers)
      .catch((err) => setError(mapError(err, "Couldn't load users")))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleRoleChange(userId: number, role: Role) {
    if (!token) return;
    setUpdatingId(userId);
    setError(null);
    try {
      const updated = await updateUserRole(token, userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u)));
    } catch (err) {
      setError(mapError(err, "Couldn't update role"));
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
                  onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
