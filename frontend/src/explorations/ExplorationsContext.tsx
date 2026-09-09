import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { listExplorations, ApiError, type ExplorationSummary } from "../api";

interface ExplorationsContextValue {
  summaries: ExplorationSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const ExplorationsContext = createContext<ExplorationsContextValue | null>(null);

export function ExplorationsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const [summaries, setSummaries] = useState<ExplorationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token || activeWorkspaceId === null) return;
    setLoading(true);
    setError(null);
    try {
      setSummaries(await listExplorations(token, activeWorkspaceId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load explorations");
    } finally {
      setLoading(false);
    }
  }, [token, activeWorkspaceId]);

  useEffect(() => {
    if (token && activeWorkspaceId !== null) refresh();
    else setSummaries([]);
  }, [token, activeWorkspaceId, refresh]);

  const value = useMemo<ExplorationsContextValue>(
    () => ({ summaries, loading, error, refresh }),
    [summaries, loading, error, refresh]
  );

  return <ExplorationsContext.Provider value={value}>{children}</ExplorationsContext.Provider>;
}

export function useExplorations(): ExplorationsContextValue {
  const context = useContext(ExplorationsContext);
  if (context === null) throw new Error("useExplorations must be used within an ExplorationsProvider");
  return context;
}

export interface ExplorationGroup {
  label: string;
  items: ExplorationSummary[];
}

export function groupByRecency(items: ExplorationSummary[]): ExplorationGroup[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const yesterdayMs = todayMs - 24 * 60 * 60 * 1000;

  const today: ExplorationSummary[] = [];
  const yesterday: ExplorationSummary[] = [];
  const earlier: ExplorationSummary[] = [];

  for (const item of items) {
    const updatedAt = new Date(item.updated_at).getTime();
    if (updatedAt >= todayMs) today.push(item);
    else if (updatedAt >= yesterdayMs) yesterday.push(item);
    else earlier.push(item);
  }

  const groups: ExplorationGroup[] = [];
  if (today.length) groups.push({ label: "Today", items: today });
  if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday });
  if (earlier.length) groups.push({ label: "Earlier", items: earlier });
  return groups;
}

export function formatRelativeTime(iso: string): string {
  const createdAt = new Date(iso).getTime();
  const diffMin = Math.round((Date.now() - createdAt) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const daysAgo = Math.floor((startOfToday.getTime() - createdAt) / 86400000);
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return new Date(createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
