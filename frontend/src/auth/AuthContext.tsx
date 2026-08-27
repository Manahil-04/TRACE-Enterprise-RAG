import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { login as apiLogin, register as apiRegister, setUnauthorizedListener } from "../api";

const TOKEN_STORAGE_KEY = "rag_token";

interface AuthContextValue {
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY)
  );

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

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
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
    [token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
