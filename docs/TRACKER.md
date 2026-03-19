# AtlasPM — Project Tracker

Last Updated: 2026-03-18 (Onboarding wizard v2 session)

---

## Wave Status

### Wave 1 — Data Trust
- [x] W1-A: Payments cascade fix (recalculateTenantBalance)
- [x] W1-B: Vacancy state consolidation (syncVacancyState)
- [x] W1-C: Status vocabulary normalization (src/lib/constants/statuses.ts)
- [x] W1-D: Missing DB indexes (Unit, ProjectMilestone, CronLog, ImportLog, CollectionNote, Violation)

### Wave 2 — Security Hardening
- [x] W2-A: Org scoping gap fix (13 orgless fallback paths removed)
- [x] W2-B: Auth rate limiting (DB-backed via LoginAttempt)
- [x] W2-C: Write route validation sweep (Zod on all write routes)
- [x] W2-D: Import hardening sweep (file validation, row limits, error shape)

### Wave 3 — Product Refinement
- [x] W3-A: Consolidate Owner Dashboard and Owner Portal
- [x] W3-B: Internal naming cleanup (Argus/Coeus/Themis → plain English)
- [x] W3-C: Empty-state and loading-state audit (Dashboard, Users, Calendar, Scorecard fixed)
- [x] W3-D: Redirect and alias cleanup
- [x] W3-E: Dashboard metrics refinement
- [x] W3-F: Sentry configuration fix

### Wave 4 — Workflow Tests
- [x] W4-A: Collections workflow tests
- [x] W4-B: Import workflow tests
- [x] W4-C: Vacancy lifecycle tests
- [x] W4-D: Owner data visibility tests

### Wave 5 — Demo and Rollout Readiness
- [x] W5-A: Demo seed (prisma/seed-demo.ts — 3 buildings, 19 tenants, violations, legal cases)
- [x] W5-B: Demo walkthrough (docs/DEMO-WALKTHROUGH.md — 15-min, 29-step guide)
- [x] W5-C: README + onboarding guide (README.md + docs/CLIENT-ONBOARDING.md)

### Bug Fixes
- [x] Bug 1: Owner data leak (commit ebfe048)
- [x] Bug 2: Org scoping fail-closed (verified OK, no fix needed)
- [x] Bug 3: Owner dashboard violations column (W3-E)
- [x] Bug 4: Building legal count display (W3-E)
- [x] Bug 5: Owner routes leak into /data pages (commit b44c562)
- [x] Bug 6: Collections status vocabulary drift (commit 08bc00f — see docs/BUGFIX-REPORT-BUG6-2026-03-18.md)
- [x] Bug 7: Public request honeypot not working (commit d306999)

### Additional
- [x] reset:demo script (scripts/reset-demo.ts — FK-safe demo data cleanup)
- [x] Onboarding-ready checklist (docs/ONBOARDING-READY.md)
- [x] seed-demo.ts ViolationWhereUniqueInput — confirmed already correct (source_externalId matches @@unique)

### Permission System v2
- [x] P1: Schema — UserAccessGrant model + permission fields on User (commit 753c0cd)
- [x] P2: Types — 8 modules, 4 levels, 7 presets in src/lib/permissions/types.ts
- [x] P3: Presets — PERMISSION_PRESETS + PRESET_DANGEROUS_DEFAULTS in src/lib/permissions/presets.ts
- [x] P4: Engine — can(), getEffectiveLevel(), createGrantsFromPreset(), getUserWithGrants() in src/lib/permissions/engine.ts
- [x] P5: Seed — 10 existing users seeded with grants via scripts/seed-permissions.ts
- [x] P6: Middleware — role-based route protection for /users, /owner-dashboard, OWNER blocked paths
- [x] P7: API routes — invite, permissions PATCH/GET with audit logging, updated GET /api/users
- [x] P8: Admin UI — Team & Permissions page at /settings/users with invite/edit drawer
- [x] P9: Schema — PermissionAuditLog model for tracking permission changes

### Onboarding Wizard v2
- [x] Part 1: Schema — UserPreferences model
- [x] Part 2: Preferences API — GET/PATCH /api/user/preferences
- [x] Part 3: Terms API — POST /api/user/terms with IP logging
- [x] Part 4: 6-step wizard — Legal → Personal → Access → Briefing → Alerts → Tour
- [x] Part 5: Preferences page at /settings/preferences + sidebar nav
- [x] Fix: Moved [userId]/permissions → [id]/permissions to resolve Next.js slug conflict

### ODK Command Center
- [x] PIN verification API with timing-safe comparison + rate limiting
- [x] Middleware protection — /ODK/* uses separate JWT auth, not NextAuth
- [x] Login page — dark, minimal, auto-submit, shake on wrong PIN
- [x] Command center dashboard — 5 tabs (Roadmap, Docs, Checklist, Tech, Notes)
- [x] Live status sidebar with build status, quick links, key numbers
- [x] API routes: /api/command/verify, tracker, docs, status
- [x] Deployed to production at myatlaspm.com/ODK

---

## Active Work
- ODK command center deployed — accessible at myatlaspm.com/ODK
- IMPORTANT: Set ATLAS_COMMAND_PIN=xd933f5 in Vercel env vars (production + preview)
- Next: Phase 0 tasks — LLC, password manager, Supabase backups, first Yardi import

## Deployment
- Production: https://www.myatlaspm.com
- ODK: https://www.myatlaspm.com/ODK
- Last deploy: 2026-03-18
- Build: 0 TypeScript errors, 34 static pages

## Known Issues
- Sentry configuration warnings (instrumentation file migration recommended by @sentry/nextjs)
- Prisma 5.22.0 → 7.x upgrade available (major version, not urgent)
- ESLint config needs interactive setup (npm run lint prompts for config selection)
- Existing DB rows with old CollectionCase.status values (new_arrears, reminder_sent) still work via normalizer but should be migrated to canonical values (monitoring, demand_sent) when convenient
- Permission system v2 runs alongside existing role system — old routes still use hasPermission(), new routes should use can()
- Permission management UI built at /settings/users — needs sidebar nav link added
- First-login password change flow not yet implemented (users receive temp password)
- [userId] slug directory removed — permissions route moved to [id]/permissions
- ATLAS_COMMAND_PIN must be set in Vercel env vars manually (could not auto-set via CLI)
