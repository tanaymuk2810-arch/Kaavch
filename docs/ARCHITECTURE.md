# Kaavach — Architecture

A tamper-evident, fully-offline AR training and compliance system for mining
and manufacturing safety in Jharkhand. **No server, no cloud, no credentials.**

```
┌────────────────────────────────────────────────────────┐
│ Android app (Kotlin + Compose)                        │
│                                                        │
│  UI: Onboarding → Register → Home → Module Player →     │
│       Assessment → Certificate → Verify (camera)        │
│                                                        │
│  On-device everything:                                  │
│   · Room (SQLite) — workers, modules, progress,        │
│     attempts, ar_events, certificates                  │
│   · Bundled trilingual JSON content + placeholder GLBs │
│   · AssessmentEngine — MC/T-F/SEQ/MATCH/AR_EVIDENCE    │
│   · CertificateEngine — Android Keystore ECDSA P-256,  │
│     hash-chain ledger, ZXing QR code                   │
│   · QrDecoder (CameraX) — scan-to-verify               │
│  ┌──────────────────────────────────────────────┐      │
│  │ ExportManager → Downloads/kaavach_export_*.json    │
│  └──────────────────────────────────────────────┘      │
└─────────────────────────┬──────────────────────────────┘
                          │ copy file to a PC (USB/cloud drive)
                          ▼
┌────────────────────────────────────────────────────────┐
│ Offline web dashboard (React + TS + Tailwind +        │
│ Recharts) — runs fully in the browser                 │
│  · Import export JSON → KPIs, sites, workers, ledger  │
│  · verifyCertLocal: recompute chain + WebCrypto ECDSA │
│  · CSV exports for DGMS reporting                     │
└────────────────────────────────────────────────────────┘
```

## Certificate chain

- Genesis: `GENESIS-` + 64 × `0`.
- Chain rule: `chain_hash[i] = sha256(prev_hash[i-1] | payload[i])`.
- Payload: `suraksha-trainer/v1|certNo|workerId|moduleId|score|issuedAt|siteName`.
- QR payload is 11 fields; last three are `prevHash|chainHash|publicKey|signature`.
- Any single-character edit breaks the recomputed chain → verification fails.
- Signature binds the certificate to the device's Keystore public key.

## Why offline-first SQLite (vs a cloud DB)

- Mining/steel sites in Jharkhand have poor, intermittent connectivity.
- Zero server cost and zero ops: works with one phone or a hundred.
- Data travels as a portable JSON export, so DGMS auditors can review
  compliance on any laptop without giving anyone access to a database.

## Key components

| Path | Purpose |
|---|---|
| `android/app/src/main/java/com/suraksha/trainer/` | Kotlin app |
| `…/core/AppContainer.kt` | manual DI hub |
| `…/core/ExportManager.kt` | SQLite → JSON export to Downloads |
| `…/cert/CertificateEngine.kt` | signing, chain, QR assembly, local verify |
| `…/cert/QrDecoder.kt` | CameraX + ZXing scan |
| `…/assessment/AssessmentEngine.kt` | on-device scoring |
| `…/module/ModuleContentLoader.kt` | JSON pack + GLB loading |
| `…/data/db/` | Room schema, DAOs, entities |
| `…/ar/ArSessionHost.kt` | SceneView AR bridge (graceful fallback) |
| `dashboard/src/lib/verify.ts` | browser port of the chain + ECDSA verify |
| `dashboard/src/lib/store.ts` | import/state of the exported JSON |

## Local demo without Android Studio

- APK: CI builds it (`.github/workflows/android-ci.yml`); install on any
  Android 10+ phone.
- Dashboard: `npm --prefix dashboard install && npm --prefix dashboard run dev`.