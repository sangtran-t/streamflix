// Package auth implements signed-cookie verification for the delivery edge.
//
// Contract: COMMUNICATION.md §4 — cookie = payload + "." + sig
//
//	payload = base64url( JSON {"u":userId,"a":assetId,"e":expiryUnix} )
//	sig     = base64url( HMAC_SHA256(secret, payload) )
//
// The golden-vector contract test (cookie_test.go) asserts exact output for
// pinned inputs; it must match signing.service.spec.ts in the NestJS api so
// the two implementations cannot silently drift.
package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// ClockSkew is the tolerance for expiry checks.
const ClockSkew = 30 * time.Second

// ErrMissing is returned when the cookie is absent or empty.
var ErrMissing = errors.New("sf_play cookie missing")

// ErrMalformed is returned when the cookie cannot be parsed.
var ErrMalformed = errors.New("sf_play cookie malformed")

// ErrExpired is returned when the cookie has expired (past expiry + skew).
var ErrExpired = errors.New("sf_play cookie expired")

// ErrAssetMismatch is returned when the signed assetId != the requested path's assetId.
var ErrAssetMismatch = errors.New("sf_play cookie asset mismatch")

type cookiePayload struct {
	U string `json:"u"` // userId
	A string `json:"a"` // assetId
	E int64  `json:"e"` // expiry Unix seconds
}

// VerifyCookie checks the sf_play signed cookie for a given assetId.
//
// It returns the userId embedded in the cookie, or an error:
//   - ErrMissing      → caller should respond 401
//   - ErrMalformed    → caller should respond 401
//   - ErrExpired      → caller should respond 403
//   - ErrAssetMismatch → caller should respond 403
func VerifyCookie(secret, cookieValue, assetId string) (userId string, err error) {
	if cookieValue == "" {
		return "", ErrMissing
	}

	// Split on the last dot to separate payload from signature.
	idx := strings.LastIndex(cookieValue, ".")
	if idx < 0 {
		return "", ErrMalformed
	}
	payloadB64 := cookieValue[:idx]
	sigB64 := cookieValue[idx+1:]

	// --- 1. Constant-time HMAC verify ---
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payloadB64))
	expectedSig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	// hmac.Equal does constant-time comparison.
	if !hmac.Equal([]byte(expectedSig), []byte(sigB64)) {
		return "", ErrMalformed
	}

	// --- 2. Decode payload ---
	payloadJSON, err := base64.RawURLEncoding.DecodeString(payloadB64)
	if err != nil {
		return "", fmt.Errorf("%w: base64 decode: %v", ErrMalformed, err)
	}
	var p cookiePayload
	if err := json.Unmarshal(payloadJSON, &p); err != nil {
		return "", fmt.Errorf("%w: json decode: %v", ErrMalformed, err)
	}

	// --- 3. Expiry check (with clock skew) ---
	expiry := time.Unix(p.E, 0)
	if time.Now().After(expiry.Add(ClockSkew)) {
		return "", ErrExpired
	}

	// --- 4. Asset match ---
	if p.A != assetId {
		return "", ErrAssetMismatch
	}

	return p.U, nil
}
