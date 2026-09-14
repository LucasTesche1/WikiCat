import { create } from 'zustand';
import type { AuthMeResponse, UserRole } from '@wikicat/shared';
import { api, ApiError } from '../api/client';

type AuthState = {
  user: AuthMeResponse | null;
  isLoading: boolean;
  isBootstrapped: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isBootstrapped: false,
  error: null,
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.auth.login({ email, password });
      set({ user: res.user, isLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Falha no login.';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },
  logout: async () => {
    set({ isLoading: true });
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    set({ user: null, isLoading: false });
  },
  bootstrap: async () => {
    set({ isLoading: true });
    try {
      const user = await api.auth.me();
      set({ user, isLoading: false, isBootstrapped: true });
    } catch {
      set({ user: null, isLoading: false, isBootstrapped: true });
    }
  },
}));

export function hasRole(user: AuthMeResponse | null, role: UserRole | UserRole[]): boolean {
  if (!user) return false;
  const arr = Array.isArray(role) ? role : [role];
  if (arr.includes(user.role)) return true;
  if (user.role === 'admin') return true;
  return false;
}
