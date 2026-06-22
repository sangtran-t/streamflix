/**
 * Contract test: signed-cookie golden vector.
 *
 * The expected values are pinned in docs/COMMUNICATION.md §4.3 and MUST match
 * the corresponding Go test in transcoder/internal/auth/cookie_test.go.
 * Any change here requires a matching change there (and vice versa) — this is
 * the mechanism that prevents the two implementations from silently drifting.
 */
import { createHmac } from 'crypto';
import { SigningService } from './signing.service';

const GOLDEN = {
  secret: 'test-secret',
  userId: '11111111-1111-1111-1111-111111111111',
  assetId: '22222222-2222-2222-2222-222222222222',
  expiry: 3000000000,
  payload:
    'eyJ1IjoiMTExMTExMTEtMTExMS0xMTExLTExMTEtMTExMTExMTExMTExIiwiYSI6IjIyMjIyMjIyLTIyMjItMjIyMi0yMjIyLTIyMjIyMjIyMjIyMiIsImUiOjMwMDAwMDAwMDB9',
  sig: 'JcJfV7BaSYGI-j-0z-wN_C21iaVq6dp2layBkmzrGLQ',
};

describe('SigningService — golden vector contract (COMMUNICATION.md §4.3)', () => {
  let svc: SigningService;

  beforeEach(() => {
    svc = new SigningService(GOLDEN.secret);
  });

  it('encodes the payload identically to the pinned vector', () => {
    const payload = svc.encodePayload({ u: GOLDEN.userId, a: GOLDEN.assetId, e: GOLDEN.expiry });
    expect(payload).toBe(GOLDEN.payload);
  });

  it('computes the HMAC signature identically to the pinned vector', () => {
    const sig = createHmac('sha256', GOLDEN.secret).update(GOLDEN.payload).digest('base64url');
    expect(sig).toBe(GOLDEN.sig);
  });

  it('buildCookie produces the canonical cookie format', () => {
    // Override Date.now so the expiry is deterministic.
    const nowMs = (GOLDEN.expiry - 3600) * 1000;
    jest.spyOn(Date, 'now').mockReturnValue(nowMs);

    const { cookie, expiresAt } = svc.buildCookie(GOLDEN.userId, GOLDEN.assetId, 3600);

    expect(cookie).toBe(`${GOLDEN.payload}.${GOLDEN.sig}`);
    expect(expiresAt.getTime()).toBe(GOLDEN.expiry * 1000);

    jest.restoreAllMocks();
  });
});
