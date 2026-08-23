# Q-Trust

**Multi-tenant SaaS for managing Quranic associations and memorization (Hifz) schools.**

Q-Trust is a full attendance, scheduling, billing, and student-management platform built for Tunisian Quranic associations and private schools. Attendance is captured by scanning student QR codes from a tablet, and everything else — students, families, teachers, rooms, schedules, payments, grades, documents, and reports — is managed from a web dashboard. It ships with a Groq-powered AI admin assistant, a public marketing/enrollment site, and a native tablet scanner app.

The product is sold B2B through direct field sales in Tunisia and billed locally (bank transfer / cheque / cash), while running on real multi-tenant SaaS infrastructure with subscription plans and per-tenant entitlements.

> بسم الله الرحمن الرحيم — ﴿ إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ ﴾

---

## Repository layout

This is a two-application repository:

| Path | What it is | Stack |
|------|-----------|-------|
| [`q-trust/`](q-trust) | The web SaaS — dashboard, APIs, marketing site, AI assistant | Next.js 16 (App Router), React 19, MongoDB/Mongoose, NextAuth v5 |
| [`q-trust-app-scanner/`](q-trust-app-scanner) | The tablet QR scanner app used at the door | Expo SDK 54, React Native, Expo Router, Zustand |
| [`plan.md`](plan.md) | The grounded engineering/product plan (audit findings + phased roadmap) | — |

Each sub-project also has its own README ([web](q-trust/README.md), [scanner](q-trust-app-scanner/README.md)) — this file is the top-level overview of the whole system.

---

## Architecture at a glance

```
┌──────────────────────────┐         ┌──────────────────────────────────────┐
│  Tablet Scanner (Expo)   │         │            Web app (Next.js)           │
│  q-trust-app-scanner     │         │              q-trust                   │
│                          │         │                                        │
│  expo-camera → QR scan   │ HTTPS   │  /(marketing)  public site + enroll    │
│  x-device-token auth     │────────▶│  /super-admin  platform operator       │
│  POST /api/attendance/   │  REST   │  /admin        tenant staff dashboard  │
│       check-in           │         │  /teacher      teacher portal          │
└──────────────────────────┘         │  /student      student portal          │
                                      │  /scanner      browser-based scanner   │
                                      │  /t/[slug]     tenant public page      │
                                      │  /api/**       REST API (tenant-scoped)│
                                      └───────────────┬────────────────────────┘
                                                      │
                        ┌─────────────────────────────┼───────────────────────────┐
                        ▼                             ▼                             ▼
                 ┌────────────┐              ┌─────────────────┐          ┌────────────────┐
                 │  MongoDB   │              │  Cloudinary     │          │  Groq (LLM)    │
                 │ (Mongoose) │              │  file storage   │          │  AI assistant  │
                 └────────────┘              └─────────────────┘          └────────────────┘
                        │                             ▲
                        │                    ┌────────┴────────┐
                        └────────────────────│  Upstash Redis  │  rate limiting
                                             └─────────────────┘
```

**Multi-tenancy model:** a single shared MongoDB database with a `tenantId` field on every domain model (all 28 models carry it). Every API route and server-component page scopes its queries by the current tenant. There is no database-per-tenant. See [multitenancy-patterns memory / `lib/tenant.ts`](q-trust/lib/tenant.ts).

