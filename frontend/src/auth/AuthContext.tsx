import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { login as apiLogin, register as apiRegister } from "../api";

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
