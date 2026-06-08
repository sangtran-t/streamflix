import { useCallback, useState } from 'react';
import { login as apiLogin, register as apiRegister } from '../api/auth.ts';

interface AuthState {
  accessToken: string | null;
  user: { id: string; email: string; displayName: string } | null;
}

// In-memory auth state only — no localStorage (CLAUDE.md: no tokens in storage).
// Phase 3 will migrate to httpOnly refresh-cookie-backed sessions.
let _state: AuthState = { accessToken: null, user: null };
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((fn) => fn());
}

export function useAuth() {
  const [, rerender] = useState(0);

  const subscribe = useCallback(() => {
    const fn = () => rerender((n) => n + 1);
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  }, []);

  // Subscribe on mount
  const [subscribed] = useState(() => {
    const unsub = subscribe();
    return unsub;
  });
  void subscribed; // suppress unused warning

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    _state = { accessToken: result.accessToken, user: result.user };
    notify();
    return result;
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const result = await apiRegister(email, password, displayName);
    _state = { accessToken: result.accessToken, user: result.user };
    notify();
    return result;
  }, []);

  const logout = useCallback(() => {
    _state = { accessToken: null, user: null };
    notify();
  }, []);

  return {
    accessToken: _state.accessToken,
    user: _state.user,
    isAuthenticated: _state.accessToken !== null,
    login,
    register,
    logout,
  };
}