**Roles:** `SUPER_ADMIN` (platform operator, cross-tenant), `ADMIN` (the association's staff), `TEACHER`, `STUDENT`.

---

## Feature overview (web app)

### Platform operator — `/super-admin`
- **Tenant management** — create/suspend associations, assign subscription plans
- **Billing** — invoices, plan tiers (`STARTER` / `STANDARD` / `PREMIUM`), local payment tracking
- **Leads** — inbound sales leads from the marketing site

### Association admin — `/admin`
- **Dashboard** — attendance/enrollment stats and charts
- **Students & Families** — enrollment with printable unique QR codes, family grouping and billing
- **Teachers & Substitutes** — accounts, substitute assignment workflow
- **Schedule & Rooms** — weekly session templates, room/schedule conflict detection, auto-assign
- **Attendance** — records, attendance claims/corrections, CSV export
- **Subscriptions & Payments** — monthly payments, family billing, invoices
- **Admissions** — public enrollment applications pipeline
- **Documents** — learning-document library (Cloudinary-backed)
- **Messaging & Notifications** — outbound messages and message logs
- **AI Assistant** — Groq-powered admin agent with dozens of callable tools and a **human-approval workflow for any write action**
- **Analytics** — reporting across the institution
- **Settings** — enrollment numbering, attendance windows, branding, scanner devices

### Teacher — `/teacher`
- Personal dashboard, assigned sessions, attendance editing, evaluations/feedback, per-session analytics

### Student — `/student`
- Dashboard, schedule, attendance history, Hifz/performance tracking, documents, leaderboard

### Public — `/(marketing)`, `/enroll`, `/t/[tenantSlug]`
- Trilingual marketing site (Arabic / French / English), online enrollment, and per-tenant public pages
- Extras: `/(display)/tv` (TV/kiosk display), `/(print)/receipt` (printable receipts)

---

## Tech stack

### Web app (`q-trust/`)
| Area | Technology |
|------|-----------|
| Framework | **Next.js 16** (App Router) + **React 19** + TypeScript |
| Database | **MongoDB** via **Mongoose 9** |
| Auth | **NextAuth v5** (JWT sessions, bcrypt password hashing) |
| i18n | **next-intl** — Arabic, French, English (`messages/{ar,fr,en}.json`) |
| Styling | **Tailwind CSS 4** (CSS-first, no config file) + **shadcn/ui** (Radix) |
| Data layer | **TanStack Query** |
| Validation | **Zod** |
| AI | **Groq SDK** (`llama-3.3-70b-versatile`) |
| Rate limiting | **Upstash Redis** (`@upstash/ratelimit`) |
| File storage | **Cloudinary** |
| QR | `qrcode` (generate) + `html5-qrcode` (browser scan) |
| Charts / motion | Recharts, Motion, Lenis |

### Scanner app (`q-trust-app-scanner/`)
| Area | Technology |
|------|-----------|
| Framework | **Expo SDK 54** + **React Native 0.81** + TypeScript |
| Navigation | **Expo Router** (file-based) |
| State | **Zustand** (with `persist`) |
| Data | **TanStack Query** + Axios |
| Camera | `expo-camera` |
| Storage | `expo-secure-store` (device token) |
| Animation | React Native Reanimated |

---

## Getting started

### Prerequisites
- **Node.js 18+**
- **MongoDB** (local or Atlas)
- **npm** (this project uses npm, not pnpm — a `package-lock.json` is committed)
- Accounts for **Cloudinary**, **Groq**, and **Upstash Redis** (for full functionality)

### 1. Web app

```bash
cd q-trust
npm install
# create .env.local (see below)
npm run seed        # optional: demo data
npm run dev
```

The app runs at `http://localhost:3000`.

#### Environment variables (`q-trust/.env.local`)

```env
# Database
MONGODB_URI=mongodb://localhost:27017/q-trust

# NextAuth  (generate a 32+ char secret, e.g. `openssl rand -base64 32`)
NEXTAUTH_SECRET=your-super-secret-key-32-chars-minimum

# Scanner device auth (shared with the tablet app / browser scanner)
SCANNER_DEVICE_TOKEN=your-scanner-secret-token

# AI assistant
GROQ_API_KEY=your-groq-api-key

# Rate limiting
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token

# File uploads (https://cloudinary.com/console)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Public site URL (used for absolute links / QR payloads)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> **Security note:** `SCANNER_DEVICE_TOKEN` is server-side only — never expose it via a `NEXT_PUBLIC_` variable. A previous public-token leak was fixed; keep it server-side.

#### npm scripts (web)

```bash
npm run dev                 # start dev server
npm run build               # production build
npm run start               # run production server
npm run lint                # ESLint
npm run seed                # seed demo data
npm run create-super-admin  # create a platform SUPER_ADMIN account
npm run test-db             # verify MongoDB connectivity
```

### 2. Scanner app

```bash
cd q-trust-app-scanner
npm install
npm start          # Expo dev server
npm run android    # run on Android (tablet recommended)
npm run ios        # run on iOS (macOS only)
```

On first launch the app asks for a **server environment** and a **device token** (must match `SCANNER_DEVICE_TOKEN`). See the scanner README for emulator/adb testing notes; orientation must stay `default`.

---

## Project structure (web app)

```
q-trust/
├── app/
│   ├── (marketing)/        # public site — (ar) default, /fr, /en, /enroll
│   ├── (display)/tv/       # TV/kiosk display
│   ├── (print)/receipt/    # printable receipts
│   ├── super-admin/        # platform operator (tenants, billing, leads)
│   ├── admin/              # tenant staff dashboard (students, schedule, AI, …)
│   ├── teacher/            # teacher portal
│   ├── student/            # student portal
│   ├── scanner/            # browser-based QR scanner
│   ├── t/[tenantSlug]/     # per-tenant public page
│   ├── auth/               # login, onboarding, error
│   └── api/                # REST API (all tenant-scoped)
├── components/             # ai-assistant, charts, layout, marketing, providers, ui
├── lib/
│   ├── auth.ts             # NextAuth config
│   ├── db.ts               # cached Mongoose connection
│   ├── tenant.ts           # tenant resolution & scoping
│   ├── entitlements.ts     # plan/feature gating
│   ├── rate-limit.ts       # Upstash rate limiting
│   ├── scanner-auth.ts     # device-token verification
│   ├── ai/                 # Groq client, tools, tool-executor, system prompt
│   └── …                   # analytics, enrollment, family-billing, leaderboard, …
├── models/                 # 28 Mongoose models, all with tenantId
├── messages/               # ar.json / fr.json / en.json (i18n)
├── i18n/                   # next-intl config
└── scripts/                # seed, create-super-admin, test-db
```

### Data model highlights
`Tenant`, `Branch`, `User`, `Student`, `Family`, `SessionTemplate`, `SessionOccurrence`, `StudentSession`, `Attendance`, `AttendanceClaim`, `Room`, `Grade`, `HifzLog`, `BehaviorLog`, `TeacherFeedback`, `SubstituteAssignment`, `LearningDocument`, `MonthlyPayment`, `Invoice`, `Lead`, `AdmissionApplication`, `Notification`, `MessageLog`, `Conversation`, `AiUsageLog`, `ScannerDevice`, `Settings`, `ActivityLog`. Every domain model is scoped by `tenantId`.

---

## Scanner → API integration

The tablet (and the browser scanner) authenticate with a device token header and post scanned QR UUIDs to the attendance endpoint:

```http
POST /api/attendance/check-in
Content-Type: application/json
x-device-token: <SCANNER_DEVICE_TOKEN>
x-device-id: <device-uuid>

{ "qrUuid": "student-uuid", "scannedAt": "2026-08-21T12:00:00.000Z" }
```

On success the API returns the matched student and session plus a bilingual confirmation message (an Islamic greeting) that the tablet displays.

---

## Internationalization

The web app is fully trilingual via **next-intl**:
- **Arabic** (RTL, default), **French**, **English**
- UI strings live in [`q-trust/messages/`](q-trust/messages) (`ar.json` / `fr.json` / `en.json`)
- Marketing routes are split by locale: `(ar)` (default at `/`), `/fr`, `/en`

---

## Security & multi-tenant safety

- Passwords hashed with **bcryptjs**; sessions via NextAuth JWT
- Every API route and server page **scopes queries by `tenantId`** — no cross-tenant reads/writes
- Role checks on admin/teacher/student layouts and write endpoints
- **Rate limiting** (Upstash) on login, the AI chat endpoint, and QR check-in
- Scanner device token is **server-side only**
- AI assistant **requires human approval** before executing any write tool

See [`plan.md`](plan.md) for the full audit history and the phased roadmap that these fixes came from.

---

## Deployment

The web app deploys to **Vercel** (production: `q-trust-saas.vercel.app`). Notes:
- Root directory: `q-trust`
- Install with **npm** (not pnpm)
- Set the full environment-variable set above in the Vercel project
- The scanner app is distributed as an Expo/EAS build to Android tablets

---

## License

- **Web app** — MIT (see `q-trust/README.md`).
- **Scanner app** — Private / all rights reserved.

---

<div align="center">
صُنع بـ ❤️ في تونس — Made with care in Tunisia · <strong>Q-Trust</strong>
</div>
