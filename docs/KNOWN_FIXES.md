# Known gaps & build-fix list

Status of things that cannot be validated on this dev machine (no JDK/Android
SDK) until the first **GitHub Actions** run, plus deliberate simplifications.

## Loophole audit — fixed (2026-09-24)

- `CertificateEngine.kt`: removed an orphaned duplicate `private fun buildPayload(`
  declaration (was a hard syntax error) and a `synced = false` arg that no longer
  matched `CertificateEntity`.
- Self-verification bug: the signed payload previously used a random UUID as
  certNo while the QR carried the human-readable `SRK-…` certNo, so the hash-chain
  and ECDSA signature could *never* re-verify. `generate()` now derives certNo
  from a provisional payload (no certNo field) and signs the payload containing
  the final certNo, making the payload fully deterministic from the QR fields.
- Ledger lookup in `verifyLocally()` used `get(id)` (id was the UUID primary key)
  so even genuine certificates returned `NOT_IN_LEDGER`. Added
  `CertificateDao.getByCertNo(certNo)`; `verifyLocally()` is now `suspend`.
- Certificate double-issue: re-entering the result screen could mint duplicates.
  `SessionRepository.issueCertificate()` now reuses the most recent cert for the
  same worker+module+score within a 5-minute window; the screen only marks
  "issued" after a successful write.
- AR evidence loophole: the AR evidence question auto-granted full credit just by
  being displayed. Evidence is now reconstructed from the real `ar_events` table
  (task completed correctly in the player); a pending AR question cannot be
  advanced until evidence exists.
- MATCH question could be "answered" after a single pairing and auto-advanced.
  It now accumulates all pairings locally and only submits when every item is
  paired.
- Manifest hardening: dropped unused `INTERNET`, `ACCESS_NETWORK_STATE`,
  `ACCESS_WIFI_STATE`, `POST_NOTIFICATIONS`; `android:allowBackup=false` (worker
  PII/certificates not exfiltrated via cloud/ADB restore).
- `AppDatabase` still uses `fallbackToDestructiveMigration()`. Safe today (v2 has
  never shipped), but any future version bump MUST add an explicit
  `RoomDatabase.Callback`/`Migration` first, or an upgrade will wipe the ledger.

## Must verify on first CI run

1. `android/app/src/main/java/com/suraksha/trainer/ar/ArSessionHost.kt`
   - SceneView API surface (version 2.1.1) called defensively inside
     `runCatching`; check exact names/params compile.
   - TRACKING cameras + ARCore optional-mode path.
2. `android/app/src/main/java/com/suraksha/trainer/cert/QrDecoder.kt`
   - ZXing `MultiFormatReader` + CameraX `ExperimentalGetImage` under Kotlin 2.0.
3. `android/app/src/main/java/com/suraksha/trainer/core/ExportManager.kt`
   - MediaStore `Downloads` insert + `RELATIVE_PATH` on API 29–35.
4. Gradle wrapper jar (8.11.1) + AGP 8.7.3 compat.

If any fail, they are isolated; fixes are one-liners. Everything else is
dependency-safe (Room, Compose BOM, CameraX).

## Intentional simplifications (release-blocking, not build-blocking)

- Placeholder GLBs are 3-colour boxes; swap in real Blender assets in
  `android/app/src/main/assets/models/` (same filenames).
- Santali (`values-sat`) strings are a **translator template** — must be
  reviewed by a native speaker before display to learners.
- Revocation is on-device only (site-supervisor authority). A distributed
  registry is a future add-on; the export gives an audit trail meanwhile.
- The export JSON is plain text — encrypted/auto-uploaded delivery is a v1.1
  option if a site wants belt-and-braces.
- `verify-cert` browser path uses `crypto.subtle` (requires HTTPS or localhost).

## Open acceptance items

- Demo video (chapter script in README, recorder: scrcpy / OBS).
- Building the APK on GitHub Actions (push repo, open Actions → debug APK
  artifact) — no developer machine required.