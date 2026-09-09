import { type MouseEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useAppStatus } from "../status/AppStatusContext";
import { LogoMark, SearchIcon } from "./icons";
import { ProfileMenu } from "./ProfileMenu";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const { token } = useAuth();
  const { status } = useAppStatus();
  const navigate = useNavigate();
  const location = useLocation();

  if (!token) return null;

  function handleSearchClick(event: MouseEvent) {
    event.preventDefault();
    if (location.pathname === "/chat") {
      // Already at the search entry point - focus the field instead of a no-op navigation.
      document.getElementById("knowledge-search-input")?.focus();
    } else {
      navigate("/chat");
    }
  }

  return (
    <header className="app-header">
      <Link className="app-header-brand" to="/chat">
        <span className="app-header-brand-mark">
          <LogoMark />
        </span>
        <span className="app-header-brand-text">TRACE</span>
      </Link>

      <div className="app-header-actions">
        <Link className="header-search-link" to="/chat" onClick={handleSearchClick}>
          <SearchIcon width={15} height={15} />
          <span>Search</span>
        </Link>
        <span className={status === "searching" ? "app-header-status searching" : "app-header-status"}>
          <span className="app-header-status-dot" />
          <span>{status === "searching" ? "Searching" : "Ready"}</span>
        </span>
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>
  );
}
