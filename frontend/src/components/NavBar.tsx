import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function NavBar() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  if (!token) return null;

  return (
    <nav className="navbar">
      <span className="navbar-brand">Internal RAG</span>
      <div className="navbar-links">
        <NavLink to="/chat">Chat</NavLink>
        <NavLink to="/upload">Upload</NavLink>
        <NavLink to="/documents">Documents</NavLink>
      </div>
      <button
        type="button"
        className="navbar-logout"
        onClick={() => {
          logout();
          navigate("/login");
        }}
      >
        Log out
      </button>
    </nav>
  );
}
