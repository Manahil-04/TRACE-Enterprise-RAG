import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AppStatus = "ready" | "searching";

interface AppStatusContextValue {
  status: AppStatus;
  setStatus: (status: AppStatus) => void;
}

const AppStatusContext = createContext<AppStatusContextValue | null>(null);

export function AppStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AppStatus>("ready");
  const value = useMemo<AppStatusContextValue>(() => ({ status, setStatus }), [status]);
  return <AppStatusContext.Provider value={value}>{children}</AppStatusContext.Provider>;
}

export function useAppStatus(): AppStatusContextValue {
  const context = useContext(AppStatusContext);
  if (context === null) throw new Error("useAppStatus must be used within an AppStatusProvider");
  return context;
}
