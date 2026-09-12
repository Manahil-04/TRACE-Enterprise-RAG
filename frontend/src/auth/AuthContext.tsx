import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getCurrentUser,
  login as apiLogin,
  register as apiRegister,
  setUnauthorizedListener,
  type CurrentUser,
} from "../api";

const TOKEN_STORAGE_KEY = "rag_token";

interface AuthContextValue {
  token: string | null;
  user: CurrentUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [user, setUser] = useState<CurrentUser | null>(null);

  // Any authenticated API call that comes back 401 (expired/invalid token)
  // clears the session here; ProtectedRoute already redirects to /login as
  // soon as token becomes null, so no separate navigation call is needed.
  useEffect(() => {
    setUnauthorizedListener(() => {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
    });
    return () => setUnauthorizedListener(null);
  }, []);

  // Keep this tab's auth state in sync when another tab logs in or out -
  // localStorage changes don't otherwise trigger a re-render here.
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === TOKEN_STORAGE_KEY) setToken(event.newValue);
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Role-gated UI (admin nav, settings) needs to know who's logged in, not
  // just that a token exists - a decoded JWT claim would go stale for the
  // whole token lifetime if an admin's role changed, so this is fetched
  // fresh instead.
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    let cancelled = false;
    getCurrentUser(token)
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        // A failing /auth/me on a bad token already triggers the
        // unauthorized listener above via throwIfError - nothing more to do.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      login: async (email, password) => {
        const accessToken = await apiLogin(email, password);
        localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
        setToken(accessToken);
      },
      register: async (email, password) => {
        await apiRegister(email, password);
      },
      logout: () => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
      },
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
