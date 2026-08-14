# Q-Trust → SaaS: Production Enhancement Plan

**Status:** Draft for execution · **Owner:** Malek (founder) · **Prepared:** 2026-08-12
**Scope:** `q-trust` (Next.js 16 web app) + `q-trust-app-scanner` (Expo mobile scanner)
**Audience:** Any engineer or AI coding agent picking up this repo cold. Every claim below was verified by reading the actual source (file:line references included) — this is not a speculative rewrite plan, it is a grounded one.

---

## 0. How to use this document

This plan is organized into **phases with priority tiers**, not calendar dates, because the go-to-market motion (direct field sales in Tunisia, cash/bank-transfer billing) is not on a fixed schedule. Each phase has:

- **Why** — the problem it solves, grounded in the audit findings.
- **What to build** — concrete deliverables, file paths, schema shapes.
- **Definition of Done** — how an agent knows the phase is actually finished.

Priority tiers (use these to sequence work when picking up a task):

| Tier | Meaning | Phases |
|---|---|---|
| **P0 — Fix now** | Correctness/security bugs that exist *today*, independent of SaaS. Must ship before onboarding a second real client, even a single-tenant one. | Phase 0 |
| **P1 — SaaS foundation** | Without this, there is no product to sell to more than one client. | Phases 1, 2, 3, 4 |
| **P2 — Competitive differentiation** | What makes associations pay instead of using a paper notebook or a generic tool. | Phase 5 |
| **P3 — Scale & polish** | Needed once you have real paying tenants, not before. | Phases 6, 7, 8, 9, 10 |

**Do not build P2/P3 features before P0/P1 are done.** The AI conversation that produced the source material for this plan repeatedly proposed exciting features (Q-Arena live events, gamification, WhatsApp bots) before fixing the fact that the app has zero tenant isolation and several live authorization bugs. That ordering would be a mistake — a feature-rich single-tenant app with a data-leak bug is worse than a boring, safe multi-tenant one.

**Two standards apply across every phase, not as a separate checkbox at the end:** §3.5 (Design & UX Quality Bar) and §12 (Performance, Scalability & Production Hardening). Every phase's "Definition of Done" should be read as also requiring those two sections' criteria — a multi-tenant feature that leaks no data but ships with an unbounded, unpaginated list query, or a screen with no designed empty/error state, is not actually done. These aren't polish items to defer; for a product being sold face-to-face against a live demo, and expected to hold up as tenants scale from tens to hundreds of students each, design credibility and performance headroom are part of the core deliverable, not decoration on top of it.

---

## 1. Executive Summary

Q-Trust is a working, well-built single-tenant school-management app for one specific Quranic association in Sfax. It has real depth: QR attendance, room/schedule conflict detection, a student portal, grades, a document library, and a genuinely sophisticated Groq-powered AI admin assistant with 43 callable tools and a human-approval workflow for writes. The product instinct is good. The engineering quality of the parts that exist is good.

But it is **architecturally single-tenant in every layer** — models, auth, queries, file storage, and the mobile app all assume exactly one organization exists. There is no landing page, no pricing page, no billing infrastructure, no multi-tenant data isolation, and several authorization gaps that are low-risk today (one association, trusted users) but become **data-leak and privilege-escalation bugs the moment a second tenant is onboarded**.

The business plan (confirmed by the user) is: **sell this as a proper multi-tenant SaaS with subscription plans**, monetized primarily through direct B2B field sales to Tunisian Quranic associations and private schools, billed via local bank transfer/check/cash (not international card-based self-serve checkout, at least initially), while still building the technical entitlement/plan infrastructure a real SaaS needs.

This plan sequences the work so that: (1) existing security bugs are fixed first, (2) the app becomes safely multi-tenant, (3) a sellable public-facing product (landing + pricing + billing tracking) exists, (4) the AI agent — the single most differentiated and most risky part of the codebase — is hardened for multi-tenant, cost-controlled, audited use, and only then (5) the roster of new vertical features (Hifz tracking, WhatsApp alerts, gamification, family billing, admissions, live events) gets built on a foundation that won't leak data between customers.

---

## 2. Current State — Verified Audit Findings

This section is the evidence base for every decision in this plan. All file:line references are from the actual codebase as of this audit.

### 2.1 Stack (confirmed via `q-trust/package.json`)

Next.js 16.0.7 (App Router) · React 19.2.0 · NextAuth 5.0.0-beta.30 · Mongoose ^9.0.1 · MongoDB · Tailwind CSS 4 (CSS-first config, no `tailwind.config.*`) · shadcn/ui (Radix primitives) · TanStack Query · Zod ^4.1.13 · Groq SDK ^1.1.2 (`llama-3.3-70b-versatile`) · Cloudinary · `html5-qrcode`/`qrcode`. Mobile: Expo SDK 54, `expo-camera` ~17, Zustand ^5 with `persist`, Axios.

### 2.2 Zero multi-tenancy, anywhere

Every one of the 16 Mongoose models (`User`, `Student`, `SessionTemplate`, `SessionOccurrence`, `StudentSession`, `Attendance`, `AttendanceClaim`, `ActivityLog`, `Conversation`, `Grade`, `LearningDocument`, `MonthlyPayment`, `Room`, `Settings`, `TeacherFeedback`) has **no `tenantId`/`organizationId` field**. A repo-wide search for `tenant|organization|associationId|schoolId` across the whole `q-trust` codebase returns exactly one hit, and it's a UI comment label, not a data concept (`app/admin/settings/page.tsx:610`).

Consequences already mapped by the audit:

- **Hard-blocking unique indexes** that will collide the instant a second org exists: `User.email` (`models/User.ts:28-31`), `Room.name` (`models/Room.ts:17-24`), `Settings.key` (`models/Settings.ts:38-44`, a single global key-value store — currently holds only the `enrollment` numbering config, `scripts/seed.ts:610-622`).
- **~70+ unscoped queries** across `app/api/**` that do full-collection scans with no ownership/org filter at all — e.g. `Student.find({})` (`app/api/students/route.ts:51`), `Room.find()` (`app/api/rooms/route.ts:27`), `User.find({ role: ROLES.TEACHER })` (`app/api/teachers/route.ts:26`), `Settings.find()` (`app/api/settings/route.ts:45`), the entire attendance-stats aggregation pipeline (`app/api/attendance/route.ts:19,33,59`), and the schedule conflict/auto-assign engines (`app/api/schedule/conflicts/route.ts:39`, `app/api/schedule/auto-assign/route.ts:35,46,52`). Only a handful of routes (session templates, grades, feedback, dashboard stats — roughly 4-5 files) do any row-level scoping at all, and that scoping is by `teacherId` (role-based ownership), not by organization.
- **`lib/db.ts`** caches a single global Mongoose connection to one `MONGODB_URI` (`lib/db.ts:42-134`) — compatible with a shared-database, `tenantId`-filtered multi-tenant model, *not* with a database-per-tenant model (that would require rearchitecting the connection-caching singleton).
- **Cloudinary storage is flat and unnamespaced**: three static folders (`q-trust/students/photos`, `q-trust/students/cin`, `q-trust/documents`, `lib/cloudinary.ts:15,24,33,42`) shared by every tenant, with a delete endpoint (`app/api/upload/route.ts:104-136`) that has no ownership check at all — any admin can delete any file by Cloudinary public ID.
- **`Settings`** is a single global singleton per `key`, and several things that *should* be per-tenant configuration are instead hardcoded constants in `lib/constants.ts`: `DEFAULT_QR_SETTINGS` (`:97-101`), `ISLAMIC_GREETINGS` (`:104-112`), `DECLARATION_TEXT` (`:54`, a legal declaration literally referencing "the association" in the singular), branding colors, and the domain-specific `ACTIVITY_AREAS` enum built around Quran memorization vocabulary.

### 2.3 Real, exploitable authorization bugs (independent of multi-tenancy — fix regardless)

