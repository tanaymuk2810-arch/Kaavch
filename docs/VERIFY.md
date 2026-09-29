# Verification model (offline, tamper-evident)

## How a certificate survives offline verification

1. **Signature** — certified on-device with an ECDSA P-256 key held in the
   Android Keystore (`suraksha-worker-signing-key`, never extractable).
   Verifier re-verifies with the embedded public key via WebCrypto (browser)
   or `java.security.Signature` (app).
2. **Chain** — each certificate stores `prevHash` (of the previously issued
   certificate) and `chainHash = sha256(prevHash | payload)`. Any edit to any
   earlier certificate breaks every later hash.
3. **Revocation** — the `revoked` flag is stored on-device; exporters include
   it. Dashboard shows REVOKED. (A distributed revocation authority is a
   future add-on; today it is site-supervisor authority.)

## Verify surfaces

- **In-app**: Verify screen — camera QR scan (QrDecoder) or manual paste →
  `CertificateEngine.verifyLocally` → VALID / INVALID / REVOKED reason.
- **Dashboard**: paste the raw QR text → `verifyCertLocal` recomputes the
  chain, verifies the ECDSA signature with WebCrypto, and cross-checks the
  imported ledger. No network leaves the browser.

## Production hardening (for departmental rollout)

1. Off-device signed chain state (e.g., a printed hash log at the HR office)
   so auditors can confirm the ledger tail.
2. Key rotation / worker-card re-issuance on device loss.
3. A central registry is optional — the export already provides an audit trail.