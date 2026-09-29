# Kaavach — AR Vocational Safety Certification (Jharkhand)

**AR-based vocational training & safety certification for mining, steel & mica workers in Jharkhand.**

Works 100% offline on mid-range Android 10+ phones. No server, no sign-up —
all data lives in the on-device **SQLite database** (Room). Modules cover
**Fire & Explosion Response**, **Gas Leak & Confined Space**, plus 3 more
domains. On-device assessment + QR certificates form a **tamper-evident
hash-chain ledger** that can be verified locally or on any PC through the
included offline dashboard.

> सुरक्षा (Suraksha) = "Safety" · 🇮🇳 हिन्दी / सन्ताली (Ol Chiki) 🟦🟨🟥

## How it works (no server)

1. Worker registers on a phone (offline). Data is saved to SQLite locally.
2. Learn via AR + theory, answer assessment (all on-device).
3. Passing issues a signed QR certificate (ECDSA key in Android Keystore,
   chained: `chain_hash = sha256(prev_hash | payload)`).
4. Verify anytime: in-app camera scan, or paste the QR text.
5. **Profile → Export site data** saves a JSON of workers/attempts/certs to
   Downloads. Copy it to a PC and import it in the offline dashboard for
   reports + re-verification. That's the whole "backend".

## What's inside

| Folder | What it is |
|---|---|
| `android/` | Native Kotlin + Jetpack Compose app (ARCore + SceneView AR, Room/SQLite) |
| `dashboard/` | Offline React + TypeScript + Tailwind admin dashboard (imports export JSON) |
| `scripts/` | Asset pipeline (placeholder GLB generator) |
| `.github/workflows/` | CI: Android build/tests + APK artifact, dashboard build |

## Key features (deliverable checklist)

- [x] 2 complete AR training modules (JSON-driven content packs)
- [x] On-device assessment engine (offline scoring rules, pass mark 80)
- [x] Fully offline: airplane mode works end-to-end (Room + bundled content + GLBs)
- [x] QR certificate generation (Android Keystore ECDSA signing) + hash-chain ledger
- [x] Verification: in-app camera scan + offline dashboard verify (recomputes chain + signature in browser)
- [x] Localization: **Hindi (`values-hi`)** and **Santali Ol Chiki (`values-sat`)** + Noto Sans Ol Chiki bundled
- [x] Offline web admin dashboard (compliance %, CSV export)
- [x] GitHub Actions CI + demo video instructions

## Quick start

### Prerequisites
- Android Studio (for local APK builds) — CI builds the APK for you too
- Node.js 20+ (dashboard, optional)

### 1. Build the Android app
```bash
cd android
./gradlew :app:assembleDebug   # APK at app/build/outputs/apk/debug/
```
No credentials, no config file needed. The app is complete offline on install.

### 2. Admin dashboard (offline)
```bash
cd dashboard
npm install
npm run dev          # open http://localhost:5173
```
Import a `suraksha_export_*.json` (exported from the app's Profile screen) —
no server, everything runs in the browser.

## Demo video (10 chapters · ≤3 min)
Record on a mid-range Android phone (ARCore certified); capture screen with
scrcpy (`scrcpy --no-audio --stereo on`) and mic. Chapters:

1. **Bumper (0:00–0:05)** — app open on Home; show "Suraksha Trainer".
2. **Offline-first (0:05–0:25)** — toggle airplane mode; open **Fire & Explosion
   Response** → theory step renders, no network spinner. Narrate in Hindi.
3. **AR discovery (0:25–0:50)** — first AR task: point camera at table, see
   the fire extinguisher placeholder; tap the correct zone (Indicator Match).
4. **Assessment (0:50–1:10)** — on-device quiz (MC, True/False, sequence) → PASS.
5. **Certificate (1:10–1:25)** — passing issues cert; show the QR + hash-chain
   fields (prevHash/chainHash).
6. **Verification (1:25–1:45)** — in-app scan of the just-issued QR → VALID.
7. **Reject flow (1:45–2:00)** — tweak one character in cert text →
   INVALID (chain mismatch).
8. **Localization (2:00–2:10)** — switch app language to सन्थाली (Ol Chiki);
   show the bundled font rendering.
9. **Export (2:10–2:20)** — Profile → Export site data; file appears in Downloads.
10. **Dashboard (2:20–2:50)** — open the offline dashboard, import the JSON,
    see workers/attempts KPIs + verify the QR from step 6.
CTA overlay: repo link + "Offline-first tamper-evident QR ledger — Eng, हिन्दी & सन्थाली".

## Docs
- [Architecture](docs/ARCHITECTURE.md) · [Verification model](docs/VERIFY.md) · [Known gaps / build-fix list](docs/KNOWN_FIXES.md)

## License
MIT — see [LICENSE](LICENSE).
