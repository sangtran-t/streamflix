export interface AuthResult {
  accessToken: string;
  user: { id: string; email: string; displayName: string; role: 'user' | 'admin' };
}

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResult> {
  const res = await fetch('/api/v1/auth/register', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Register failed: ${res.status}`);
  }
  return (await res.json()) as AuthResult;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Login failed: ${res.status}`);
  }
  return (await res.json()) as AuthResult;
}

/** Exchange the httpOnly refresh cookie for a new access token. */
export async function refreshTokens(): Promise<AuthResult> {
  const res = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Session expired — please log in again');
  return (await res.json()) as AuthResult;
}

export async function logout(): Promise<void> {
  await fetch('/api/v1/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}
