import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { listWorkspaces, ApiError, type WorkspaceRead } from "../api";

const STORAGE_KEY = "trace_active_workspace_id";

interface WorkspaceContextValue {
  workspaces: WorkspaceRead[];
  activeWorkspaceId: number | null;
  setActiveWorkspaceId: (id: number) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readStoredId(): number | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceRead[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<number | null>(readStoredId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setActiveWorkspaceId = useCallback((id: number) => {
    setActiveWorkspaceIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      // Storage can be unavailable (private browsing, quota) - the choice
      // just won't persist across reloads.
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listWorkspaces(token);
      setWorkspaces(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) refresh();
    else setWorkspaces([]);
  }, [token, refresh]);

  // Once workspaces are known, make sure the active id actually points at one
  // the user can access - falls back to the first accessible workspace if
  // the stored choice is stale (removed, or from a different account).
  useEffect(() => {
    if (workspaces.length === 0) return;
    const stillValid = workspaces.some((w) => w.id === activeWorkspaceId);
    if (!stillValid) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, activeWorkspaceId, setActiveWorkspaceId]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({ workspaces, activeWorkspaceId, setActiveWorkspaceId, loading, error, refresh }),
    [workspaces, activeWorkspaceId, setActiveWorkspaceId, loading, error, refresh]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (context === null) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return context;
}