| Bug | Location | Impact |
|---|---|---|
| **No role check at all** on a write endpoint | `app/api/sessions/[id]/attendance/route.ts:157` (PATCH) — only checks `if (!session)` | Any authenticated **STUDENT** can mark any student present/absent/late for any session. |
| **`app/teacher/layout.tsx` has no role check** | `app/teacher/layout.tsx:5-17` — only checks `if (!session)`, unlike the admin and student layouts | Any logged-in STUDENT or ADMIN can navigate directly into `/teacher/*` pages; whether the page then leaks data depends entirely on that page's own (inconsistent) API-level checks. |
| **Read endpoints check "logged in," not "authorized for this role"** | `app/api/students/route.ts:42` (all students, full PII), `app/api/payments/route.ts:16` (every family's payment status), `app/api/schedule/route.ts:17` (full institution schedule) | Any authenticated STUDENT can read data meant for staff only. |
| **Hardcoded NextAuth secret fallback** | `lib/auth.ts:140` — `process.env.NEXTAUTH_SECRET \|\| 'dev-secret-key-change-in-production-32-chars'` | If the env var is ever unset in a deploy, JWTs are signed with a secret visible in source control. |
| **Scanner token client/server mismatch** | Client reads `NEXT_PUBLIC_SCANNER_TOKEN` (`app/scanner/page.tsx:67`, `app/admin/settings/page.tsx:725`), which is **never defined** in `.env.local`; server checks `SCANNER_DEVICE_TOKEN`. They only match if someone manually mirrors the value into a `NEXT_PUBLIC_` var in the deploy platform — at which point it's visible in the client JS bundle to anyone who views source. | Weak, easily-misconfigured device auth for the one public unauthenticated write endpoint in the app. |
| **JWT sessions never re-validate `isActive` per request** | `lib/auth.ts` — `isActive` is checked only at login (`:72-74`); none of the sampled routes re-check it | Deactivating a user (or, post-SaaS, suspending a lapsed tenant) doesn't take effect for up to 24h (the JWT `maxAge`). |
| **Cloudinary delete has no ownership check** | `app/api/upload/route.ts:104-136` | Any ADMIN can delete any file by public ID, cross-tenant once multi-tenant. |
| **Unescaped regex in search queries** | `list_students`, `get_student`, `list_teachers`, `get_teacher`, `get_session`, `get_room` in `lib/ai/tool-executor.ts` (6 call sites) build `$regex` queries from raw search strings without `escapeRegex()`, even though that helper exists and *is* used elsewhere in the same file | Malformed/adversarial search input can cause incorrect matches or costly regex evaluation. |
| **5 AI write-tool paths skip Mongoose validators** | `update_attendance`, `mark_payment`, `bulk_mark_payments`, `review_claim`, `update_settings` in `lib/ai/tool-executor.ts` use `findByIdAndUpdate`/`findOneAndUpdate` without `{ runValidators: true }` (unlike `create_student`, `update_student`, `update_teacher`, `update_session`, `update_room`, which correctly set it) | A hallucinated or manually-edited LLM tool argument (e.g. `month: 13`, an out-of-enum `status`) can be written straight to MongoDB with no schema enforcement. |
| **No rate limiting anywhere** | Confirmed zero matches for `rate.?limit\|throttle\|quota` across the entire repo | Login, the AI chat endpoint, and the QR check-in endpoint are all brute-forceable/costly-to-abuse with no backoff. |
| **No security headers / CSP** | `next.config.ts` only configures `images.remotePatterns` | No `X-Frame-Options`, `Strict-Transport-Security`, CSP, etc. |
| **`registerModels()` is missing `Settings`** | `lib/db.ts:15-40` imports every model except `Settings` | Risk of `MissingSchemaError` on a cold serverless start if `Settings` is queried before another route has imported it. |

### 2.4 The AI agent — the most sophisticated and most risky subsystem

This deserves its own summary since the user specifically flagged it. Full detail is in Phase 3.

**What's genuinely good:** a real search→confirm→execute workflow enforced by the system prompt (`lib/ai/system-prompt.ts`), a clean read/write split (19 read-only tools auto-execute, 24 write tools always require human click-through approval via a `Conversation.pendingActions` subdocument), streaming SSE responses, tool-call retry logic for malformed Groq output, and sensible context-window trimming for long conversations (`lib/ai/conversation-manager.ts:224-302`).

**What's broken or missing, in order of severity:**

1. **No tenant scoping anywhere in `tool-executor.ts`.** Every one of the 43 tools queries the global collections directly. This is the same bug as §2.2 but concentrated in one 1069-line file — the highest-leverage single fix for multi-tenant AI safety.
2. **Authorization is checked once, at the route, never at the tool.** `executeTool(toolName, args, adminUserId)` takes no role/tenant/permission argument — it would execute identically for a forged `adminUserId`. There is one flat permission tier: any `ROLES.ADMIN` can call any of the 43 tools, including destructive ones, with no fine-grained permission model.
3. **No rate limiting or cost control.** Any admin can send unlimited messages and trigger unlimited tool calls (including expensive ones like the O(n²) conflict scan or an unbounded-date-range `generate_occurrences` call), with zero Groq cost tracking per tenant or per user.
4. **Prompt-injection surface via echoed free-text fields.** `get_student` returns the full raw document — including `address` and `notes`, both of which a STUDENT can set via `PATCH /api/student/profile` with only a length cap, no content filtering — directly into the model's context as a trusted `tool`-role message. A student could inject instruction-like text into their own `address` field that gets echoed into an admin's AI session later.
5. **Validation gaps** — see the `runValidators` and regex-escaping bugs in §2.3, both located inside this subsystem.
6. **Incomplete audit trail.** Only 6 of the 24 write tools call `logActivity()` (`STUDENT_CREATED/UPDATED`, `TEACHER_CREATED/UPDATED`, `SESSION_CREATED/UPDATED`); deletes, payments, claims, and settings changes triggered by the AI leave no trace in `ActivityLog` at all, and even the 6 that do log have no `source: 'ai_assistant'` marker distinguishing them from a human's manual action.
7. **Code duplication and drift.** `chat/route.ts` and `execute/route.ts` duplicate ~80% of their logic (the `TOOL_NAME_AR` map, `describeAction()`, `cleanArgs()`) with visible drift already (the two `TOOL_NAME_AR` maps disagree), and only `chat/route.ts` has retry logic for malformed tool calls.
8. **Minor correctness issues**: `create_student`'s enrollment-number logic reimplements ad hoc sequencing instead of using the existing `Settings`-driven `generateEnrollmentNumber()` helper, meaning AI-created students can get differently-formatted enrollment numbers than UI-created ones; Tunisia-timezone "today/tomorrow" resolution is implemented three separate times across two files with two different techniques.
9. **Zero test coverage** on the highest-complexity, highest-blast-radius subsystem in the app.
10. **An abandoned floating-drawer UI.** `AIProvider` fully implements `isOpen`/`toggleOpen()` state that no component ever renders — the actual UI is a full page at `/admin/ai-assistant`. Decide and finish one pattern.

### 2.5 No landing page, no marketing site, no pricing page — confirmed absent

`app/page.tsx` is a 24-line server component that does nothing but redirect based on session (`app/page.tsx:1-24`). There is no `pricing`, `about`, `features`, `blog`, `contact`, `terms`, or `privacy` route anywhere under `app/`. `middleware.ts:38-40` redirects any unauthenticated visitor at `/` straight to `/auth/login`. **This needs to be built from scratch** — there is nothing to adapt.

### 2.6 No billing/payment infrastructure — confirmed absent

`MonthlyPayment` tracking today is a manual admin checkbox toggle (`app/api/payments/route.ts`, `bulk/route.ts`) with no gateway. A repo-wide search for `stripe|paypal|braintree|checkout|payment_intent|flouci|paymee|konnect` returns zero matches, and no such SDK is in `package.json`. `app/admin/subscriptions/page.tsx` exists as a page but has no backing `/api/subscriptions` route — it's UI scaffolding with nothing behind it yet.

### 2.7 Hardcoded Arabic/RTL only, no i18n framework

`app/layout.tsx` sets `<html lang="ar" dir="rtl">` unconditionally. No `next-intl`/`next-i18next` package, no `messages/`/`locales/` directory, no `[locale]` route segment. RTL layout uses literal `right-0`/`mr-64` Tailwind utilities, not logical properties — flipping to LTR requires layout rework, not a flag flip. Every UI string, error message, and validation message is an inline Arabic literal.

### 2.8 No test infrastructure

No `jest`/`vitest`/`playwright`/`cypress` in `package.json`, no test files anywhere in the repo (confirmed by glob). `pnpm test-db` is a manual DB-connectivity smoke script, not a test suite.

### 2.9 Mobile scanner app (`q-trust-app-scanner`)

- **A live production API token is committed in plaintext** in `src/config/env.ts:8-24` (`SCANNER_TOKEN: 'Zt9Qh2FwLk7mR3cN1bX6pE8Vd5SgJ0aT4yWqH9uU3rM2nC7kF5sD1vP8gB4hY6'`), shipped inside every build's JS bundle.
- Server URL/token overrides are stored in **plain AsyncStorage**, not `expo-secure-store` (`src/store/deviceStore.ts:117-125`).
- The **Settings screen** (where the server URL and token can be viewed/changed) is reachable via an undocumented "tap the logo 5 times" gesture with **no PIN/password** (`app/scanner.tsx:67-78`).
- **No offline retry queue** — a failed check-in during a network outage is simply lost; the operator must notice and manually rescan (`app/scanner.tsx:176-195`).
- Branding (association name, colors) is hardcoded in JSX and `app.json`, not fetched from the backend — a different tenant would require a source fork and separate app-store listing under the current architecture.
- Dead code: an unused hook with a broken import (`src/hooks/useDeviceConfig.ts:9`, imports a function that doesn't exist), a fully duplicated unused scan-handler hook with subtly different logic than the live code path, unused `create-expo-app` template boilerplate, and a committed `dist/` build output folder.
- `eas.json` has no per-profile `channel` or `env` blocks — OTA updates (`expo-updates` is wired) cannot currently target different tenant fleets with different config.

---

## 3. Target Architecture

### 3.1 Multi-tenancy model: shared database, `tenantId`-scoped (not database-per-tenant)

**Decision:** every tenant lives in the same MongoDB database, distinguished by a `tenantId` field on every tenant-scoped document, enforced at the query layer. This is the right call for three concrete reasons grounded in the audit, not just convention:

1. `lib/db.ts`'s connection-caching singleton (`global.mongoose`) is built around exactly one live connection — a database-per-tenant model would require rearchitecting that caching layer entirely, for no benefit at this scale.
2. The realistic customer count for a Tunisian-associations B2B motion (tens to low hundreds of tenants in year one, not thousands) does not need the operational complexity of per-tenant databases.
3. It matches the earlier explicit decision in this project's own conversation history to reject the "one Vercel/Supabase deployment per client" approach in favor of a real SaaS — a shared, tenant-scoped database is the standard way to do that safely.

### 3.2 New core models

```ts
// Tenant — the association/school. Root of the multi-tenant tree.
interface ITenant {
  _id: ObjectId
  name: string                    // "جمعية المحافظة على القرآن الكريم"
  slug: string                    // URL-safe, unique — "quran-sfax" — used for public routes
  plan: 'STARTER' | 'STANDARD' | 'PREMIUM'
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED'
  trialEndsAt?: Date
  maxStudents: number              // enforced on create_student (UI + AI tool)
  aiQuotaMonthly: number           // 0 for Starter/Standard, e.g. 500 for Premium
  aiUsageCurrentMonth: number
  aiUsageResetAt: Date
  branding: {
    displayName: string
    logoUrl?: string
    primaryColor: string           // defaults to the existing Islamic green, overridable
    secondaryColor: string
    locale: 'ar' | 'fr' | 'en'     // default UI language for this tenant
  }
  contact: { email: string; phone: string; address?: string }
  billing: {
    setupFeePaid: boolean
    setupFeeAmountTND: number
    annualFeeAmountTND: number
    currentPeriodStart: Date
    currentPeriodEnd: Date
    paymentMethod: 'BANK_TRANSFER' | 'CHECK' | 'CASH' | 'CARD'
  }
  createdAt: Date
  updatedAt: Date
}

// Subscription/Invoice — the platform's own billing of the tenant (NOT the tenant's billing of families — see MonthlyPayment, unrelated).
interface IInvoice {
  _id: ObjectId
  tenantId: ObjectId
  type: 'SETUP' | 'ANNUAL_RENEWAL' | 'ADDON'    // e.g. PVC card printing add-on
  amountTND: number
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  dueDate: Date
  paidAt?: Date
  paymentMethod?: 'BANK_TRANSFER' | 'CHECK' | 'CASH' | 'CARD'
  referenceNumber?: string        // virement/chèque reference, entered by platform admin
  proofUrl?: string               // uploaded bank-transfer receipt / chèque scan
  notes?: string
  createdBy: ObjectId             // platform SUPER_ADMIN who recorded it
  createdAt: Date
}
```

Every existing tenant-scoped model (`User`, `Student`, `SessionTemplate`, `SessionOccurrence`, `StudentSession`, `Attendance`, `AttendanceClaim`, `ActivityLog`, `Conversation`, `Grade`, `LearningDocument`, `MonthlyPayment`, `Room`, `Settings`, `TeacherFeedback`) gains a required, indexed `tenantId: ObjectId` field. See Phase 1 for the full migration plan.

### 3.3 Roles

Add a 4th role, `SUPER_ADMIN` — the platform operator (you), distinct from a tenant's `ADMIN` (the association's director/staff). This is a schema-safe enum addition, but requires fixing the structural assumptions the audit found baked into exactly-3-roles logic (see Phase 1.6).

```ts
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',   // platform owner — cross-tenant access, billing, tenant provisioning
  ADMIN: 'ADMIN',               // tenant admin — this association's director/staff (unchanged meaning)
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
} as const
```

Do **not** introduce a separate `PARENT` role in this phase — the existing pattern (parent accesses the app through a `STUDENT`-role login tied to their child, per `models/Student.ts` parent fields and `app/api/admin/student-accounts/route.ts`) is adequate for now. Revisit only if Phase 5's Family model (§5.6) makes a true multi-child guardian login worth the complexity.

### 3.4 High-level shape after this plan

```
                              ┌─────────────────────────┐
                              │   Public marketing site  │  app/(marketing)/*
                              │  landing / pricing / demo │  — no auth required
                              └────────────┬─────────────┘
                                           │ lead capture / signup
                                           ▼
                              ┌─────────────────────────┐
                              │   Super-admin console    │  app/super-admin/*
                              │  tenant provisioning,     │  role: SUPER_ADMIN
                              │  billing, plan changes    │
                              └────────────┬─────────────┘
                                           │ creates Tenant + first ADMIN user
                                           ▼
        ┌──────────────────────────────────────────────────────────────┐
        │                     Shared Next.js app                        │
        │   every request resolves session.user.tenantId, then every    │
        │   Mongoose query is scoped { tenantId, ...existingFilters }   │
        │                                                                │
        │   app/admin/*      app/teacher/*      app/student/*           │
        │   (tenant-scoped, unchanged UX, now data-isolated)             │
        └──────────────────────────────┬─────────────────────────────┘
                                        │
                              ┌─────────▼─────────┐
                              │  Shared MongoDB     │
                              │  tenantId on every  │
                              │  tenant-scoped doc  │
                              └─────────────────────┘

        Mobile scanner app: pairs to ONE tenant per device via a
        QR-based provisioning flow (backend issues a scoped device
        token bound to tenantId), not a hand-typed shared secret.
```

### 3.5 Design & UX Quality Bar (cross-cutting — applies to every phase, not a one-time task)

**Why this gets its own section instead of a checkbox in a later phase:** design quality is not decoration layered on top of this product — it is a direct sales argument, and it needs to be treated with the same seriousness as the security fixes in Phase 0. The go-to-market motion in this plan is a director or committee deciding, in a ten-minute in-person demo, whether to trust a piece of software with their institution's money, minors' personal data, and their staff's daily workflow. The named competitors in this space (Alif Cloud, Qaf School, Dugsi Tech, Muntazim, and consumer tools like Kahoot/Mentimeter that the Q-Arena feature is meant to displace) all visibly invest in polish — a landing page or dashboard that reads as an internal engineering tool undercuts the "professional digital management system" pitch regardless of how correct the code underneath is. This also has a direct, measurable business value: a credible-looking product shortens the sales cycle (less time spent overcoming "does this look trustworthy" doubt) and justifies the setup/annual fee against the alternative of a free spreadsheet.

The good news, confirmed by the audit: the foundation is already better than average for a single-developer project. `app/globals.css` defines a real, considered token system (the Islamic green/gold/blue palette with full light+dark variants, a radius scale, an `Amiri` Arabic serif alongside `Geist`), the component layer is built on shadcn/ui over Radix primitives (which brings solid baseline accessibility and interaction behavior for free), and `app/globals.css:653` already correctly implements a `prefers-reduced-motion` media query, plus a page-fade transition already exists (`components/layout/page-transition.tsx`). The job in this section is to **protect and extend that existing quality bar** as the surface area grows across the super-admin console, landing page, and five new vertical features — not to invent a new visual language, and not to let the standard slip as scope grows.

**3.5.1 One design system, not five.** Every new screen (super-admin console in Phase 2, landing/pricing/demo pages in Phase 4, admissions form and TV leaderboard in Phase 5, substitute portal) is built from the existing shadcn/ui + Radix component library and the existing CSS custom-property tokens — no new component library, no inline one-off colors that drift from the token scale. The landing page is the one place a genuinely new *layer* of components will exist (hero sections, pricing cards, testimonial blocks) since none of that exists in the app today — build those as their own composable set, but source every color/radius/font from the same CSS variables as the dashboard. A future white-label/rebrand should mean editing `Tenant.branding` values, never hunting through two parallel design systems.

**3.5.2 Loading, empty, and error states are shipped features, not afterthoughts.** Every list/table view — and per §12.1 below, every one of them is also gaining pagination — needs three deliberately designed states, not just the happy path: a content-shaped skeleton (upgrade the existing generic-spinner `loading.tsx` files across `app/admin/**`/`app/teacher/**`/`app/student/**` to skeletons that mirror the eventual layout, reducing perceived load time), a real empty state with a call to action ("no students yet — enroll your first student," not a blank table), and an error state that says something actionable, not "an error occurred." This matters most on the screens a prospect or a nervous first-week admin will actually stare at: the admissions pipeline (5.7), the AI pending-actions list (Phase 3), and the super-admin billing dashboard (Phase 2).

**3.5.3 Accessibility floor: WCAG 2.1 AA, checked automatically, not eyeballed.** Current coverage is thin — a repo-wide check found explicit `aria-*`/`role` attributes in only 6 files across the entire `components/` tree (`sidebar.tsx`, `navbar.tsx`, `date-input.tsx`, `alert.tsx`, `file-upload.tsx`, `toast.tsx`). Radix primitives cover a lot of ground for free, but the custom, non-Radix components in that list need an explicit pass: full keyboard navigation through the sidebar and every data table, visible focus rings that hold up against the custom color palette (don't rely on browser defaults), and a contrast check on the tinted `admin-stat-tile--*` classes in both light and dark mode. Wire `axe-core` into the Phase 9 test suite so this is a checkable CI gate, not a subjective "looks fine."

**3.5.4 Light, purposeful animation — extend the existing discipline, don't add a heavy dependency for it.** No animation library (Framer Motion/`motion`/React Spring) is installed today, and that's fine — most of what this product needs is CSS transitions layered onto the `prefers-reduced-motion`-respecting foundation that already exists:
- **Add with plain CSS transitions/keyframes** (no new dependency): hover/press micro-states on interactive cards and buttons (subtle scale/shadow shift, ~100–150ms), a skeleton-to-content cross-fade instead of a spinner popping out, a verified entrance/exit animation on `components/ui/toast.tsx` (confirm it animates rather than appearing instantly), a success pulse/checkmark on the QR scanner's success state on **both** the web scanner (`app/scanner/page.tsx`) and the mobile app's result overlay — this is the single most-repeated interaction in the entire product (every check-in, every session, every day) and is worth making feel genuinely satisfying, and a number count-up on dashboard stat tiles on first render.
- **Reserve a real animation primitive for genuinely complex cases only**: the TV leaderboard's live rank-change reordering (5.3), any drag-and-drop redesign of the room/schedule auto-assign UI, and the marketing site's scroll choreography (§8.2 — the one surface where motion *is* the product pitch). If needed, adopt `motion` (the current package for what was Framer Motion; confirm React 19 compatibility at adoption time) and **lazy-load it only on the routes that use it** — the leaderboard display route or the `(marketing)` route group, never the shared admin bundle — so pages that don't need it never pay for it.
- **Never animate** in a way that delays task completion (no mandatory multi-second intros, no animated counters on numbers an admin needs to read quickly right now) or that ignores `prefers-reduced-motion` — extend the existing media query, never bypass it.

**3.5.5 Responsive by construction.** The admin/teacher dashboards are already used from classroom tablets (the scanner kiosk assumes tablet hardware); every new screen in this plan — super-admin console, admissions form, substitute portal, family/guardian view — is designed mobile-first and verified at mobile/tablet/desktop breakpoints before being called done. The landing page (Phase 4) will be opened on phones by prospects who received a shared link far more often than on desktop — treat mobile as its primary layout, not a secondary check.

**Definition of Done for this section (apply to every new screen in every phase):** has a designed empty/loading/error state; passes an automated `axe-core` check; respects `prefers-reduced-motion`; verified at mobile/tablet/desktop widths; uses only existing design tokens and components.

### 3.6 Branches — closing a gap between the pricing promise and the data model

The pricing structure in §6.4 sells Premium partly on "multi-branch support" (a large regional association running several physical locations under one administration), carried over directly from the earlier product-strategy discussion. But nothing in §3.2's new models, or in the existing 16 models, has any concept of a physical branch/campus distinct from the tenant itself — building Premium's headline feature without a home for it in the schema would mean re-doing Phase 1's migration work a second time. Add it now, alongside `Tenant`, not later:

```ts
interface IBranch {
  tenantId: ObjectId          // parent association — billing, plan, and admin ownership stay at this level
  name: string                // "الفرع الرئيسي - صفاقس", "فرع المنزل"
  address?: string
  isActive: boolean
}
```

`Room` and `SessionTemplate` gain an optional `branchId?: ObjectId` (nullable — a Starter/Standard single-location tenant never sets it, and every query treats "no branchId filter selected" as "all of this tenant's branches" so single-branch tenants see no UI change at all). `User` (specifically `TEACHER`) can optionally be scoped to a home branch for filtering convenience, without making it a hard access boundary — a teacher's actual authorization stays tenant + role + ownership as designed in Phase 1, since restricting a teacher's access *by branch* is a real feature an association might want later but isn't validated by anything in the current sales material; don't build that boundary speculatively.

The one thing this unlocks that's worth building deliberately: a **branch switcher** in the admin dashboard (a simple dropdown in the top nav, scoping the schedule/room/attendance views to the selected branch) and a **consolidated cross-branch view** on the dashboard stats page for the tenant's primary admin — this second piece is the actual "Premium multi-branch" value proposition from the sales pitch ("a large regional association gets one view across all its locations"), so don't stop at just adding the field; the consolidated view is the deliverable that's actually sellable.

---

## 4. Phase 0 — Fix What's Already Broken (P0, do this first, before anything else)

**Why:** these are real bugs today, in a single-tenant app used by real people. They get worse, not better, once multiple tenants exist, but they must not wait for the SaaS work to land.

### 4.1 Fix the missing-authorization bugs

- `app/api/sessions/[id]/attendance/route.ts` (PATCH, line ~157): add a role check (`ADMIN` or the `TEACHER` who owns the underlying `sessionTemplateId`) before allowing an attendance write. Add an ownership check — look up the session template's `teacherId` and compare to `session.user.id` unless the caller is `ADMIN`.
- `app/teacher/layout.tsx`: add the same `if (session.user.role !== ROLES.TEACHER) redirect(...)` pattern already used in `app/admin/layout.tsx` and `app/student/layout.tsx`.
- Audit every GET route flagged in §2.3 (`app/api/students/route.ts`, `app/api/payments/route.ts`, `app/api/schedule/route.ts`, and any others found by grepping for `if (!session)` without a following role check) and add explicit role gates — decide per-route whether STUDENT should see a redacted view (e.g., own-class schedule only) rather than blanket-denying, but never the current "any authenticated role sees everything" behavior.
- `app/page.tsx`: fix the silent fallthrough where any role that isn't `ADMIN` or `STUDENT` lands on the teacher dashboard — make it an explicit switch with a safe default (redirect to login / error) so a future `SUPER_ADMIN` role doesn't get misrouted.

### 4.2 Fix secrets and auth hygiene

- `lib/auth.ts:140`: remove the hardcoded fallback secret. Fail fast at boot (throw) if `NEXTAUTH_SECRET` is unset, instead of silently using a public string.
- Fix the `NEXT_PUBLIC_SCANNER_TOKEN` / `SCANNER_DEVICE_TOKEN` mismatch — see Phase 6 for the real fix (per-tenant device tokens); as an immediate patch, ensure the two env vars are actually kept in sync in the deployment config and documented, and note this is a stopgap until Phase 6 lands.
- Add a per-request `isActive` re-check for at least the most sensitive routes (payments, student PII, AI tools) rather than trusting the JWT for the full 24h session lifetime — or shorten `maxAge` as an interim mitigation.

### 4.3 Fix validation gaps

- Add `{ runValidators: true }` to the 5 identified unvalidated update paths in `lib/ai/tool-executor.ts`: `update_attendance`, `mark_payment`, `bulk_mark_payments`, `review_claim`, `update_settings`.
- Add `escapeRegex()` (already defined and used elsewhere in the same file) to the 6 identified unescaped search call sites: `list_students`, `get_student`, `list_teachers`, `get_teacher`, `get_session`, `get_room`.
- Add an ownership check to `DELETE /api/upload` — resolve the Cloudinary `publicId` back to the owning `Student`/`LearningDocument` record before allowing deletion.
- Add `Settings` to `registerModels()` in `lib/db.ts:15-40`.

### 4.4 Baseline hardening

- Add basic security headers via `next.config.ts`'s `headers()` function (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, a starter CSP).
- Add rate limiting to three endpoints minimum: `POST /api/auth/[...nextauth]` (login), `POST /api/attendance/check-in` (QR scanner), `POST /api/admin/ai-assistant/chat` (AI, cost-sensitive). Use a lightweight solution (`@upstash/ratelimit` with Upstash Redis, or an in-memory token bucket if staying serverless-simple initially — Upstash is recommended since it works from Vercel edge/serverless without a persistent process).

**Definition of Done:** every bug in the §2.3 table has a corresponding fix, committed and manually verified against the specific exploit scenario described in that table (e.g., confirm a STUDENT session gets a 403 from the attendance PATCH endpoint).

---

## 5. Phase 1 — Multi-Tenant Data Layer (P1)

**Why:** this is the foundation everything else depends on. Get this wrong and every subsequent feature inherits a data-leak risk.

### 5.1 Add `Tenant` model and `tenantId` to every existing model

Add the `ITenant` schema from §3.2 as `models/Tenant.ts`. Then, for each of the 16 existing models, add:

```ts
tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true }
```

And convert the flagged global-unique indexes to compound, tenant-scoped uniqueness:

| Model | Old index | New index |
|---|---|---|
| `User` | `email: { unique: true }` | `{ tenantId: 1, email: 1 }` unique |
| `Room` | `name: { unique: true }` | `{ tenantId: 1, name: 1 }` unique |
| `Settings` | `key: { unique: true }` | `{ tenantId: 1, key: 1 }` unique |
| `Student` | `qrUuid: { unique: true }` | Keep globally unique (UUID-based, collision risk is negligible, and a global-unique QR simplifies the mobile scanner's lookup) but **add `tenantId` to the document anyway** for filtering/reporting, and enforce the scanner's tenant boundary via the device token (Phase 6), not the QR itself. |

Also add `tenantId` (or a tenant-derived compound prefix) to the currently-global report indexes flagged in the audit: `Attendance.{createdAt,status}`, `AttendanceClaim.{status}`, `MonthlyPayment.{month,year,isPaid}`, `ActivityLog.{createdAt}`/`{type,createdAt}`, `LearningDocument.{isPublic}`/`{createdAt}`, `SessionOccurrence`'s QR-window compound index — each of these becomes `{ tenantId: 1, ...existingFields }`.

**Field order matters, not just field presence.** `tenantId` must be the **first** key in every one of these compound indexes, not appended at the end. MongoDB compound indexes are only efficiently usable as a prefix match — `{ tenantId: 1, status: 1 }` serves both "all of tenant X's records" and "tenant X's records with status Y" queries via one index; `{ status: 1, tenantId: 1 }` does not serve the first query efficiently at all. Since literally every query in this application will now filter by `tenantId` (it's the one predicate present on every single request), it should lead every compound index in the schema, with zero exceptions — get this wrong once and that collection silently falls back to a full collection scan under a tenant filter as data grows, which won't show up as a bug in testing with a handful of seeded tenants and will only surface as a production slowdown once real data volume exists.

### 5.2 Migrate `Settings` off hardcoded constants

Move these from `lib/constants.ts` into per-tenant `Settings` documents (keyed under the new compound `{tenantId, key}` uniqueness), with `lib/constants.ts` retaining only the *default* values used to seed a new tenant's settings on creation:

- `DEFAULT_QR_SETTINGS` → `Settings` key `qr_defaults`, editable per tenant in `app/admin/settings`.
- `ISLAMIC_GREETINGS` → `Settings` key `scanner_greetings` (or fold into `Tenant.branding` if it's purely cosmetic) — this also unblocks white-labeling for non-Quranic-vertical customers later.
- `DECLARATION_TEXT` → `Settings` key `enrollment_declaration`, since it's legally tenant-specific text.
- Branding colors → `Tenant.branding` (already modeled in §3.2), not `Settings`.

### 5.3 Build the tenant-scoping enforcement layer

This is the highest-risk part of the migration — the audit found ~70+ call sites that need a `tenantId` filter added. Two complementary mechanisms, both required:

1. **A `withTenant()` request helper** in a new `lib/tenant.ts`:
   ```ts
   export async function requireTenantSession() {
     const session = await auth()
     if (!session?.user?.tenantId) throw new UnauthorizedError()
     return session as SessionWithTenant
   }
   ```
   Every API route handler is updated to call this instead of bare `auth()`, and every subsequent Mongoose query in that handler gets `tenantId: session.user.tenantId` merged into its filter. This is manual, file-by-file work — there is no shortcut that's also safe, given how inconsistently the existing routes are written. Treat this as a checklist: go through every file listed in the API route inventory (Phase 1 Appendix, §12) and add the filter.

2. **A Mongoose plugin as a defense-in-depth backstop**, registered in `lib/db.ts`'s `registerModels()`:
   ```ts
   function tenantScopePlugin(schema: Schema) {
     schema.pre(/^find/, function (next) {
       if (this.getFilter().tenantId === undefined && !this.getOptions().skipTenantScope) {
         // Log a warning in dev; in production, consider throwing to fail loudly
         // rather than silently returning cross-tenant data.
       }
       next()
     })
   }
   ```
   This does not replace the manual filter work — Mongoose can't safely *inject* the correct `tenantId` on your behalf (it doesn't have access to the current request's session), but it **can catch the mistake of forgetting to scope a query**, either by warning loudly in development/CI or by refusing to run unscoped queries in production unless explicitly opted out (`.setOptions({ skipTenantScope: true })` for genuine platform-level cross-tenant queries, which should only ever appear in the super-admin console).

### 5.4 Update auth to carry `tenantId`

- `models/User.ts`: add `tenantId: ObjectId ref 'Tenant'` (required for `ADMIN`/`TEACHER`/`STUDENT`, absent/null for `SUPER_ADMIN`, who is cross-tenant by definition).
- `lib/auth.ts`: `authorize()`'s `User.findOne({ email })` must also disambiguate by tenant once the same email could theoretically exist across two tenants — recommended approach: **do not** ask the user to pick a tenant on a shared login form (bad UX for a B2B product where each association's staff only ever needs their own instance). Instead, use **tenant-specific subdomains or a tenant slug in the login URL** (`https://app.q-trust.tn/{tenantSlug}/login` or a wildcard subdomain `https://{tenantSlug}.q-trust.tn`), resolve `tenantSlug` from the URL server-side, and scope the `User.findOne({ tenantId, email })` lookup accordingly. This also gives you free per-tenant branding real estate (the login page can show that tenant's logo/name).
- Add `tenantId` (and ideally `tenantSlug`, `tenantPlan` for quick client-side feature-gating without an extra fetch) to the `jwt`/`session` callbacks and the `next-auth` type augmentation, alongside the existing `role`, `mustChangePassword`, `studentId` fields.
- `SUPER_ADMIN` accounts do not belong to a `Tenant` — model this as `tenantId: null` and make sure every tenant-scoping helper treats `SUPER_ADMIN` as a distinct code path (full cross-tenant access via the super-admin console only, never accidentally inheriting "no tenant filter" behavior inside the regular app routes).

### 5.5 Cloudinary namespacing

Change `uploadOptions` in `lib/cloudinary.ts` from a static object to a function of `tenantId`: `folder: `q-trust/${tenantId}/students/photos`` etc. Update the delete endpoint to resolve the owning tenant (via a DB lookup from `publicId` back to the record that stored it) and reject cross-tenant deletes.

### 5.6 Fix the exactly-3-roles assumptions before adding a 4th

Before shipping `SUPER_ADMIN`, fix the specific structural landmines the audit found:

- `app/page.tsx`'s redirect fallthrough (§4.1).
- Every raw string literal role check (`session.user.role !== 'ADMIN'` instead of `ROLES.ADMIN`) — grep and normalize to the constant so a future refactor doesn't miss a spot. Confirmed locations: `app/api/settings/route.ts:11,72`.
- `lib/validations.ts`'s `createUserSchema`/`updateUserSchema` currently hardcode `role: z.enum([ROLES.ADMIN, ROLES.TEACHER])` — decide explicitly that `SUPER_ADMIN` accounts are **never** created through this tenant-facing schema (they're provisioned exclusively through a separate, platform-only path — see Phase 2).

### 5.7 Data migration for the existing production tenant

The current live association becomes **Tenant Zero**:

1. Write a one-time migration script (`scripts/migrate-to-multitenant.ts`) that: creates a `Tenant` document for "جمعية المحافظة على القرآن الكريم - صفاقس" with `plan: 'PREMIUM'` (or whatever is fair given they're the founding customer) and a generated `slug`.
2. Backfills `tenantId` onto every existing document in every one of the 16 collections.
3. Rebuilds the indexes listed in §5.1 (drop the old unique index, create the new compound one) — **do this in a maintenance window**, not live, since dropping a unique index on a collection with active writes is the kind of operation that warrants a backup-first, verify-after approach per this project's operating norms.
4. Verify row counts pre/post migration match exactly, and spot-check that `session.user.tenantId` resolves correctly for a real login before considering the migration complete.

**Definition of Done:** a second `Tenant` (e.g. a seeded demo/test association) can be created, given its own admin user, students, and rooms, and it is *impossible* — verified by an actual test, not just code review — for that tenant's admin to see, edit, or enumerate the first tenant's data through any route, including the AI assistant's tools.

---

## 6. Phase 2 — Platform Super-Admin & Tenant Provisioning (P1)

**Why:** you (the founder) need a way to create tenants, track their plan/billing status, and gate features by plan — without touching MongoDB by hand for every new client you close in the field.

### 6.1 New route tree: `app/super-admin/**`

- `app/super-admin/layout.tsx` — gates on `session.user.role === ROLES.SUPER_ADMIN` only.
- `app/super-admin/tenants/page.tsx` — list all tenants, their plan, status, and billing state (paid/overdue).
- `app/super-admin/tenants/new/page.tsx` — **the field-sales workflow**: after closing a deal on-site, you fill a form (association name, admin's name/email/phone, plan tier) and the system creates the `Tenant` + first `ADMIN` `User` + a `Settings.enrollment` default doc, and generates a temp password (reuse the existing `generateTempPassword()` pattern) to hand to the client on the spot.
- `app/super-admin/tenants/[id]/page.tsx` — tenant detail: plan, usage (student count vs. `maxStudents`, AI usage vs. `aiQuotaMonthly`), billing history (list of `Invoice` docs), and controls to record a payment, change plan, or suspend/reactivate.
- `app/super-admin/billing/page.tsx` — cross-tenant view of all pending/overdue invoices — this is your accounts-receivable dashboard.

### 6.2 `Invoice` model and manual billing workflow

Implement the `IInvoice` model from §3.2. Build a simple "record a payment" form in the tenant detail page: platform admin selects the invoice, enters the payment method (bank transfer/check/cash), reference number, optionally uploads a photo of the transfer receipt/chèque (reuse the existing Cloudinary upload pipeline, tenant-namespaced per Phase 1.5), and marks it paid. This directly operationalizes the 50%-upfront/50%-on-handover and annual-renewal cash-collection terms from the sales playbook, without needing a payment gateway integration yet.

Auto-generate the first two invoices (`SETUP`, `ANNUAL_RENEWAL`) when a tenant is created in §6.1, pre-filled with amounts based on the chosen plan (see the pricing table in §6.4).

### 6.3 Entitlement / feature-gating middleware

```ts
// lib/entitlements.ts
const PLAN_HIERARCHY = ['STARTER', 'STANDARD', 'PREMIUM'] as const

export async function requireTier(minTier: typeof PLAN_HIERARCHY[number]) {
  const session = await requireTenantSession()
  const tenant = await Tenant.findById(session.user.tenantId).lean()
  if (!tenant || PLAN_HIERARCHY.indexOf(tenant.plan) < PLAN_HIERARCHY.indexOf(minTier)) {
    throw new EntitlementError(`Upgrade to ${minTier} to use this feature`)
  }
  return { session, tenant }
}
```

Apply this at the top of every route that should be plan-gated (AI assistant routes → `PREMIUM`; bulk payment/export, tablet scanner pairing, WhatsApp notifications → `STANDARD+`). On the frontend, wrap the corresponding nav items/buttons in a check against `session.user.tenantPlan` (available client-side without an extra fetch per §5.4) and show an upgrade prompt/modal instead of making the API call when the tier isn't met — this avoids a jarring "you got a 403" experience and turns the gate into an upsell moment.

Also enforce `maxStudents` at every student-creation entry point — both `POST /api/students` and the AI's `create_student` tool — returning a clear "upgrade your plan" error once the tenant's active student count would exceed their plan's cap.

### 6.4 Canonical pricing (reconciles the multiple pricing drafts from prior discussion into one model)

This plan uses **one** tier structure, combining the feature-gating tiers with the local-market cash-billing reality:

| Tier | Setup fee (one-time) | Annual fee | Student cap | Key gates |
|---|---|---|---|---|
| **Starter** | 0 TND (or a nominal token fee if you decide a free tier invites abuse) | 0 TND | 50 | Web QR check-in (no dedicated tablet app pairing), basic payment ledger, no AI, no WhatsApp, single admin seat. Used both as a genuine entry tier for tiny halaqat *and* as the vehicle for the 14-day free-pilot sales tactic. |
| **Standard** | 600–850 TND | 350–450 TND/yr | 300 | Everything in Starter + tablet scanner app pairing, bulk payment operations + CSV export, WhatsApp/SMS notifications, Hifz tracking, learning-document library, student/guardian portal. No AI assistant. |
| **Premium** | 1,100 TND | 650 TND/yr | Unlimited | Everything in Standard + the Groq AI assistant (with a monthly action quota, e.g. 500), multi-branch support, automated PDF receipts, priority support, gamification/TV leaderboard, substitute-teacher portal. |

Add-ons (any tier): PVC QR student ID cards at 2.5–3.5 TND/student (printed and shipped during onboarding); Q-Arena live-event hosting for >30 concurrent participants (Phase 5.10) gated to Standard+.

Exact TND figures are a business decision, not an engineering one — the numbers above are carried over from the sales-strategy discussion as sensible defaults; treat the `Tenant.billing` fields as configurable per deal (field sales will negotiate) rather than hardcoding these numbers anywhere except as UI defaults on the pricing page and the "new tenant" form.

### 6.5 The new admin's first 15 minutes matter as much as the sales pitch

A deal closed in person and a tenant created from §6.1 still leaves a brand-new `ADMIN` logging in for the first time with an empty roster and no rooms — the single easiest way to lose the enthusiasm generated by a good demo is to hand someone a blank dashboard and no guidance. Build a short, dismissible **setup checklist** on the admin dashboard for any tenant under, say, 5 students: add your first room → add your first teacher → import or add your first students (reuse the existing bulk-import page) → generate QR ID cards → (Standard+) pair a scanner device. Track completion on the `Tenant` document (a simple `onboardingStepsCompleted: string[]`) so the checklist can disappear once done and so you, as the platform operator, can see in the super-admin console which newly-signed tenants have stalled partway through setup — that's a direct, actionable churn-risk signal, not just a UX nicety.

### 6.6 Renewal reminders — don't let a paying tenant lapse silently

Phase 2's billing workflow (§6.2) covers recording a payment once it's happened, but the platform also needs to *initiate* the renewal conversation before `Tenant.billing.currentPeriodEnd` passes. Add a scheduled check (using Phase 10's background-jobs infrastructure, §14) that flags tenants approaching their renewal date — surfaced in `/super-admin/billing` as an explicit "renewing soon / overdue" list, not just buried inside each tenant's detail page — so you can proactively call the association before their access would otherwise degrade under `status: 'PAST_DUE'`. For a direct-sales, relationship-driven customer base, a phone call ahead of an invoice lapsing preserves the relationship in a way an automated dunning email alone would not; the system's job here is surfacing *who to call*, not fully automating the renewal.

**Definition of Done:** you can close a deal in person, create the tenant from `/super-admin/tenants/new` on a laptop or phone before leaving the meeting, and the client's admin can log in with a temp password the same day — with the correct plan's features already gated correctly, a first-run setup checklist guiding them to a populated dashboard, and their renewal date visible on your own billing dashboard well before it arrives.

---

## 7. Phase 3 — AI Agent Hardening (P1 — explicitly flagged as priority by the user)

**Why:** this is the product's sharpest differentiator and, per the audit, its riskiest subsystem. It must not be the thing that leaks Tenant A's data to Tenant B's admin, runs up an uncontrolled Groq bill, or gets manipulated via a student-controlled text field.

Work through these in order — each builds on the last:

### 7.1 Tenant-scope every tool query

Go through all 43 `case` branches in `lib/ai/tool-executor.ts` and add `tenantId: adminTenantId` to every Mongoose query, mirroring Phase 1.3's manual scoping work but concentrated in this one file. Change `executeTool`'s signature to `executeTool(toolName, args, adminUserId, tenantId)` and thread `tenantId` through from the route handlers (which already have it on `session.user.tenantId` after Phase 1.4). This is the single most important fix in this phase — do it before anything else here.

### 7.2 Add per-tool authorization, not just per-route

Even within one tenant, decide whether every `ADMIN` should really be able to call every one of the 24 write tools with no further distinction (e.g., should a junior admin/secretary account be able to `delete_student` or `bulk_mark_payments` via natural language, when the UI might reserve that action for a "primary admin"?). At minimum, add a lightweight per-tool permission table (even a static array of "sensitive" tools requiring the primary/owner admin) so this isn't a binary "any admin, any action" model forever. This can start simple and grow — the important part is that `executeTool` stops being permission-blind.

### 7.3 Enforce the AI usage quota

Using `Tenant.aiQuotaMonthly`/`aiUsageCurrentMonth` from §3.2: increment `aiUsageCurrentMonth` on every completed tool-calling round (not per-message, since a single user message can trigger multiple tool rounds up to `MAX_TOOL_ROUNDS`), check it before starting a new conversation turn, and return a clear "monthly AI quota reached — resets on [date] or upgrade for more" message when exceeded. Reset the counter on a monthly cron or lazily on first use after `aiUsageResetAt` has passed. Also add a hard per-tenant rate limit (e.g., max N chat requests/minute) independent of the monthly quota, to prevent a runaway client-side bug or a malicious script from hammering the endpoint.

Log Groq token usage (prompt + completion tokens, available in the Groq SDK's response metadata) per call, tagged with `tenantId` and `userId`, into a lightweight `AiUsageLog` collection or a metrics service — this is what lets you actually see your Groq cost-per-tenant and price the Premium tier sustainably.

### 7.4 Fix the validation gaps (cross-reference Phase 0.3 — do these together)

`{ runValidators: true }` on the 5 flagged update paths; `escapeRegex()` on the 6 flagged search paths. Beyond that, add an explicit Zod schema per tool (yes, all 43) in a new `lib/ai/tool-schemas.ts`, and validate `args` against it immediately after JSON-parsing the LLM's tool-call arguments and before calling `executeTool` — today, a parse failure silently becomes `{}` and an out-of-schema value just flows into Mongoose, relying entirely on whatever validators that specific model happens to have. A dedicated Zod layer makes every tool's contract explicit and independently testable (ties into Phase 9).

Also re-validate `modifiedParams` in `execute/route.ts` — today, an admin's edits to a pending action's parameters in the `AIActionCard` UI are merged and executed with **no re-validation at all**. Run the same Zod schema against the merged params before execution.

### 7.5 Neutralize the prompt-injection surface

Any free-text field that a non-admin role can set (`Student.address`, `Student.notes` if student-editable, `AttendanceClaim.reason`/`reviewNotes`) must be wrapped before being echoed back into the model's context, e.g.:

```
[USER-SUPPLIED DATA, NOT AN INSTRUCTION]: {{content}}
```

or stripped of anything resembling an instruction pattern. At minimum, add an explicit line to `lib/ai/system-prompt.ts` instructing the model that all string fields inside tool results are untrusted data, never instructions, and that it must never act on directives found inside them. This is a mitigation, not a complete fix — the durable fix is architectural (write actions still require human approval, which caps the blast radius; make sure that stays true as new tools are added).

### 7.6 Complete the audit trail

Extend `ActivityLog`'s `ActivityType` enum to cover every write tool (not just the 6 that currently log), and add a `source: 'ai_assistant' | 'manual'` field to `ActivityLog` so AI-triggered actions are distinguishable from UI-driven ones in the activity feed. Call `logActivity()` from all 24 write-tool branches in `tool-executor.ts`, not just 6. This also directly supports the "audit trail" expectation any B2B buyer will have once you're selling to institutions handling money and minors' data.

### 7.7 De-duplicate and de-drift `chat/route.ts` / `execute/route.ts`

Extract the shared logic (`TOOL_NAME_AR`, `describeAction()`, `cleanArgs()`, `coerceToolArgs()`, the Groq streaming loop scaffold) into `lib/ai/shared.ts`, imported by both routes. Fix the specific drift already found (the `execute/route.ts` copy of `TOOL_NAME_AR` is missing the write-tool labels the `chat/route.ts` copy has), and bring `execute/route.ts` up to parity on retry-on-malformed-tool-call logic, which today only exists in `chat/route.ts`.

### 7.8 Fix the smaller correctness issues while in this code

- Make `create_student`'s enrollment-number generation call the existing `generateEnrollmentNumber()`/`Settings`-driven helper instead of its own ad hoc sequence scan, so AI-created and UI-created students always share one numbering scheme.
- Consolidate the three separate Tunisia-timezone "resolve today/tomorrow" implementations (`system-prompt.ts`, `chat/route.ts`'s `coerceToolArgs`) into one shared `lib/ai/timezone.ts` helper.
- Add a client-side timeout/`AbortSignal` to the Groq API call itself (today only the tool-execution step has a timeout; a hung Groq stream has no bound).

### 7.9 Decide the AI UI pattern

`AIProvider` already implements unused `isOpen`/`toggleOpen()` drawer state. Either (a) finish it — add a floating action button + slide-over drawer available from every admin page, which is a nicer UX for a "quick ask" pattern and matches what was described in the original feature-request conversation — or (b) delete the dead state and keep the current full-page `/admin/ai-assistant` pattern. Given the tool-heavy, often-multi-turn nature of this assistant (search → confirm → approve flows), a **dedicated page is arguably the better UX** (more room for the pending-action cards and tool-call trace), so the recommendation is (b): remove the dead drawer state, keep the full page, and instead add a lightweight "Ask AI" quick-launch button in the top nav that just navigates to the page — cheaper to build and consistent with the existing information architecture.

### 7.10 Gate access by plan and add tests

Wrap the three AI routes in `requireTier('PREMIUM')` (§6.3). Then — since this subsystem has zero test coverage and the highest complexity in the app — add, at minimum: unit tests for `tool-executor.ts` covering tenant-scoping (the #1 regression risk), the 5 previously-unvalidated write paths, and the regex-escaping fix; and one integration test simulating a full search→propose→approve→execute cycle end to end for at least one representative write tool (e.g. `create_student`).

### 7.11 Don't marry one LLM vendor to your Premium tier's core value

`lib/ai/groq-client.ts` hardcodes both the provider (Groq) and the model (`llama-3.3-70b-versatile`) directly in the two AI routes. That's a fine starting point, but it means a Groq pricing change, a rate-limit tightening, or a model deprecation becomes a scramble through `chat/route.ts` and `execute/route.ts` simultaneously rather than a config change — and the AI assistant is the single feature Premium is priced around, so this is a real business-continuity risk, not just a code-quality one. Wrap the Groq SDK calls behind a small internal interface (`lib/ai/llm-provider.ts` exposing `createChatCompletion(...)`) so a future swap to another OpenAI-API-compatible host, or a different model on Groq itself, touches one file. This doesn't need to be a heavyweight abstraction (no need to genericize across incompatible provider APIs speculatively) — it just needs to not be two copy-pasted direct SDK calls, which per §7.7 is already being fixed for other reasons (de-duplicating `chat/route.ts`/`execute/route.ts`) — do both in the same pass.

**Definition of Done:** a red-team pass (even a self-administered one) confirms: (1) Tenant A's admin cannot get the AI to read or write Tenant B's data through any tool, in any phrasing; (2) a crafted `Student.address` string cannot cause the AI to take an unapproved action; (3) sending 1,000 rapid chat messages from one tenant hits a quota/rate-limit response well before it would in production today (i.e., never); (4) every write tool's action shows up in `ActivityLog` with an AI source marker; (5) the model name and API key are read from one shared config point, not duplicated across route files.

---

## 8. Phase 4 — Landing Page & Public Marketing Site (P1)

**Why:** confirmed to not exist at all (§2.5). A SaaS product needs a place that isn't behind a login to explain what it is, show it working, and let a prospect (or your own field-sales laptop demo) hit a pricing page.

### 8.1 New route group: `app/(marketing)/`

Using a Next.js route group so these pages don't inherit the dashboard shell:

- `app/(marketing)/page.tsx` — the actual landing page, served at the root `/` — the first thing anyone sees when they type the domain (see §8.2 for the full experience/design brief). **This replaces the current behavior of `/` redirecting unauthenticated visitors straight to login** — update `middleware.ts`'s public-route logic so `/` is public and renders the landing page, and login becomes a quiet call-to-action from it (a text link in the nav), not the default destination.
- `app/(marketing)/pricing/page.tsx` — renders the tier table from §6.4, localized, with a "Book a demo" / "Contact sales" CTA (this is a B2B field-sales product, not self-serve checkout — the pricing page's job is to qualify and route leads to a human, not to run a Stripe checkout, at least in this phase).
- `app/(marketing)/features/page.tsx` — one section per major capability (QR attendance, Hifz tracking once Phase 5 lands, AI assistant, payments, parent notifications), each with a real screenshot/GIF from the actual product, not stock imagery.
- `app/(marketing)/about/page.tsx`, `app/(marketing)/contact/page.tsx`, `app/(marketing)/terms/page.tsx`, `app/(marketing)/privacy/page.tsx` — standard legal/trust pages. Privacy policy matters concretely here: this product stores minors' CIN numbers, photos, and guardian contact info (see §12.4 for the compliance angle).
- `app/(marketing)/demo/page.tsx` — a lead-capture form (name, association name, city, phone/email, approx. student count) that either emails you directly or writes to a simple `Lead` collection surfaced in the super-admin console — this is the digital complement to the in-person pitch, for prospects who find the site before you knock on their door.

### 8.2 The landing page experience — full design & motion brief

**What "premium" means here, precisely:** not new colors, not decoration — *restraint, pacing, and coherence*. The reference class is Apple/Linear/Stripe-style product marketing: one idea per viewport, type-led hierarchy, generous whitespace, real product imagery instead of stock illustration, and motion that exists to explain the product rather than to show off. The visitor should feel the same care in the landing page that the pitch claims exists in the product. Everything below is buildable with the existing token system (`#136F4E` green / `#F4C76C` gold / `#1D2939` ink / `#F8F5F0` warm off-white, `Amiri` display serif) — the premium feel comes from *how* those tokens are used, not from replacing them.

**8.2.1 Design principles (non-negotiable, enforced in review)**

1. **One idea per section.** Each full scroll viewport makes exactly one claim and proves it with one product visual. No section carries two messages; if copy wants to say two things, it becomes two sections.
2. **Type does the talking.** Large `Amiri` Arabic display headlines (fluid `clamp()` scale, roughly 40px mobile → 88px desktop, line-height ~1.15) carry the hierarchy. Body text stays modest and highly readable (line-height ~1.7 for Arabic). Pair `Amiri` (display only) with a modern Arabic sans for body/UI copy on the marketing surface — **IBM Plex Sans Arabic** (free, excellent Arabic + Latin coverage) loaded via `next/font` with subsetting and `display: swap`; the serif-everywhere look that works inside the dashboard reads heavier on a long-form marketing page.
3. **Whitespace is the luxury.** A 12-column grid, content max-width ~1200px, and *large* vertical rhythm (~120–160px section padding on desktop, ~64–96px mobile). Never fill space because it's there.
4. **Color discipline.** The page is predominantly the warm off-white + ink neutrals. Green is reserved for *action* (CTAs, links, live/success states). Gold appears only as a thin accent — hairline rules, highlighted numerals, a subtle underline behind a key phrase — never as a large fill. One deliberate dark section mid-page (the AI spotlight, 8.2.2 §6, reusing the existing dark-mode token values) gives the page a contrast beat and makes the return to light feel intentional.
5. **Depth without heaviness.** Layered soft shadows + 1px borders on cards and device frames — no hard drop shadows, no glassmorphism-everywhere. A very-low-opacity Islamic geometric pattern (derived from the brand identity) may watermark the hero and final CTA backgrounds — at a subtlety where you notice it only when looking for it.
6. **Real product only.** Every visual is an actual screenshot or screen recording from the seeded demo tenant (§8.5) inside a clean browser/tablet/phone device frame — never stock photos, never fake abstract dashboards.

**8.2.2 Page architecture — the scroll narrative, section by section**

1. **Navigation:** transparent over the hero, transitioning to a frosted-glass bar (`backdrop-blur` + hairline bottom border) once scrolled, slightly reduced in height. Logo start-aligned (RTL), links (المميزات / الأسعار / تواصل معنا), login as a quiet text link, and one pill-shaped primary CTA: "احجز عرضًا تجريبيًا". Language switcher (ع/FR) lives here per §8.3.
2. **Hero (full viewport, calm):** the validated headline hook (below, 8.2.6) as a line-by-line staggered reveal on load, a single-sentence subhead, two CTAs — primary "احجز عرضًا" and secondary ghost "شاهد المنصة" (anchor-scrolls to the product tour). Beneath the fold-line: the admin dashboard in a browser frame, entering with a fade + rise, then drifting on an extremely slow parallax as the user scrolls. No animated gradients, no particles — stillness is the statement.
3. **Proof strip:** a slim band of concrete numbers (students managed, check-ins recorded, sessions scheduled — pull real aggregates from Tenant Zero, anonymized) with count-up on scroll-into-view, plus the founding association's name/logo with their permission.
4. **Product tour (the centerpiece — the one "wow" allowed):** a scroll-driven sticky showcase, the Apple product-page pattern: a pinned device frame stays centered while scrolling swaps its screen through three beats — QR check-in success (with the satisfying success pulse from §3.5.4), the live dashboard, the payment ledger — each synced to a short caption that slides through alongside. This is the single section that justifies adopting `motion` (lazy-loaded, this route group only, per §3.5.4). Fallback (reduced-motion, keyboard users, JS-off): the same three beats as static stacked image+caption sections — the fallback is designed, not an afterthought.
5. **Three pillars (the director's pain points):** three cards in a row (stacked on mobile), staggered reveal, gentle hover lift (translate −4px + shadow bloom, ~120ms). Each card: an animated-on-scroll icon, one pain-point headline, two sentences, one small supporting product visual.
6. **AI assistant spotlight (the dark section):** switch to the dark token set for one full section. A chat mockup "types" a realistic admin request (e.g., "سجّل غياب أحمد اليوم وأرسل تنبيهًا لوليّه") and the pending-action approval card appears — showing off both the intelligence *and* the human-approval safety story in one visual. Premium-tier badge subtly present; this section is the pricing page's best salesman.
7. **Scanner & QR cards:** split layout — copy on one side, a slightly tilted phone mockup running the scanner app on the other, looping the scan-success animation. This is where the PVC ID-card add-on gets its visual.
8. **Pricing teaser:** the three tier cards (from §6.4), Premium elevated with a gold hairline crown, monthly-equivalent framing, one line of what each unlocks, linking through to `/pricing`. No feature-matrix table here — that lives on the pricing page.
9. **Testimonial:** one large `Amiri` pull-quote from the founding association's director, generous whitespace, name + role attribution. One is enough; a carousel of three mediocre quotes is worth less than one real one.
10. **Final CTA + footer:** a full-width closing section (deep green, the pattern watermark, one headline, one button — nothing else), then a footer with the trust links (privacy policy matters concretely here per §12.4), contact info, and language switcher.

**8.2.3 Motion system — smooth scroll and choreography rules**

- **Smooth scrolling:** CSS `scroll-behavior: smooth` for anchor links as the baseline. For the premium inertial scroll feel, adopt **Lenis** (tiny, framework-agnostic, the current standard for this) — loaded *only* in the `(marketing)` route group, lazy-initialized after first paint, and **disabled** on touch devices (native momentum scrolling is already good and hijacking it feels worse, not better) and under `prefers-reduced-motion`.
- **Scroll choreography:** `motion` (per §3.5.4) powers the sticky product tour (`useScroll`-linked progress) and staggered reveals. Everything else is IntersectionObserver + CSS.
- **One scroll-scrubbed sequence — the signature moment (optional but high-impact, Apple AirPods-page style):** one place on the page where scrolling *scrubs* a short animation forward and backward frame-by-frame, giving the "the page is under my fingertips" feel. The right candidate is the product tour's first beat: the QR card entering the frame and the check-in success state blooming, scrubbed over ~150vh of scroll. **Technique matters more than the idea:** never bind `video.currentTime` to scroll (seeking is async and keyframe-dependent — it stutters on exactly the mid-range hardware this audience uses). Instead, pre-render the shot as a numbered image sequence (60–90 frames, WebP/AVIF, ~720p, target < 2.5MB total), draw the interpolated current frame to a `<canvas>` from a scroll-linked progress value, and preload the sequence lazily only when the section approaches the viewport. Serve it only where it can be flawless: gate on desktop-class viewports + `prefers-reduced-motion: no-preference`, and give everyone else the already-designed static/swap fallback from §8.2.2 §4. One scrubbed sequence maximum on the page — as the single most expensive asset and the single most memorable moment, it must never compete with a second one. If, after building it, it doesn't hold 60fps on a mid-range machine, cut it without hesitation — a flawless sticky swap beats a stuttering scrub every time.
- **The reveal grammar (one grammar, used everywhere):** elements enter with opacity 0→1 + 24px rise, ~600ms, `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-expo family), siblings staggered 60–90ms. Each element animates **once** — never re-triggering on scroll-up, which reads as gimmicky rather than premium.
- **Micro-interactions:** buttons compress to scale 0.98 on press with an arrow-nudge on hover; cards lift on hover; stat numerals count up. A magnetic-hover effect on the primary CTA is optional garnish — cut it the moment it costs a frame.
- **Hard rules:** animate only `transform` and `opacity` (compositor-friendly, no layout thrash); nothing exceeds ~700ms; no scroll-jacking that alters wheel speed; no autoplaying audio; content never *depends* on an animation completing to be readable; every effect respects `prefers-reduced-motion` (reveals become instant, the tour becomes static) — extending the discipline already in `app/globals.css:653`, never bypassing it.

**8.2.4 Performance budget — premium means fast, especially on the phones prospects actually use (§3.5.5)**

- The entire marketing surface renders as static RSC output — the only client JS is the lazy motion islands. Hero entrance animation is plain CSS so it needs zero JS to feel alive.
- Targets, treated as a CI-checkable gate (ties into §12.2's Web Vitals item): Lighthouse ≥95 performance on mobile, LCP < 2s on a mid-range Android over 4G, CLS ≈ 0 (device frames and images always have reserved aspect-ratio boxes).
- Hero screenshot via `next/image` with `priority`, Cloudinary `f_auto,q_auto`; all below-fold imagery lazy. Screen recordings ship as short muted `playsinline` MP4/WebM loops with poster images, lazy-loaded.
- Fonts: `next/font`, subset, two families maximum (Amiri display + IBM Plex Sans Arabic), `display: swap`.

**8.2.5 Content strategy (translate the pitch script into page copy, don't invent new positioning)**

Reuse the positioning already validated in the sales-strategy conversation instead of writing new marketing copy from scratch:

- **Headline hook:** "استبدل دفاتر الحضور الورقية بنظام رقمي متكامل" (replace paper attendance registers with an integrated digital system) — matches the field-pitch script's core hook.
- **Three pillars**, matching the three "director pain points" already identified: save time (QR check-in vs. manual roll call), stop absenteeism silently slipping through the cracks (automated parent alerts once Phase 5.2 lands), and never lose track of who paid (payment ledger + reminders).
- Show, don't tell: embed real product screenshots (dashboard, QR scan success screen, payment ledger) — the audit confirmed the current in-app design system is already polished; reuse those exact tokens on the landing page for brand consistency rather than inventing a new marketing palette.
- Voice: confident, concrete, short sentences. No SaaS-buzzword filler ("ثورة رقمية", "حلول ذكية") — the copy equivalent of the whitespace rule.

**8.2.6 RTL-first, mirrored-correct from day one.** Unlike the legacy dashboard (§5.11's `right-0`/`mr-*` debt), the `(marketing)` route group is brand-new code — write it with logical properties (`ms-*`, `inset-inline-*`, `text-start`) from the first line, so the French/English variants (§8.3) get a genuinely mirrored LTR layout for free instead of inheriting a second copy of the same RTL debt. Directional motion (slide-in reveals, the arrow-nudge) must also flip with direction — use logical transforms or a direction-aware offset, not hardcoded `translateX` signs.

**8.2.7 The anti-generic review gate — how to guarantee this doesn't ship as template slop.** The failure mode to defend against is well-known: AI-assisted landing pages converge on the same recognizable output (gradient hero, glassmorphism cards, emoji-in-rounded-square feature grids, invented stats, buzzword copy, everything animated). The sections above already remove the *causes* — real product assets instead of placeholders, validated pitch copy instead of invented copy, existing brand tokens instead of a default palette, one motion grammar instead of everything-animates. This section makes it enforceable: before the page ships, it must pass a review against these **automatic-reject criteria**, applied ruthlessly:

- Any visual that is not a real screenshot/recording of the actual product (abstract blobs, stock photos, illustrated fake dashboards) → reject.
- Any number, customer count, logo, or quote that is not verifiably real → reject. An empty proof strip is better than a fake one.
- Any color outside the token system, any gradient not explicitly specified in §8.2.2, any glassmorphism beyond the nav bar → reject.
- Any icon-grid "features" section with three-word blurbs → reject; that content belongs on `/features` as full sections with real visuals.
- Copy that could be pasted onto a competitor's site without edits → reject; every headline must contain something only this product can claim.
- More than one section competing for "the wow moment," or any animation outside the §8.2.3 grammar → reject.
- The gut-check: put the page next to Alif Cloud's and Qaf School's sites (§3.5's named competitors). If a stranger can't tell within five seconds that this one had more care put into it, it's not done.

**8.2.8 Assets to source from the founder before build starts** (blockers for the visual work, not the scaffolding): the logo as SVG (plus a single-color variant for the dark section and footer); high-res screenshots of the dashboard, scanner success screen, and payment ledger *from the seeded demo tenant* (§8.5 — never real students' data on a public page); two 10–20s screen recordings (QR check-in flow, AI propose→approve flow); the founding association's testimonial quote and written permission to use their name/logo; any real (consented) classroom photography for the about page; the final production domain name (affects §8.4's metadata/OG work).

### 8.3 Trilingual from day one (Arabic default, French secondary)

Tunisia's education-sector decision-makers are frequently francophone-fluent even when day-to-day operation is in Arabic. At minimum, the landing/pricing/demo pages should support Arabic + French (English optional, lower priority) — this is a much smaller lift than i18n-ing the entire authenticated app (Phase 5.11) and directly serves the sales motion. Use a minimal approach here (even static per-locale route segments, `app/(marketing)/[locale]/...`, without pulling in a full i18n framework yet) rather than blocking the landing page on the bigger Phase 5.11 i18n rollout.

### 8.4 SEO basics

`app/(marketing)/**` pages need proper `metadata` exports (title, description, Open Graph image), a `sitemap.ts`, and `robots.ts` — none of which matters for the authenticated dashboard but all of which matters for a page meant to be found by search engines and shared on social media.

### 8.5 A demo tenant your laptop can show without touching a real customer's data

The field-sales playbook this plan is built around calls for a **live, working demo on a tablet/laptop** during the in-person pitch. Once the app is multi-tenant, don't demo prospects using Tenant Zero's real students' names, photos, and CIN numbers — provision one dedicated `DEMO` tenant (flagged `Tenant.isDemo: true`) seeded with realistic-but-fake Arabic student/teacher data (reuse and extend the existing `scripts/seed.ts` patterns) that can be reset to its seeded state on a schedule (nightly cron, via Phase 10's background-jobs infrastructure) regardless of what a prospect clicks during a demo. Two direct uses: (1) the demo tenant is what your own sales laptop/tablet logs into in the field, so a live "let me show you" never risks exposing a real family's data or being derailed by whatever state a real tenant happens to be in that day, and (2) consider surfacing a read-only, rate-limited version of this same tenant as a public "explore the dashboard" link from the landing page's demo-request flow (§8.1) for prospects who want to poke around before a call — optional, but a low-cost extension of infrastructure you need anyway for (1).

### 8.6 Public forms need spam/bot protection, not just rate limiting

The demo-request form (§8.1) and the public admissions form (Phase 5.7) are both unauthenticated and reachable by anyone, including scrapers/spam bots — a common target for exactly this kind of public lead-gen form. Phase 0/12's rate limiting slows a determined abuser but doesn't stop casual bot spam filling your lead list or a tenant's admissions queue with garbage. Add a lightweight bot-detection layer to both — a honeypot field (a hidden input real users never fill, bots often do) costs nothing and catches a surprising amount of automated spam; add a real challenge (Cloudflare Turnstile is a reasonable, less user-hostile choice than a traditional CAPTCHA) if honeypot alone proves insufficient once the forms are live and getting real traffic.

**Definition of Done:** an unauthenticated visitor to the root domain sees a real landing page (not a login redirect), can reach a pricing page and a demo-request form; the page delivers the §8.2 experience — the scroll-driven product tour works with its designed reduced-motion/static fallback, the motion grammar is consistent across every section, and the page hits the §8.2.4 performance budget (Lighthouse ≥95 mobile, LCP < 2s on mid-range mobile) verified on a real phone, not just desktop DevTools; the whole marketing surface passes the SEO checks in §8.4; a dedicated demo tenant exists for live field-sales use with no real customer data at risk; and both public forms have basic spam protection in place.

---

## 9. Phase 5 — Vertical Feature Expansion (P2)

**Why:** these are the features that make an association pay for this over a spreadsheet or a generic attendance app — the "must-add" list from the product-strategy conversation. Build these **after** Phases 1–4 are solid, on a tenant-safe foundation, one at a time, each shippable independently.

Suggested build order within this phase (roughly effort-ascending and dependency-aware): 5.1 → 5.4 → 5.2 → 5.7 → 5.6 → 5.8 → 5.3 → 5.5 → 5.9 → 5.11 → 5.10 (last, because it's the largest standalone effort and least essential to initial sales).

### 5.1 Hifz / Muraja'ah memorization tracking

New model, tenant-scoped:

```ts
interface IHifzLog {
  tenantId: ObjectId
  studentId: ObjectId
  teacherId: ObjectId
  sessionOccurrenceId?: ObjectId
  date: Date
  type: 'SABAQ' | 'SABQI' | 'MANZIL'   // new daily memorization / recent revision / long-term retention
  surah: string
  fromVerse: number
  toVerse: number
  quality: 'EXCELLENT' | 'GOOD' | 'NEEDS_REVIEW' | 'WEAK'
  mistakeCount?: number
  notes?: string
}
```

Note this overlaps conceptually with the existing `Grade` model (`type: GRADE_TYPE`, `surah`, `fromVerse`, `toVerse`, `juz` already exist on `models/Grade.ts`) — **evaluate extending `Grade` with the `SABAQ`/`SABQI`/`MANZIL` distinction and a `quality` field rather than introducing a fully separate collection**, since the schemas are already ~70% identical. Whichever direction you pick, expose it as: a quick-entry UI in the teacher's session view (log today's Sabaq/Sabqi/Manzil per student in a few taps), and a cumulative "memorization progress" view on the student portal (already has a `performance` page — extend it) and — critically for the sales pitch — a parent-facing summary once Phase 5.2 (WhatsApp) lands.

### 5.2 WhatsApp/SMS notification engine

Use the **WhatsApp Cloud API** (Meta's official Business API) rather than Twilio's WhatsApp product where possible — it's cheaper at scale and increasingly the standard for this use case in North Africa; fall back to Twilio SMS for guardians without WhatsApp. Build:

- `lib/notifications/whatsapp.ts` — a thin wrapper around the Cloud API's message-send endpoint, template-based (WhatsApp requires pre-approved message templates for business-initiated conversations).
- Trigger points: student marked absent (fire ~10 minutes after session start, per the original spec, via a scheduled job — see Phase 10.1 for job infra), monthly payment due/overdue reminder (dunning, ties into 5.4), and optionally a daily Hifz-progress digest.
- A `NotificationLog` model to record what was sent, when, delivery status (from the Cloud API's webhook callbacks), and to whom — both for debugging and because "did the parent actually get notified" will be a real support question.
- Gate this feature at `STANDARD+` (§6.3) — it's listed as a Standard-tier differentiator.

### 5.3 Gamification & TV leaderboard

- Add `points`/`badges` fields to `Student` (or a separate `StudentAchievement` model if the badge catalog grows — start simple, extend `Student` with a `points: number` and `badges: string[]` first).
- A public, unauthenticated display route: `app/(display)/tv/[tenantSlug]/leaderboard/page.tsx` — designed to be cast to a classroom TV/projector, auto-refreshing (poll or a lightweight SSE/websocket push), showing top students by points/attendance streak. Public but tenant-scoped by the slug in the URL, not by session — treat this the same way the `/scanner` route is public today (no PII beyond first name/photo, no sensitive data).
- Badge triggers: perfect-attendance streaks, Hifz milestones (e.g. "completed Juz Amma"), computed by a background job or on-write hooks, not client-side.

### 5.4 Automated PDF receipts & dunning

- On `MonthlyPayment` marked paid, generate a branded PDF receipt (use `@react-pdf/renderer` or a server-side HTML-to-PDF approach like `puppeteer`/`@sparticuz/chromium` on serverless — evaluate cold-start cost; `@react-pdf/renderer` is lighter-weight and avoids a headless-browser dependency, generally the better fit here) using `Tenant.branding` for the association's name/logo.
- Dunning: a scheduled job (Phase 10.1) that finds `MonthlyPayment` records unpaid past a configurable grace period and triggers the WhatsApp/SMS reminder from 5.2 at 3-day and 7-day marks, matching the original spec.

### 5.5 Substitute teacher portal

- Add a `SubstituteAssignment` model: `{ tenantId, sessionTemplateId, substituteUserId, validFrom, validTo, assignedBy }`.
- A scoped-access check in the tenant-scoping layer (Phase 1.3): a `TEACHER` with an active `SubstituteAssignment` for a given session gets read/write access to that session's roster, QR check-in override, and Hifz logs **only**, without seeing the substituting-for teacher's other sessions or any financial data. This is a good candidate for the per-tool/per-route permission table introduced in Phase 3.2 — a substitute is a temporary, narrowly-scoped variant of `TEACHER`, not a new role.

### 5.6 Family/household model + sibling billing

```ts
interface IFamily {
  tenantId: ObjectId
  primaryGuardianName: string
  primaryGuardianPhone: string
  primaryGuardianEmail?: string
  studentIds: ObjectId[]
  siblingDiscountPercent?: number
}
```

Add `familyId?: ObjectId` to `Student`. Use it to: (a) apply an automatic discount when computing what a family owes across `MonthlyPayment` records for multiple enrolled siblings, and (b) power a unified guardian login (extend the existing STUDENT-role-as-parent-proxy pattern, or — if this becomes a real product pillar — revisit the earlier decision against a `GUARDIAN` role and add one that can view multiple linked `studentIds`'s attendance/Hifz/payments in one dashboard). Start with (a) since it's the concrete monetization ask (sibling discounts); treat (b) as a nice-to-have that can follow once Family adoption data shows guardians actually want a unified view.

### 5.7 Online admissions / enrollment pipeline

- Public route `app/(marketing)/enroll/[tenantSlug]/page.tsx` — a public form (name, CIN, DOB, parent contact, medical/emergency notes) that creates an `AdmissionApplication` document (status: `PENDING` → `APPROVED`/`WAITLISTED`/`REJECTED`) rather than a `Student` directly.
- Admin review UI in `app/admin/admissions/` — one-click approve converts the application into a real `Student` record (reusing the existing student-creation logic/enrollment-number generation) plus an auto-generated first invoice/payment record if the tenant's plan includes automated billing.
- This directly reduces the "start-of-term registration bottleneck" pain point and, notably, gives you a second lead-generation surface (a public enrollment page for tenant "At-Taqua" is also implicitly a signal of that tenant's own growth, and a template other prospects can see in a live demo).

### 5.8 Akhlaq / Tarbiyah (behavior) logging

Small, additive: a `BehaviorLog` model (`{ tenantId, studentId, teacherId, sessionOccurrenceId?, type: 'POSITIVE'|'CONCERN', description, date }`), a quick-entry widget in the teacher's session view, and a rollup on the student profile / monthly report. Low engineering cost, real differentiation for character-education-focused institutions — build this in the same sprint as 5.1 (Hifz) since the UI pattern (quick per-student log entry during a session) is identical.

### 5.9 Advanced analytics dashboard

Build on the existing `app/api/dashboard/stats/route.ts` and `ActivityLog` data rather than a new subsystem:

- **Dropout-risk score**: a simple rules-based flag first (e.g., ≥3 consecutive unexcused absences OR a declining Hifz-quality trend over the last N sessions) surfaced as a sortable list in the admin dashboard — do not reach for a machine-learning model for v1; a transparent rule an admin can understand and act on is more useful and easier to trust than a black-box score.
- **Teacher punctuality/fulfillment metrics**: derive from existing `SessionOccurrence.status` and `Attendance.createdBy`/`checkInTime` data — no new data collection needed, just new aggregation queries and a chart.
- **Revenue projection**: paid vs. outstanding `MonthlyPayment` totals per month, projected forward — this is the one place a payment-gateway-free, manual-ledger billing model (§2.6) is actually fine, since it's read-only reporting on data that already exists.

### 5.10 Q-Arena live events/quiz engine (largest single feature — treat as its own mini-project)

This is materially bigger than everything else in this phase and has a different technical shape (real-time, stateful, needs infrastructure beyond the current serverless-Next.js-plus-MongoDB stack). Do not start this until Phases 1–4 and the rest of Phase 5 are shipped and at least one paying cohort of tenants exists to validate demand for it.

- **Architecture**: Socket.io (or a managed alternative like Ably/Pusher to avoid running a persistent Node process, which doesn't fit cleanly into a Vercel serverless deployment — this is the key infra decision to make before writing code) for the projector-screen ↔ student-device real-time sync, with Redis (Upstash Redis, consistent with the rate-limiting choice in Phase 0.4) for ephemeral live-room state (active question, per-player scores, timers), flushing final results to MongoDB only at game end.
- **v1 scope**: a single game mode (live multiple-choice quiz, Kahoot-style) with team-vs-team scoring tied to existing `SessionTemplate`/class groupings, plus the automated PDF certificate generation (reuse the Phase 5.4 PDF pipeline) for top finishers. Defer the "Quran Economy" power-up mode, audio-recitation-identification question type, and word-cloud/Q&A modes to a v2 — they're extensions of the same core engine, not blockers to shipping something useful.
- **Monetization**: gate to Standard+/Premium per the original plan, priced as a genuine Kahoot/Mentimeter replacement — this is a real cost-avoidance pitch for associations already paying for those tools separately.

### 5.11 Full app i18n (Arabic/French/English)

Separate from the marketing-site trilingual work in Phase 4.3, this is i18n-ing the entire authenticated application — every dashboard string, validation message, and API error. This is a large, mechanical effort (the audit found RTL positioning done via literal Tailwind utilities rather than logical properties, meaning layout components need rework, not just string extraction). Recommended approach: adopt `next-intl` (good App Router support), extract all currently-inline Arabic strings into a `messages/ar.json` (with `messages/fr.json`/`messages/en.json` as translation targets), and convert `right-0`/`mr-*` literal-direction Tailwind classes to logical-property equivalents (`inset-inline-end`, `ms-*`) so a French/English tenant genuinely gets an LTR layout, not an Arabic layout with English words. Sequence this **last** in Phase 5 — it touches nearly every component file and is much easier to do once the component surface has stabilized post-multi-tenancy, rather than fighting merge conflicts against Phases 1–4's changes.

### 5.12 In-app notifications — the bell icon already promises this; nothing behind it delivers it

`components/layout/navbar.tsx:94-98` renders a notification bell with a hardcoded, permanently-on red dot (`<span className="... bg-destructive rounded-full" />`, unconditional, no `onClick` handler at all) — it's pure decoration today, not a bug exactly, but a UI element actively lying to every admin and teacher who's ever hovered over it wondering what it does. Once several of this phase's features exist (a pending AI action awaiting approval, a claim submitted by a student, a payment overdue, an admissions application received, a session assigned to a substitute), there's real event volume that deserves a real notification center, not just an activity-log page an admin has to remember to check.

Build a `Notification` model (`{ tenantId, userId, type, title, body, link, read: boolean, createdAt }`), a lightweight `POST`-on-write pattern (the same write paths already calling `logActivity()` as part of Phase 3's audit-trail work, §7.6, also write a `Notification` for the relevant user(s) — same call sites, one more write), a `GET /api/notifications` (paginated, per §12.1's rule) plus a mark-as-read endpoint, and wire the navbar bell to a real unread count with a dropdown list, following the empty/loading state standards from §3.5.2. This doesn't need real-time push in v1 — polling on an interval or refetching on navigation is a perfectly reasonable start; reserve WebSocket/SSE-based live push for if usage data later shows the delay is actually a problem worth solving.

**Definition of Done per sub-feature:** each of 5.1–5.9 (and 5.12) ships independently with its own tenant-scoped model (following the Phase 1 pattern exactly — no new feature should introduce a model without a `tenantId`), its own entitlement gate where applicable, and is demoable as a discrete item in the sales pitch ("we now also track memorization progress" / "parents get WhatsApp alerts" / "you get notified the moment a claim comes in").

---

## 10. Phase 6 — Mobile Scanner App Hardening (P3)

**Why:** the current app has a live secret committed to source and can't meaningfully serve more than one tenant without a rebuild. Fix these before offering the tablet-scanner feature (a Standard+ tier perk) to a second client.

### 10.1 Remove the hardcoded secret; adopt QR-based device provisioning

Delete the hardcoded `SCANNER_TOKEN` from `src/config/env.ts`. Replace manual URL/token entry in `app/setup.tsx` with a **QR-pairing flow**: the tenant admin generates a one-time "pair this device" QR code from the web app (`app/admin/settings` — a new "Scanner Devices" panel), which encodes a short-lived pairing token; the mobile app's setup screen scans it (reusing the existing `expo-camera` integration already in the scanner screen) and exchanges it server-side for a long-lived, **per-device, per-tenant** token issued by a new `POST /api/devices/pair` endpoint. This directly solves the multi-tenancy gap the audit flagged (no tenant identifier is ever transmitted today) and eliminates hand-typing a secret over Wi-Fi setup.

Add a `Device` model (`{ tenantId, deviceId, name, pairedAt, lastSeenAt, revokedAt? }`) so tenant admins can see and revoke individual scanner devices — this also gives you the audit trail a lost/stolen tablet scenario needs.

### 10.2 Store secrets properly

Move `deviceToken` from AsyncStorage (`src/store/deviceStore.ts`) to `expo-secure-store`. Keep non-sensitive state (theme, recent scans) in the existing Zustand/AsyncStorage setup.

### 10.3 Gate the Settings screen

Require the device's paired tenant admin to set a local PIN during pairing, checked before the 5-tap gesture reveals Settings. This is a small addition (`app/settings.tsx`) but closes a real gap on an unattended kiosk device holding a live credential.

### 10.4 Offline retry queue

Add a small persisted queue (Zustand + AsyncStorage is fine for this volume) of failed check-ins; retry automatically on reconnect (`@react-native-community/netinfo`, not currently installed) before falling back to the current manual-rescan behavior. This matters operationally — a school with flaky Wi-Fi is exactly the customer profile this product targets.

### 10.5 Fetch branding at runtime instead of hardcoding it

Once a device is paired to a tenant (10.1), fetch that tenant's `branding` (name, colors, logo) from a lightweight `GET /api/devices/config` endpoint at app launch and drive the scanner UI's copy/colors from it, replacing the hardcoded Arabic strings and `#136F4E`/`#F4C76C` literals in `app/scanner.tsx`. This is what turns "one app per tenant" into "one app, many tenants" — the single biggest architectural change needed on the mobile side, and it directly unblocks selling the tablet scanner to any new client without a rebuild or a separate app-store listing.

### 10.6 Clean up dead code

Remove: the unused `useDeviceConfig`/`useScanHandler` hooks (the former has a broken import), the fully-implemented-but-unused `mockCheckIn()`, the leftover `create-expo-app` template files (`components/themed-text.tsx`, `hooks/use-color-scheme*.ts`, `constants/theme.ts`, `scripts/reset-project.js`), and the committed `dist/` build-output folder (add it to `.gitignore` instead). Fix the duplicated `android.permissions` array entries in `app.json`. Correct the stale `README.md` (documents a request/response contract that doesn't match the actual implementation).

### 10.7 EAS build/update configuration

Add `channel` fields per build profile in `eas.json` so `eas update` publishes reliably reach the intended binaries, and verify with `eas channel:list`/`eas build:list` before relying on OTA in production. Since branding/config is now fetched at runtime (10.5) rather than baked into the JS bundle, OTA updates become safe to push globally across all tenants' devices without needing per-tenant builds.

**Definition of Done:** a brand-new tablet can be unboxed, the Q-Trust Scanner app installed from a single shared build, and paired to a specific tenant purely by scanning a QR code generated from that tenant's admin panel — no manual URL/token typing, no rebuild.

---

## 11. Phase 7 — Real Payment Infrastructure (P3)

**Why:** two distinct billing surfaces exist in this product and must not be conflated: (a) **you billing the tenant** (platform subscription — covered by Phase 2's manual-invoice workflow, sufficient for the Tunisia-first, cash/bank-transfer GTM), and (b) **the tenant billing families** (tuition — currently a manual ledger, `MonthlyPayment`). Phase 2 already covers (a) adequately for the current go-to-market. This phase is about strengthening (b), and optionally revisiting (a) once you expand beyond direct field sales.

### 11.1 Strengthen family tuition billing (not a payment gateway — better tooling around the manual ledger)

Given the audit confirms zero gateway integration exists and the sales strategy is explicitly cash/bank-transfer-based, **do not rush to integrate Stripe/PayPal for family tuition** — most target families will pay the association directly (cash, local transfer), not through the platform. Instead: extend `MonthlyPayment` with `receiptUrl` (photo of the cash receipt/transfer slip, tenant-namespaced Cloudinary upload) and wire it into the Phase 5.4 automated-PDF-receipt and dunning-reminder features. This delivers the *actual* pain point (chasing unrecorded payments, no receipts) without the integration cost and local-market fit risk of a card gateway most families won't use.

### 11.2 Evaluate local payment gateways (future, opportunistic)

If/when demand justifies it (e.g., families wanting to pay tuition online), evaluate Tunisian gateways with local settlement (Flouci, Paymee, Konnect/D17) over Stripe — Stripe doesn't settle in TND to Tunisian bank accounts as of this writing, making it a poor fit for this specific market regardless of its general popularity elsewhere. Scope this as a discrete, optional add-on module (a `PaymentGateway` abstraction with one initial provider implementation) rather than a rewrite of the existing manual-ledger model, which should remain the default for tenants who don't opt in.

### 11.3 Platform-subscription self-serve (future, once expanding beyond direct field sales)

If the business later wants a self-serve signup path (e.g., expanding beyond Tunisia, or serving smaller prospects who find the site via Phase 4's marketing pages without a field visit), that's where a card gateway for *your* platform subscription (not family tuition) makes sense — Stripe is the standard choice there since it's billing you receive from tenants directly, which can settle in USD/EUR even if the tenant is Tunisian. Keep this explicitly out of scope until the manual-invoice workflow (Phase 2) proves the pricing/plan model works.

**Definition of Done:** tenant admins can attach a receipt photo to any `MonthlyPayment` record and generate/download a branded PDF receipt for a family, with automated payment reminders reducing the "chasing unrecorded payments" support burden — no gateway integration required for this to be complete.

---

## 12. Phase 8 — Performance, Scalability, Security & Production Hardening (P3)

**Why this phase got bigger:** "must be at high scale, must be perfect" is not satisfied by security fixes alone. A verified pass over the actual codebase found concrete scalability gaps sitting alongside the security ones — most list endpoints have no pagination, image delivery isn't optimized, and there's no caching layer anywhere. These need the same explicit treatment as the security items, not a vague "optimize later" note.

### 12.1 Performance — pagination, indexing, and query discipline

- **Pagination is missing almost everywhere.** A direct check of the API routes found exactly **one** route (`app/api/student/attendance/route.ts`) implements skip/page/limit pagination. Every other list endpoint — `GET /api/students` (`Student.find({})`, unbounded), `GET /api/teachers`, `GET /api/rooms`, `GET /api/payments`, `GET /api/documents`, `GET /api/admin/claims`, `GET /api/attendance` — returns its *entire* result set in one response. This works today because Tenant Zero has ~10-50 students. It stops working the moment a Premium tenant (contractually "unlimited students") reaches several hundred, or once dozens of tenants' admins are all loading their (individually reasonable) full rosters at once. **Roll out cursor- or offset-based pagination to every list endpoint before onboarding any tenant meaningfully larger than the current pilot**, using the one existing paginated route as the template so the pattern is consistent across the API.
- **Compound index field order** — covered in depth in §5.1: `tenantId` must lead every compound index, with no exceptions, since it's now a predicate on every single query.
- **N+1 avoidance**: several existing routes already do multi-step lookups (e.g., session detail fetching enrolled students, teacher detail fetching session/student counts) — as tenant-scoping filters are added throughout Phase 1, audit these for query count, not just correctness; prefer `$lookup`/aggregation pipelines or `Promise.all`-batched queries over sequential per-item queries inside a loop.
- **Bound every AI tool's result size deliberately** (already partially done — `list_students`/`get_activity_log` clamp to 50 in `lib/ai/tool-executor.ts`) and apply the same discipline to every list-returning tool, not just those two.
- **Data lifecycle / archival**: `Attendance` and `ActivityLog` grow forever, one row per student per session per day, across every tenant. Plan an archival strategy before this becomes a hot-collection performance problem — e.g., a scheduled job (Phase 14.1) that moves `Attendance`/`ActivityLog` records older than N months (2-3 school years, tunable) into a cold/archive collection or export, keeping the hot collection's working set small and its indexes fast. Don't build this speculatively in Phase 1 — flag it as a trigger-based follow-up once any tenant's `Attendance` collection crosses a size threshold worth monitoring (Phase 14's observability work should include a simple per-collection document-count metric to watch for this).

### 12.2 Performance — images, bundle size, and rendering

- **Image optimization is barely used.** A direct check found `next/image` referenced in only 4 files across the entire app (`brand-logo.tsx`, one student detail page, `file-upload.tsx`, plus middleware's unrelated match). Given the app is fundamentally about displaying student photos and CIN scans (all Cloudinary-hosted), this is a real, fixable performance gap: migrate every remaining `<img>` tag rendering a Cloudinary asset to `next/image` with the existing `remotePatterns` config (`next.config.ts`) already permitting `res.cloudinary.com`, and pair it with Cloudinary's own `f_auto,q_auto` transformation parameters on the URL so images are served in the smallest correct format (WebP/AVIF) at the smallest correct size automatically — this is a large perceived-speed win for very little engineering effort, and directly benefits the landing page (Phase 4) and QR ID-card printing views, which are image-heavy.
- **Code-split the heavy, admin-only routes.** The AI assistant page, chart-heavy dashboard views (`recharts`), and any future PDF-generation (Phase 9) or live-event (Phase 5.10) code should be dynamically imported (`next/dynamic`) so their weight isn't paid by every visitor — particularly important for the public-facing marketing site and admissions form (Phase 4, 5.7), which should stay lean since they're the pages most exposed to slow mobile connections and most consequential for SEO/Core Web Vitals.
- **Virtualize large lists** once pagination alone isn't enough for a genuinely large single page (e.g., a 300-student roster rendered as a scrollable table for bulk operations) — `@tanstack/react-virtual` pairs naturally with the already-installed `@tanstack/react-query`.
- **Add a caching layer for read-heavy, slow-changing data.** Dashboard stats (`app/api/dashboard/stats/route.ts`), the schedule grid, and room availability are recomputed from scratch on every request today. Use Next.js's built-in data-cache/`unstable_cache` (or React `cache()` for request-level de-duplication) with short, explicit revalidation windows (seconds-to-low-minutes, tenant-scoped cache keys) for these — this reduces both response latency and MongoDB load as tenant count grows, at the cost of very slightly stale dashboard numbers, which is an acceptable trade for this use case.
- **Track Core Web Vitals and Lighthouse scores as a real gate**, not an occasional spot-check — especially for the marketing site (Phase 4), where performance directly affects SEO ranking and bounce rate on a page prospects may load over a mobile connection in the field.

### 12.3 Scalability — database and connection management

- **MongoDB connection pooling under serverless concurrency**: `lib/db.ts`'s current `maxPoolSize: 10` (per the existing connection-caching singleton) is reasonable for the current single-tenant load, but re-evaluate it as concurrent tenant traffic grows — serverless functions each get their own connection pool up to platform concurrency limits, so pool exhaustion is a real failure mode at scale, not a theoretical one. Monitor active-connection counts via MongoDB Atlas's own metrics and increase `maxPoolSize` (or move to Atlas's Data API / a connection-pooling proxy) if connection-limit errors appear under load, rather than guessing at a number now.
- **Plan the Atlas cluster tier upgrade path explicitly** rather than reactively — decide in advance what usage signal (connection count, query latency p95, storage size) triggers a tier upgrade, so it happens before it becomes an incident rather than during one.
- **Load-test before major sales pushes.** Before onboarding a batch of new tenants from a successful sales week, or before a Premium tenant with several hundred students goes live, run a basic load test (k6 or Artillery against a staging environment seeded with realistic multi-tenant data volume) against the highest-traffic paths: login, dashboard stats, the QR check-in endpoint (which will see genuine concurrent bursts at the start of every class session across every tenant simultaneously), and the AI chat endpoint.
- **Groq API scale considerations**: as tenant count and Premium-tier adoption grow, a single shared Groq API key (current setup, `lib/ai/groq-client.ts`) will encounter Groq's own account-level rate limits under concurrent multi-tenant usage, independent of the per-tenant quota system built in Phase 3.3. Monitor Groq's rate-limit response headers in production and be ready to either request a higher account tier from Groq or shard traffic across multiple API keys/accounts if concurrent AI usage across tenants approaches those limits — this is a "watch and respond" item, not something to over-engineer before there's real multi-tenant AI traffic to measure.

### 12.4 Security & compliance (the original scope of this phase)

- **Session revocation**: with JWT sessions, a deactivated user or a suspended tenant (Phase 2's `status: 'SUSPENDED'`) doesn't lose access until their token expires. Either shorten `maxAge` meaningfully, add a lightweight per-request "is this tenant still active" check (cache-friendly — check a cheap `Tenant.status` lookup, not a full re-auth) on sensitive routes, or migrate to database-backed sessions if this becomes a real support issue. Given SaaS billing (suspend-on-nonpayment) is a real workflow now, this is more important than it was pre-SaaS.
- **Rate limiting rollout**: extend Phase 0.4's initial three endpoints to all write-heavy and public endpoints (`/api/attendance/check-in`, `/api/devices/pair`, all `/api/admin/ai-assistant/*` routes, the public admissions form from 5.7, the marketing site's demo-request form from 4.1) using the same Upstash-based approach for consistency.
- **CSP and security headers**: complete what Phase 0.4 started — a real Content-Security-Policy (mind that Cloudinary images, Groq's SSE responses, and any future Socket.io/Ably connections for Phase 5.10 need explicit allowances).
- **Data protection / local compliance**: this product stores minors' CIN numbers, photographs, ID-card scans, and guardian contact details. Beyond generic good practice, check Tunisia's INPDP (Instance Nationale de Protection des Données Personnelles) requirements for handling personal data of minors as a data controller — this affects the privacy policy content (Phase 4.1) and may require an explicit parental-consent capture step in the admissions flow (5.7) beyond the existing `declarationAccepted` boolean. Make three specific things concrete rather than leaving compliance as a "check requirements" note: (1) **data residency** — pick the MongoDB Atlas cluster region deliberately (an EU region is generally the safer default for Tunisia-resident personal data than a US region, pending an actual INPDP-focused legal read) and document the choice, rather than defaulting to whatever region Atlas suggests; (2) **a written data-retention policy** — how long does a withdrawn/graduated student's data (photo, CIN scan, attendance history) stay in the system after they leave, and who decides; (3) **a deletion/export workflow** — when a tenant asks you to delete a specific student's data (a guardian's legal right, not just a nice-to-have), there needs to be an actual, tested procedure (a script or an admin-console action, not "run a manual Mongo query"), and likewise a tenant should be able to export the entirety of their own data on request, both for trust and because you will eventually lose a customer and they will ask for their data back — build that path before you need it under pressure.
- **Backups & disaster recovery**: confirm the MongoDB hosting plan (Atlas or otherwise) has automated backups with a tested restore process — with real tenants' operational data (attendance history, payment records) on the line, "we have a backup we've never restored from" is not an acceptable state.
- **Secrets management**: move away from any remaining hardcoded fallback values (Phase 0.2 covers `NEXTAUTH_SECRET`; do a final pass for any others) and adopt your hosting platform's proper secrets management (Vercel environment variables scoped per environment, not committed `.env` files).

**Definition of Done for this phase:** every list endpoint is paginated; every compound index leads with `tenantId`; every Cloudinary-sourced image renders through `next/image` with format/size optimization; a load test against realistic multi-tenant data volume passes on the critical paths (login, check-in, dashboard, AI chat) at a target p95 latency you've explicitly set; and every item in §12.4 is closed out.

---

## 13. Phase 9 — Testing Strategy (P3, but start earlier for Phase 3's AI work specifically)

**Why:** confirmed zero test infrastructure exists anywhere in the repo today (§2.8). For a multi-tenant product, the single most valuable category of test is **tenant-isolation regression tests** — the audit's core finding is that data leakage risk is systemic, not a one-off bug, so it needs a systemic test strategy, not spot-checks.

- **Framework choice**: Vitest (fast, ESM-native, integrates cleanly with the existing TypeScript/Next.js setup) for unit and integration tests; Playwright for end-to-end flows.
- **Priority test suites, in order:**
  1. **Tenant isolation**: for every tenant-scoped model, a test that creates two tenants with overlapping data (same-named room, same-shaped student records) and asserts every list/get/search endpoint (including every AI tool from Phase 3) returns only the calling tenant's data. This is the regression suite that protects the entire Phase 1 investment.
  2. **AI tool-executor validation**: the 5 previously-unvalidated write paths, the 6 previously-unescaped search paths, and the tenant-scoping fix from Phase 3.1 (highest complexity, zero prior coverage, highest blast radius).
  3. **Auth/RBAC**: the specific bugs fixed in Phase 0 (attendance PATCH authorization, teacher layout role check) as permanent regression tests so they can't silently regress.
  4. **E2E critical paths**: login → dashboard, QR check-in (scanner token flow), AI assistant search→approve→execute cycle, payment marking → receipt generation.
- **CI integration**: add a GitHub Actions (or equivalent) workflow running lint + typecheck + test on every PR — there is currently no CI at all, so this is also new infrastructure, not just new tests.

---

## 14. Phase 10 — DevOps, Deployment & Observability (P3)

- **Background jobs**: several Phase 5 features need scheduled/async execution that doesn't fit a request-response Next.js API route — the WhatsApp absence-alert (10-minute delay), dunning reminders, AI quota resets, and OTA/device-config refreshes. Use Vercel Cron Jobs for simple scheduled tasks (daily/hourly triggers hitting an API route) given the existing Vercel-oriented deployment; escalate to a dedicated queue (e.g., Inngest, or a small worker process) only if job volume/complexity outgrows cron-triggered routes.
- **Environments**: formalize dev/staging/production separation — currently only `.env.local` exists. Staging matters more now than pre-SaaS, since multi-tenant migrations (Phase 1.7) and AI-tool changes (Phase 3) are exactly the kind of change you want to verify against realistic multi-tenant data before touching the production tenant.
- **Monitoring**: add error tracking (Sentry is a reasonable default, has good Next.js support) — today a production error is only visible via Vercel's function logs. Add a lightweight Groq-cost dashboard (even a simple internal page reading the `AiUsageLog` from Phase 3.3, grouped by tenant) so AI costs don't surprise you.
- **Custom domains / subdomains for tenants**: if Phase 1.4's subdomain-per-tenant login approach is adopted, this requires wildcard DNS + wildcard SSL on Vercel (supported, but needs explicit setup) — budget this as part of Phase 1, not an afterthought.
- **Operator/product analytics — a different thing from Phase 5.9's tenant-facing analytics.** Phase 5.9 builds analytics *for* a tenant's admin, about their own students. You, running the business, need a separate view: which tenants are actually logging in and using which features, which ones haven't touched the AI assistant since onboarding, which ones are approaching a plan limit (a natural upsell trigger), and which ones haven't logged in for 30+ days (a churn signal worth a phone call, tying directly into §6.6's renewal work). A lightweight product-analytics tool (PostHog is a reasonable self-hostable-or-cloud default) wired into the app, with a simple per-tenant activity summary surfaced in `/super-admin/tenants/[id]`, is enough for this stage — don't build a custom analytics pipeline for it.
- **A minimum-viable support channel.** Right now, if a tenant admin hits a problem, there is no in-product way to reach you at all. Before scaling past direct hand-holding for every client, add at least a "Contact Support" action in the dashboard (even something as simple as a `mailto:`/WhatsApp deep link pre-filled with the tenant's name and plan, or a lightweight ticket form writing to a `SupportTicket` collection surfaced in the super-admin console) — this doesn't need to be a full helpdesk product, but "no way to ask for help" is not acceptable once you're not the only person a tenant has ever spoken to.
- **A status page**, once there are enough tenants that an outage affects more than one relationship you're managing personally — even a minimal static or third-party-hosted status page communicates operational maturity to institutional buyers evaluating whether to trust you with their operations, and gives you one place to post planned-maintenance notices instead of ad hoc phone calls.

---

## 15. Suggested Execution Sequence

```
Phase 0  (P0 — security/correctness fixes)         ─┐
                                                      ├─ Do concurrently, Phase 0 blocks nothing else structurally
Phase 1  (P1 — multi-tenant data layer)             ─┘  but should land first in practice since Phase 1 touches
   │                                                     the same files as Phase 0's fixes.
   ▼
Phase 2  (P1 — super-admin & billing)  ──┬─ Can start once Phase 1's Tenant model exists,
Phase 3  (P1 — AI hardening)            ─┤  even before Phase 1 is 100% complete across
Phase 4  (P1 — landing page)            ─┘  every route — these three can run in parallel.
   │
   ▼
Phase 5  (P2 — vertical features)  ── build incrementally, one sub-feature at a time,
   │                                   each independently shippable/demoable to prospects.
   ▼
Phase 6  (P3 — mobile hardening)         ──┬─ Do once ≥2 real tenants need the tablet
Phase 7  (P3 — payment infra)             ─┤  scanner — not urgent for a single-tenant
Phase 8  (P3 — perf/scale/security)      ─┤  pilot.
Phase 9  (P3 — testing)                   ─┤  Testing (9) should start earlier in practice —
Phase 10 (P3 — DevOps)                    ─┘  specifically alongside Phase 3's AI work, per
                                               that phase's own Definition of Done.
```

**The one hard dependency to respect:** do not build any Phase 5 feature without giving its new model a `tenantId` field from day one, following the Phase 1 pattern exactly. Retrofitting tenant-scoping onto a feature built without it is exactly the expensive rework this plan's Phase 1 exists to do once, comprehensively — don't recreate that debt.

**Two items inside Phase 8 are exceptions to "wait until P3":** compound-index field ordering (§5.1/§12.1) must be correct from the moment `tenantId` is added in Phase 1 — it's far cheaper to define an index correctly once than to rebuild it on a live collection later — and basic list-endpoint pagination (§12.1) should land alongside whichever Phase 1/5 feature introduces or touches a given list route, rather than being batched into a single later pass across the whole API surface. Treat the rest of Phase 8 (load testing, image-pipeline optimization, connection-pool tuning, archival) as genuinely deferrable until real multi-tenant scale exists to tune against.

---

## 16. Appendix A — Full API Route Inventory (for Phase 1.3's manual scoping checklist)

All 47 route files under `app/api/**`, grouped by domain, each needing a `tenantId` filter added to every query during Phase 1.3 (checkboxes for tracking):

**Auth:** `auth/[...nextauth]/route.ts`, `auth/change-password/route.ts`

**Students:** `students/route.ts`, `students/[id]/route.ts`, `students/[id]/qr/route.ts`, `students/next-enrollment/route.ts`

**Teachers:** `teachers/route.ts`, `teachers/[id]/route.ts`, `teachers/feedback/route.ts`, `teachers/grades/route.ts`

**Sessions:** `sessions/route.ts`, `sessions/[id]/route.ts`, `sessions/[id]/students/route.ts`, `sessions/[id]/attendance/route.ts`, `sessions/generate-occurrences/route.ts`

**Rooms:** `rooms/route.ts`, `rooms/[id]/route.ts`, `rooms/[id]/availability/route.ts`

**Schedule:** `schedule/route.ts`, `schedule/conflicts/route.ts`, `schedule/auto-assign/route.ts`

**Attendance:** `attendance/route.ts`, `attendance/[id]/route.ts`, `attendance/by-date/route.ts`, `attendance/check-in/route.ts` (tenant resolved via device token, not session — see §10.1), `attendance/test/route.ts`

**Payments:** `payments/route.ts`, `payments/bulk/route.ts`, `payments/status/route.ts`

**AI Assistant:** `admin/ai-assistant/chat/route.ts`, `admin/ai-assistant/execute/route.ts`, `admin/ai-assistant/history/route.ts` (see Phase 3 in full)

**Admin — Claims & Accounts:** `admin/claims/route.ts`, `admin/student-accounts/route.ts`, `admin/student-accounts/[id]/reset-password/route.ts`

**Dashboard:** `dashboard/stats/route.ts`

**Documents:** `documents/route.ts`, `documents/[id]/route.ts`

**Uploads:** `upload/route.ts` (see §5.5 for Cloudinary namespacing)

**Settings:** `settings/route.ts`

**Student Portal:** `student/dashboard/route.ts`, `student/attendance/route.ts`, `student/attendance/claim/route.ts`, `student/sessions/route.ts`, `student/schedule/route.ts`, `student/performance/route.ts`, `student/documents/route.ts`, `student/profile/route.ts`, `student/onboarding/route.ts`

**New in this plan:** `devices/pair/route.ts`, `devices/config/route.ts` (Phase 6); `subscriptions/*` or fold into `super-admin/*` (Phase 2); `enroll/[tenantSlug]/route.ts` (Phase 5.7); notification webhook receivers (Phase 5.2).

---

## 17. Appendix B — Glossary

- **Tenant**: one paying customer organization (an association, private school, or training institute) — the root of data isolation.
- **Tenant Zero**: the existing, currently-live Sfax Quran association, migrated into the first `Tenant` record during Phase 1.7.
- **`SUPER_ADMIN`**: you/your platform team — cross-tenant access for provisioning and billing, distinct from a tenant's own `ADMIN`.
- **Pending action**: the AI assistant's human-approval gate for any write tool — an unexecuted proposed action stored on `Conversation.pendingActions` until an admin approves or rejects it.
- **Entitlement**: a plan-gated feature check (`requireTier`) — the mechanism that turns the Starter/Standard/Premium pricing table into actual enforced behavior.

---

## 18. Appendix C — Non-Goals & Explicit Deferrals

A plan this size needs a place to record what was *considered and deliberately not scheduled*, so a future re-read doesn't mistake an absence for an oversight, and so scope doesn't quietly creep back in without a decision behind it. Revisit any of these only when a specific, real signal (not speculation) justifies it:

- **Database-per-tenant.** Rejected in §3.1 in favor of shared-database, `tenantId`-scoped multi-tenancy, given `lib/db.ts`'s existing connection-caching architecture and realistic year-one tenant counts. Revisit only if a single enterprise customer's compliance requirements demand physical data isolation, which is not a signal present in the current Tunisia-focused, cash-billed customer base.
- **Self-serve card-based checkout for platform subscriptions.** Deferred in Phase 7.3 — the go-to-market is direct field sales with manual bank-transfer/check/cash billing (Phase 2), which is the right fit for the target customer. Revisit if/when the business expands to inbound self-serve signups beyond what a founder can personally close.
- **A payment gateway for family tuition.** Deferred in Phase 7.1/7.2 for the same local-market-fit reason (Stripe doesn't settle in TND; most families pay cash/transfer directly to the association, not through the platform). The concrete improvement instead is better tooling around the existing manual ledger (receipts, reminders).
- **A `GUARDIAN`/`PARENT` role distinct from `STUDENT`.** Deferred in §3.3 — the existing pattern (a parent operates through a student-scoped login) is adequate today. Revisit if the Family model (5.6) shows real demand for a true multi-child guardian dashboard.
- **Per-branch access restriction for teachers.** The Branch model (§3.6) is built, but teacher authorization stays tenant+role+ownership scoped, not branch-scoped, because nothing in the validated sales material asks for it. Don't build the narrower boundary speculatively.
- **A public API / webhooks for third-party integrations** (e.g., a future integration with a ministry-of-education reporting system, or an accounting package). Not scheduled anywhere in this plan. Revisit only once a specific paying customer asks for a specific integration — building a general-purpose public API speculatively, before any consumer of it exists, is exactly the kind of premature abstraction this plan otherwise argues against.
- **SSO/SAML enterprise login.** Not needed for the current customer profile (small-to-mid-size associations with a handful of staff accounts); the existing credentials-based NextAuth setup is appropriate. Revisit only if a genuinely large institutional customer with existing SSO infrastructure requires it as a purchase condition.
- **A native mobile app for admins/teachers beyond the QR scanner.** The scanner app (Phase 6) has one job and should keep it. A responsive, mobile-first web dashboard (§3.5.5) is the right way to serve teacher/admin mobile use for now, rather than building and maintaining a second native app surface.
- **Machine-learning-based dropout prediction.** Phase 5.9 explicitly chooses a transparent, rules-based risk flag over an ML model — an admin needs to understand and trust *why* a student is flagged, and a rules-based approach is both easier to build correctly and easier to explain in a sales conversation than a black-box score.
- **Multi-region / multi-cloud deployment.** Single-region deployment (with a deliberately chosen region per §12.4's data-residency note) is sufficient for a Tunisia-focused customer base. Revisit only alongside genuine geographic expansion.
- **Real-time push (WebSocket/SSE) for the in-app notification center (5.12).** Start with polling/refetch-on-navigation; only build real-time push if usage data shows the delay is a real problem, not by default.
- **Q-Arena's full feature set** (audio-recitation questions, the "Quran Economy" power-up mode, live word clouds). Phase 5.10 explicitly scopes v1 to a single live-quiz mode and defers the rest — the full vision is worth keeping on record, just not in the first shippable version.
