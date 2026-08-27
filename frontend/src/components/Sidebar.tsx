import { NavLink, matchPath, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatRelativeTime, groupByRecency, useExplorations } from "../explorations/ExplorationsContext";

const NAV_ITEMS = [
  { to: "/documents", label: "Documents" },
  { to: "/upload", label: "Add documents" },
];

export function Sidebar() {
  const { token } = useAuth();
  const { summaries } = useExplorations();
  const navigate = useNavigate();
  const location = useLocation();

  if (!token) return null;

  const match = matchPath("/chat/:explorationId", location.pathname);
  const activeId = match ? Number(match.params.explorationId) : null;
  const groups = groupByRecency(summaries);

  return (
    <aside className="sidebar">
      <button type="button" className="new-exploration-button" onClick={() => navigate("/chat")}>
        <span className="new-exploration-plus">+</span>
        New Exploration
      </button>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Workspace</div>
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
        {groups.length === 0 ? (
          <p className="sidebar-exploration-empty">Questions you ask will show up here as explorations.</p>
        ) : (
          <div className="sidebar-explorations">
            {groups.map((group) => (
              <div className="sidebar-exploration-group" key={group.label}>
                <div className="sidebar-exploration-group-label">{group.label}</div>
                {group.items.map((item) => {
                  const isActive = item.id === activeId;
                  return (
                    <button
                      key={item.id}
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
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
