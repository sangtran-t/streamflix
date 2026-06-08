import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';

export interface CookiePayload {
  u: string; // userId
  a: string; // assetId
  e: number; // expiry (Unix seconds)
}

export const SIGNING_SECRET = 'SIGNING_SECRET';

/**
 * Produces and verifies the sf_play signed cookie per COMMUNICATION.md §4.
 *
 * cookie  = payload + "." + sig
 * payload = base64url( JSON { u, a, e } )   ← key order is canonical
 * sig     = base64url( HMAC_SHA256(secret, payload) )
 *
 * Golden-vector contract test in signing.service.spec.ts asserts exact output
 * for the pinned inputs so this implementation and the Go edge cannot silently drift.
 */
@Injectable()
export class SigningService {
  constructor(@Inject(SIGNING_SECRET) private readonly secret: string) {}

  /**
   * Build a signed cookie value. ttlSeconds defaults to 1 h (longer than a
   * typical title so mid-playback refresh is rare).
   */
  buildCookie(userId: string, assetId: string, ttlSeconds = 3600): { cookie: string; expiresAt: Date } {
    const expiryUnix = Math.floor(Date.now() / 1000) + ttlSeconds;
    const payload = this.encodePayload({ u: userId, a: assetId, e: expiryUnix });
    const sig = createHmac('sha256', this.secret).update(payload).digest('base64url');
    return {
      cookie: `${payload}.${sig}`,
      expiresAt: new Date(expiryUnix * 1000),
    };
  }

  /**
   * Exposed for testing: encode a payload with a fixed expiry so the output is deterministic.
   */
  encodePayload(data: CookiePayload): string {
    return Buffer.from(JSON.stringify(data)).toString('base64url');
  }
}
