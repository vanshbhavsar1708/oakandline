import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiJson, queryClient, setAuthToken, setUnauthorizedHandler } from "./queryClient";

export type AdminUser = { id: number; name: string; email: string; role: string };

type AuthState = {
  admin: AdminUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  expired: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * Token is held in React memory only. Closing the tab signs the admin out,
 * which is the safest default for a shared-device small business.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [expired, setExpired] = useState(false);

  const logout = useCallback(() => {
    setAuthToken(null);
    setAdmin(null);
    queryClient.removeQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/admin") });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setExpired(true);
      logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiJson<{ token: string; admin: AdminUser }>("POST", "/api/auth/login", { email, password });
    setAuthToken(res.token);
    setExpired(false);
    setAdmin(res.admin);
  }, []);

  const value = useMemo(() => ({ admin, login, logout, expired }), [admin, login, logout, expired]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
