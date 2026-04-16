import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchMe, login as apiLogin, logout as apiLogout } from './api';
import type { WorkflowUser } from './types';

interface AuthCtx {
  user: WorkflowUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<WorkflowUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WorkflowUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const u = await apiLogin(email, password);
    // apiLogin returns the login payload; re-hydrate from /auth/me for full fields
    await refresh();
    return u as WorkflowUser;
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  return (
    <Ctx.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be inside AuthProvider');
  return c;
}
