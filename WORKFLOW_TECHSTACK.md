# AR Vocational Safety Training Simulator — Complete Workflow & Tech Stack

**Project:** AR-based vocational training & safety certification platform for Jharkhand's mining/manufacturing sector
**Deliverables:** Android APK (2+ AR modules), assessment engine, QR certificates + verification, Hindi/Santali localization, offline-first, web admin dashboard, demo video, public GitHub repo.

> **DECISION (final):** This plan was written against an earlier hosted-backend
> stack. The **shipped build is fully offline** — Android uses Room/SQLite as
> the single database, and the admin dashboard runs locally in the browser by
> importing an exported JSON file (no Supabase, no Node backend, no Docker).
> Backend/cloud/Docker sections below are superseded; see `README.md` and
> `docs/ARCHITECTURE.md` for the current architecture.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ANDROID APP (worker phone)                   │
│  Kotlin · min SDK 29 (Android 10) · native · no headset required      │
│                                                                       │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ RAEngines  │  │ ARCore+      │  │ Assessment   │  │ Localization│ │
│  │ Canvas     │  │ SceneView    │  │ Rules Engine │  │ hi / sat    │ │
│  │ (on-device)│  │ (markerless) │  │ (JSON rules) │  │ (Ol Chiki)  │ │
│  └────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────────────┐   │
│  │ Room (SQL) │  │ Play Asset   │  │ Certificate Engine           │   │
│  │ profiles,  │  │ Delivery     │  │ Keystore-signed QR + hash-  │   │
│  │ scores     │  │ (offline DL) │  │ chain → tamper-evident       │   │
│  └────────────┘  └──────────────┘  └─────────────────────────────┘   │
│                                                                       │
│  WorkManager ── offline-first sync queue ── retries on connectivity   │
└─────────────────────────────────────────────────────────────────────┘
                                  │ HTTPS / JWT (offline-capable)
┌─────────────────────────────────▼───────────────────────────────────┐
│                        BACKEND (cloud / on-prem)                     │
│  Node.js + Express (or Django REST)                                  │
│  PostgreSQL  → workers · sites · certificates · hash-chain ledger    │
│  Redis       → session / cache                                       │
│  MinIO (S3)  → AR asset bundles                                      │
│  Auth: JWT + RBAC (worker · supervisor · DGMS auditor · admin)       │
└─────────────────────────────────────────────────────────────────────┘
                                  │ HTTPS
┌─────────────────────────────────▼───────────────────────────────────┐
│                  WEB ADMIN COMPLIANCE DASHBOARD                       │
│  React + Tailwind · Recharts · PDF lib + SheetJS (DGMS export)        │
│  Views: site-wise compliance %, worker status, cert search + verify   │
│  Public certificate verification page (scan QR → validate)            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack by Component

| Component | Technology | Why |
|---|---|---|
| Mobile framework | **Kotlin, native Android (min SDK 29)** | Small footprint, best perf on mid-range; Unity/ARF adds 100MB+ APK |
| AR engine | **ARCore + SceneView** | Markerless plane detection; SceneView is the supported Sceneform successor |
| 3D assets | **Blender** (low-poly, <5k tris/object) | Fire extinguishers, cylinders, exit signage, machinery |
| On-device DB | **Room (SQL)** | Profiles, progress, assessment scores |
| Content delivery | **Play Asset Delivery** + APK bundles | Full module works with zero connectivity |
| Assessment engine | **Kotlin JSON rules engine** | Scoring config as JSON → runs fully on-device, no network |
| QR generation | **ZXing** | Encode signed payload; CameraX for scanning |
| Certificate signing | **Android Keystore + ECDSA keypair** | Tamper-evident local generation |
| Tamper-proof ledger | **Hash-chain on backend** (blockchain-style) | Lightweight; Hyperledger Fabric = upgrade path |
| Options included in payload | workerID, moduleID, score, timestamp, siteID | Standard across generation |
| Backend API | **Node.js + Express** (or Django REST) | Sync, registration, verification endpoints |
| Backend DB | **PostgreSQL** | Core relational data + certificate ledger |
| Cache | **Redis** | Sessions/cache |
| Asset storage | **MinIO (S3-compatible)** | Self-hostable bundles |
| Auth | **JWT + RBAC** | Worker / supervisor / DGMS auditor / super admin |
| Background jobs | **WorkManager** | Queued sync + auto-retry on Wi-Fi |
| Sync conflict | **Timestamp-based merge** | Multi-session training on one worker |
| Localization | `values-hi`, `values-sat` (Ol Chiki) + **Noto Sans Ol Chiki** bundled | Santali script not a default Android font |
| Audio narration | Pre-recorded hi + sat voiceovers | Low literacy → audio better than text |
| Admin dashboard | **React + Tailwind + Recharts** | Charts, tables, export |
| Export | PDF lib + **SheetJS** | DGMS regulatory reports (Excel) |
| CI | **GitHub Actions** | Build/lint/test APK on every push |
| Deployment | **Docker Compose** | Backend + Postgres demo spin-up |
| Repo | **Public GitHub** | Deliverable requirement |

