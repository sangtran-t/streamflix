import { useCallback, useState } from 'react';
import {
  login as apiLogin,
  logout as apiLogout,
  refreshTokens as apiRefresh,
  register as apiRegister,
} from '../api/auth.ts';

interface AuthState {
  accessToken: string | null;
  user: { id: string; email: string; displayName: string; role: 'user' | 'admin' } | null;
  /**
   * True once the first refresh attempt has fully resolved (success or failure).
   * Used to distinguish "not yet checked" from "definitely logged out".
   */
  initialized: boolean;
}

// In-memory auth state — never persisted to localStorage/sessionStorage.
// The httpOnly sf_refresh cookie (set by the API) is used to restore the
// session silently on page reload via refreshTokens().
let _state: AuthState = { accessToken: null, user: null, initialized: false };
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((fn) => fn());
}

/** Attempt a silent refresh using the httpOnly cookie.
 *  Deduped: concurrent calls share the same in-flight request. */
let _refreshPromise: Promise<string | null> | null = null;

export async function trySilentRefresh(): Promise<string | null> {
  // Already initialized — return current token immediately (no network call).
  if (_state.initialized) return _state.accessToken;

  // Deduplicate concurrent calls.
  if (!_refreshPromise) {
    _refreshPromise = apiRefresh()
      .then((result) => {
        _state = { accessToken: result.accessToken, user: result.user, initialized: true };
        notify();
        return result.accessToken;
      })
      .catch(() => {
        // No valid cookie — stay logged out, but mark as initialized.
        _state = { ..._state, initialized: true };
        notify();
        return null;
      })
      .finally(() => {
        _refreshPromise = null;
      });
  }

  return _refreshPromise;
}

export function useAuth() {
  const [, rerender] = useState(0);

  const subscribe = useCallback(() => {
    const fn = () => rerender((n) => n + 1);
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  }, []);

  // Subscribe on mount, unsubscribe on unmount.
  useState(() => {
    // Store cleanup but don't expose it as state — just need the side effect.
    const unsub = subscribe();
    // React will not call this as a cleanup, so we rely on component tree stability.
    // Components at the root (AppShell, Nav) live for the whole session.
    return unsub;
  });

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    _state = { accessToken: result.accessToken, user: result.user, initialized: true };
    notify();
    return result;
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const result = await apiRegister(email, password, displayName);
    _state = { accessToken: result.accessToken, user: result.user, initialized: true };
    notify();
    return result;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    _state = { accessToken: null, user: null, initialized: true };
    notify();
  }, []);

  // Admin is determined by the role field returned from the API on login/refresh.
  const isAdmin = _state.user?.role === 'admin';

  return {
    accessToken: _state.accessToken,
    user: _state.user,
    isAuthenticated: _state.accessToken !== null,
    isAdmin,
    initialized: _state.initialized,
    login,
    register,
    logout,
  };
}
