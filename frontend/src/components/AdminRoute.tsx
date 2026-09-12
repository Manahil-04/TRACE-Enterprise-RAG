import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();

  if (!token) return <Navigate to="/login" replace />;
  // Role is fetched separately from the token (see AuthContext) - render
  // nothing during that brief gap rather than redirecting a real admin away
  // before we actually know their role.
  if (user === null) return null;
  if (user.role !== "admin") return <Navigate to="/chat" replace />;

  return <>{children}</>;
}
