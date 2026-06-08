// Contract test: signed-cookie golden vector.
//
// The expected values are pinned in docs/COMMUNICATION.md §4.3 and MUST match
// the corresponding Node test in api/src/playback/signing.service.spec.ts.
// Any change here requires a matching change there (and vice versa).
package auth_test

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"testing"
	"time"

	"streamflix/transcoder/internal/auth"
)

const (
	goldenSecret  = "test-secret"
	goldenUserId  = "11111111-1111-1111-1111-111111111111"
	goldenAssetId = "22222222-2222-2222-2222-222222222222"
	goldenExpiry  = int64(1750000000)
	goldenPayload = "eyJ1IjoiMTExMTExMTEtMTExMS0xMTExLTExMTEtMTExMTExMTExMTExIiwiYSI6IjIyMjIyMjIyLTIyMjItMjIyMi0yMjIyLTIyMjIyMjIyMjIyMiIsImUiOjE3NTAwMDAwMDB9"
	goldenSig     = "VEoV18jR3Wv7HJKbaInMAImlKXQhoLuHyjgT3wlcSI0"
)

// goldenCookie is the full cookie value for the golden vector.
const goldenCookie = goldenPayload + "." + goldenSig

// TestGoldenPayloadEncoding verifies that the canonical JSON+base64url encoding
// matches the pinned payload from COMMUNICATION.md §4.3.
func TestGoldenPayloadEncoding(t *testing.T) {
	type payload struct {
		U string `json:"u"`
		A string `json:"a"`
		E int64  `json:"e"`
	}
	p := payload{U: goldenUserId, A: goldenAssetId, E: goldenExpiry}
	raw, err := json.Marshal(p)
	if err != nil {
		t.Fatalf("json.Marshal: %v", err)
	}
	got := base64.RawURLEncoding.EncodeToString(raw)
	if got != goldenPayload {
		t.Errorf("payload mismatch\n got: %s\nwant: %s", got, goldenPayload)
	}
}

// TestGoldenSignature verifies the HMAC-SHA256 signature matches the pinned value.
func TestGoldenSignature(t *testing.T) {
	mac := hmac.New(sha256.New, []byte(goldenSecret))
	mac.Write([]byte(goldenPayload))
	got := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if got != goldenSig {
		t.Errorf("sig mismatch\n got: %s\nwant: %s", got, goldenSig)
	}
}

// TestVerifyCookie_GoldenVector tests the full verification path with a cookie
// that hasn't expired yet (goldenExpiry = 1750000000 ≈ 2025-06-15, in the future).
func TestVerifyCookie_GoldenVector(t *testing.T) {
	// goldenExpiry (1750000000) is in the far future relative to test run time.
	userId, err := auth.VerifyCookie(goldenSecret, goldenCookie, goldenAssetId)
	if err != nil {
		t.Fatalf("expected success, got error: %v", err)
	}
	if userId != goldenUserId {
		t.Errorf("userId mismatch: got %q, want %q", userId, goldenUserId)
	}
}

// TestVerifyCookie_BadSignature checks that a tampered signature is rejected.
func TestVerifyCookie_BadSignature(t *testing.T) {
	tampered := goldenPayload + ".AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
	_, err := auth.VerifyCookie(goldenSecret, tampered, goldenAssetId)
	if err != auth.ErrMalformed {
		t.Errorf("expected ErrMalformed, got: %v", err)
	}
}

// TestVerifyCookie_Missing checks the empty-cookie path.
func TestVerifyCookie_Missing(t *testing.T) {
	_, err := auth.VerifyCookie(goldenSecret, "", goldenAssetId)
	if err != auth.ErrMissing {
		t.Errorf("expected ErrMissing, got: %v", err)
	}
}

// TestVerifyCookie_AssetMismatch checks that a cookie for one asset is rejected
// when presented for a different asset.
func TestVerifyCookie_AssetMismatch(t *testing.T) {
	_, err := auth.VerifyCookie(goldenSecret, goldenCookie, "99999999-9999-9999-9999-999999999999")
	if err != auth.ErrAssetMismatch {
		t.Errorf("expected ErrAssetMismatch, got: %v", err)
	}
}

// TestVerifyCookie_Expired checks that a cookie past its expiry (+ skew) is rejected.
func TestVerifyCookie_Expired(t *testing.T) {
	// Build a cookie that expired 1 hour ago (well past the 30s skew).
	expiredExpiry := time.Now().Add(-1 * time.Hour).Unix()
	type payload struct {
		U string `json:"u"`
		A string `json:"a"`
		E int64  `json:"e"`
	}
	p := payload{U: goldenUserId, A: goldenAssetId, E: expiredExpiry}
	raw, _ := json.Marshal(p)
	payloadB64 := base64.RawURLEncoding.EncodeToString(raw)

	mac := hmac.New(sha256.New, []byte(goldenSecret))
	mac.Write([]byte(payloadB64))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	cookie := payloadB64 + "." + sig
	_, err := auth.VerifyCookie(goldenSecret, cookie, goldenAssetId)
	if err != auth.ErrExpired {
		t.Errorf("expected ErrExpired, got: %v", err)
	}
}
