import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ChatIcon, DocumentsIcon, LogoMark, LogoutIcon, UploadIcon } from "./icons";

const NAV_ITEMS = [
  { to: "/chat", label: "Chat", icon: ChatIcon },
  { to: "/upload", label: "Upload", icon: UploadIcon },
  { to: "/documents", label: "Documents", icon: DocumentsIcon },
];

export function Sidebar() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  if (!token) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <LogoMark />
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">Enclave</span>
          <span className="sidebar-brand-tag">Self-hosted</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: ItemIcon }) => (
          <NavLink key={to} to={to} className="sidebar-link">
            <ItemIcon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        className="sidebar-logout"
        onClick={() => {
          logout();
          navigate("/login");
        }}
      >
        <LogoutIcon />
        <span>Log out</span>
      </button>
    </aside>
  );
}
