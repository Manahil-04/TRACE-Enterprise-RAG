import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { decodeJwtEmail } from "../lib/jwt";
import { FolderIcon, LogoutIcon, SlidersIcon, UsersIcon } from "./icons";

const ADMIN_MENU_ITEMS = [
  { to: "/admin/settings", label: "Settings", icon: SlidersIcon },
  { to: "/admin/workspaces", label: "Workspaces", icon: FolderIcon },
  { to: "/admin/users", label: "Users", icon: UsersIcon },
];

export function ProfileMenu() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!token) return null;

  const email = decodeJwtEmail(token);
  const initial = email ? email[0].toUpperCase() : "U";

  return (
    <div className={open ? "profile-menu open" : "profile-menu"} ref={containerRef}>
      <button type="button" className="profile-menu-trigger" aria-label="Account menu" onClick={() => setOpen((v) => !v)}>
        <span className="user-chip-avatar">{initial}</span>
      </button>

      {open && (
        <div className="profile-menu-panel">
          <div className="profile-menu-header">
            <span className="user-chip-avatar">{initial}</span>
            <div className="profile-menu-header-text">
              {email && <span className="profile-menu-email">{email}</span>}
              <span className="profile-menu-role">{user?.role === "admin" ? "Admin" : "Member"}</span>
            </div>
          </div>

          {user?.role === "admin" && (
            <>
              <div className="profile-menu-divider" />
              <div className="profile-menu-section-label">Admin</div>
              {ADMIN_MENU_ITEMS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => (isActive ? "profile-menu-item active" : "profile-menu-item")}
                  onClick={() => setOpen(false)}
                >
                  <Icon width={15} height={15} />
                  {label}
                </NavLink>
              ))}
            </>
          )}

          <div className="profile-menu-divider" />
          <button
            type="button"
            className="profile-menu-item profile-menu-item-danger"
            onClick={() => {
              setOpen(false);
              logout();
              navigate("/login");
            }}
          >
            <LogoutIcon width={15} height={15} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
