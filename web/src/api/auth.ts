export interface AuthResult {
  accessToken: string;
  user: { id: string; email: string; displayName: string };
}

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResult> {
  const res = await fetch('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Register failed: ${res.status}`);
  }
  return res.json() as Promise<AuthResult>;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Login failed: ${res.status}`);
  }
  return res.json() as Promise<AuthResult>;
}