---

## 3. Build Workflow (Phased, Ordered)

### Phase 0 — Foundation (Week 1)
1. Scaffold public GitHub repo (LICENSE, README, .gitignore, AGENTS.md).
2. Android Studio project: Kotlin, min SDK 29, Material3.
3. Backend skeleton: Node/Express + Postgres + Redis + MinIO via Docker Compose.
4. Set up GitHub Actions CI: lint → unit test → assembleRelease.

### Phase 1 — Auth & Data Layer (Week 2)
5. Room schema: Worker, Site, Module, Attempt, Certificate.
6. JWT + RBAC backend endpoints (register worker, supervisor, DGMS auditor).
7. Android offline-first auth (local profile + server sync).

### Phase 2 — AR Module Pipeline (Weeks 3–6)
8. ARCore integration + SceneView plane detection setup.
9. Blender: build low-poly asset packs (extinguisher, cylinder, signage, machinery).
10. Module layout as JSON `content.json` → drives module flow (DRY content pipeline).
11. **Module 1 — Fire & Explosion Response**: exit identification, extinguisher use, evacuation sequencing overlaid on real surroundings.
12. **Module 2 — Gas Leak & Confined Space**: hazard zone recognition, PPE selection, buddy-system procedures.
13. Play Asset Delivery packaging + offline bundle validation.

### Phase 3 — Assessment Engine (Week 7)
14. JSON scoring rules: pass marks per module, retake policy, competency profile.
15. On-device assessment flow + attempt history to Room.
16. Pass → triggers certificate generation.

### Phase 4 — Certificate System (Week 8)
17. Certificate engine: signed payload → ZXing QR (accessed offline in app).
18. Backend hash-chain ledger: each cert linked to previous hash → tamper-evident.
19. Web verification page: scan QR → validate signature vs public key → check revocation via backend.

### Phase 5 — Sync & Localization (Weeks 9–10)
20. WorkManager sync: push progress + certs on connectivity; timestamp merge for conflicts.
21. Hindi (`values-hi`) strings + audio.
22. Santali (`values-sat`) Ol Chiki strings + **Noto Sans Ol Chiki** bundled + audio.

### Phase 6 — Web Admin Dashboard (Week 11)
23. React + Tailwind shell; Recharts compliance charts.
24. Views: site-wise compliance %, per-worker status, certificate search/verify.
25. PDF + Excel export (DGMS format).

### Phase 7 — Integration & Release (Weeks 12–13)
26. End-to-end test: offline training → assess → certify → sync → verify on web.
27. Field test on 2–3 mid-range Android 10+ phones.
28. Release build (signed APK), demo video, final README + submission docs.

---

## 4. Cross-Cutting Rules

- **Offline-first everywhere**: full module (content + assets + assessment) must work with airplane mode on.
- **No external secrets**: Android Keystore for device keys; JWT + env-managed secret for backend.
- **Naming/l10n**: all UI strings externalized; audio in `res/raw`.
- **APK budget**: keep low-poly assets + language packs to stay lean for low-storage devices (`<100MB` target).

---

## 5. Environment Setup Checklist

- Android Studio (latest stable) + Android SDK 34/35, JDK 17.
- ARCore SDK dependency (`com.google.ar:core`) — ARCore-certified 2–3 mid-range test devices.
- Blender 3.x for asset export (.glb/fbx).
- Node.js 20 LTS + PostgreSQL 16 + Redis 7 + MinIO.
- Docker Desktop (Compose for backend demo).
- ZXing (`com.journeyapps:zxing-android-embedded` or ZXing core).
- CameraX (scanning) + Android Keystore APIs.
- Noto Sans Ol Chiki font (SIL OFL license — bundle in APK).
- Hindi + Santali (Ol Chiki) translators & voiceover artists.
- GitHub repo + Actions; OBS/CapCut or similar for demo video.

---

## 6. What Is Needed to Build the Entire Project

| Category | Items |
|---|---|
| Tooling | Android Studio, Kotlin, ARCore SDK, SceneView, Blender, Node.js/Django, Postgres, Redis, MinIO/S3, React |
| Libraries | ZXing, Room, WorkManager, CameraX, Android Keystore, Recharts, SheetJS, PDF lib, JWT lib |
| People | Android AR dev, backend dev, frontend dev, Blender artist, hi+sat translators, voiceover artists, safety-domain SME (DGMS/Mines Act 1952, Factories Act 1948) |
| Hardware | 2–3 ARCore-certified mid-range Android 10+ phones |
| Infra | GitHub repo + Actions, Docker (self-hosting backend), optional cloud (VPS/AWS) |
| Content | 5 safety domains, low-poly 3D assets, module JSONs, assessment banks, narration |
| Compliance | DGMS/Dhanbad accident data, Mines Act 1952, Factories Act 1948 references for module accuracy |