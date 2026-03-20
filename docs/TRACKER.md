# AtlasPM — Project Tracker

Last Updated: 2026-03-19 (Full QA Audit Complete)

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
- [ ] W3-A: Consolidate Owner Dashboard and Owner Portal into one experience
- [ ] W3-B: Internal naming cleanup (Argus/Coeus/Themis → plain English) is still partial in the live UI
- [x] W3-C: Empty-state and loading-state audit (Dashboard, Users, Calendar, Scorecard fixed)
- [x] W3-D: Redirect and alias cleanup
- [x] W3-E: Dashboard metrics refinement
- [x] W3-F: Sentry configuration fix — full observability stack: dev/prod sample rates, replay integration, component annotation, sourcemap upload+deletion, SentryUserContext, structured error capture in withAuth/withCronAuth/violation-sync/email-service, test page at /test-error (2026-03-19)

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
- [x] Pre-pilot business & architecture review (docs/AUDIT-CODEX-2026-03-18.md)
- [x] Full codebase audit — Claude Code (docs/AUDIT-CLAUDE-CODE-2026-03-18.md)
- [x] Full QA audit — 2026-03-19 (docs/QA-AUDIT-REPORT.md) — 4 critical, 13 high, 24 medium, 20 low findings

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
- [x] Middleware protection — /odk/* uses separate JWT auth, not NextAuth
- [x] Login page — dark, minimal, auto-submit, shake on wrong PIN
- [x] Command center dashboard — 5 tabs (Roadmap, Docs, Checklist, Tech, Notes)
- [x] Live status sidebar with build status, quick links, key numbers
- [x] API routes: /api/command/verify, tracker, docs, status
- [x] Deployed to production at myatlaspm.com/odk
- [x] Roadmap tab synced to TRACKER.md at runtime (no more hardcoded data)

---

### Collections Phase 2 — Protocol & Stage Tracking
- [x] CP2-1: Schema — CollectionStage, CollectionAction, CollectionProtocol models + Tenant relations + migration
- [x] CP2-2: Service layer — collectionsStageService.ts (getOrCreateStage, logAction, advanceStage, getOverdueAlerts, getDecisionRecommendation)
- [x] CP2-3: API routes — stage-alerts GET, tenants/[id]/stage GET, tenants/[id]/action POST, tenants/[id]/advance-stage POST
- [x] CP2-4: UI — Stage alert banner, stage badge column, LogActionModal, tenant detail stage panel + decision recommendation + action timeline + advance stage
- [x] CP2-5: Backfill cron — collectionsBackfill.ts + /api/cron/collections-refresh route

### Utilities Module Fixes (2026-03-19)
- [x] UTL-1 (HIGH): Enforce one active account per meter — DB constraint + transaction guard + UI warning
- [x] UTL-2 (HIGH): Snapshot tenant identity on utility account — schema fields + open form tenant selector + immutable snapshots
- [x] UTL-3 (MEDIUM): Fix three broken KPI drilldowns — Not Recorded, Transfer Needed, Risk Signals now link to correct filters
- [x] UTL-4 (MEDIUM): Fix duplicate meter creation on import — match hierarchy: accountNumber > meterNumber+type > unit+type
- [x] UTL-5 (MEDIUM): Exclude common/master meters from risk engine — classification field + backfill + classification-aware rules

### Utility Phase 1+2 — Event History + Automation (2026-03-19)
- [x] UP1-1: Schema — UtilityResponsibilityEvent, UtilityTask models + workflowState on UtilityAccount
- [x] UP1-2: Responsibility event service — immutable audit log for all utility changes
- [x] UP1-3: Utility task service — CRUD, batch creation, dashboard counts
- [x] UP1-4: Event recording hooks — account open/close trigger event recording
- [x] UP1-5: Event history on meter detail API + EventHistorySection in modal
- [x] UP2-1: Automation service — onMoveOutRecorded, onUnitBecameVacant, onNewTenantCreated, onVacancyClosed
- [x] UP2-2: Task API routes — GET/POST tasks, GET/PATCH tasks/[id], GET counts
- [x] UP2-3: Vacancy + tenant route hooks — fire-and-forget automation on lifecycle events
- [x] UP2-4: Signal engine — 3 new rules (task overdue, owner hold pending, old tenant active)
- [x] UP2-5: Tests — 10 new automation tests (29 total utility tests)

### Atlas Comms V1 (2026-03-19)
- [x] AC-1: Schema — Conversation, ConversationMember, Message, MessageAttachment, MessageReaction, MessageMention, PinnedMessage + enums
- [x] AC-2: Service layer — conversation.service.ts (DM, group, entity threads, list, detail, archive, mute, members, mark-read)
- [x] AC-3: Service layer — message.service.ts (send, system events, list with sender names, attachments, reactions, pin, delete)
- [x] AC-4: Service layer — work-order-events.service.ts (status, priority, assignment, vendor, completion events)
- [x] AC-5: API routes — conversations CRUD, messages, mark-read, members, entity-thread (generic), search, unread-count
- [x] AC-6: Work order integration — PATCH route emits status/priority/assignment/vendor/completion events; POST emits creation event
- [x] AC-7: Frontend — CommsLayout, ConversationSidebar (tabs/search/entity labels), ConversationView, MessageBubble, MessageComposer
- [x] AC-8: Frontend — NewConversationModal (DM/group, member search, record linking via RecordPicker)
- [x] AC-9: Frontend — EntityChatTab (generic, replaces WorkOrderChatTab)
- [x] AC-10: Pages — /comms, /comms/direct, /comms/groups, /comms/work-orders, /comms/unread
- [x] AC-11: Chat tabs — Work Order detail modal (Chat tab), Tenant/Collections profile (Discussion section)
- [x] AC-12: Navigation — Communications link in sidebar with unread badge (polling 30s)
- [x] AC-13: Hooks — useConversations, useMessages, useSendMessage, useEntityThread, useUnreadCount, etc.

### Intelligence Layer V1 (2026-03-19)
- [x] INT-1: Schema — DecisionLog model for learning loop (outcome tracking, 7d/30d result evaluation)
- [x] INT-2: Attention Score Engine — cross-module 0-100 scoring for tenants and buildings (arrears, signals, legal, vacancy, WOs, utilities, lease risk, staleness)
- [x] INT-3: Action Card Engine — universal next-best-action cards from decision engine + collection stage + signals
- [x] INT-4: Decision Learning Loop — log shown/acted/overridden/dismissed + delayed outcome evaluation
- [x] INT-5: API routes — attention/tenant, attention/building, attention/rankings, attention/action-cards, attention/decision-log
- [x] INT-6: Thread Summary — AI-powered conversation summarization via Claude (POST /api/comms/conversations/[id]/summarize)
- [x] INT-7: UI — AttentionBadge, ActionCard components, wired into tenant detail page
- [x] INT-8: Comms AI — AI Enhance button in MessageComposer, thread summary button in ConversationView
- [x] INT-9: Hooks — useTenantAttention, useBuildingAttention, useAttentionRankings, useActionCards, useLogDecision, useSummarizeThread

### Auto-Repair Run (2026-03-19 21:30)
- [x] M3: Cron timing-safe auth — collections-refresh now uses withCronAuth()
- [x] H8: Tenant PATCH Decimal serialization — all Decimal fields normalized via toNumber()
- [x] M8: Stage regression guard — advanceStage() rejects newStage <= currentStage
- Verified already fixed: C1, C2, C3, C4, H2, H4, H5, H6, H10, M9

### RGB Orders Constants (2026-03-19)
- [x] Hardcoded RGB orders 2005-2026 (22 entries) in src/lib/constants/rgb-orders.ts
- [x] Helper functions: getRGBOrderByYear, getRGBOrderByNumber, calculateLegalRentIncrease, getRGBOrderForLeaseDate
- Note: 2026 Order #57 may not be finalized — verify at nyc.gov/rgb before production use

**QA audit open findings — top 3 next repair candidates:**
1. H9: SUPER_ADMIN organizationId! null dereference in 20+ routes
2. H7: Signal engine N+1 sequential DB calls in loops
3. H12: 7+ pages silently break on API failure (no isError checks)

### Two-Agent Audit/Repair Loop (2026-03-19)
- [x] Codex audit workflow — runs every 6h (0/6/12/18 UTC), reads code, writes structured findings
- [x] Claude repair workflow — runs 1h after audit (1/7/13/19 UTC), fixes top 1-3 safe issues
- [x] Audit prompt: docs/audits/CODEX-AUDIT-PROMPT.md
- [x] Repair prompt: docs/audits/CLAUDE-REPAIR-PROMPT.md
- [x] GitHub Actions: .github/workflows/codex-audit.yml, claude-repair.yml
- Note: Requires OPENAI_API_KEY and ANTHROPIC_API_KEY as GitHub repo secrets

### Sentry Load Test (2026-03-19)
- [x] scripts/sentry-load-test.mjs — continuous load test generating errors, warnings, and performance transactions
- [x] GitHub Actions workflow (.github/workflows/sentry-load-test.yml) — runs every 2h
- [x] npm script: sentry:loadtest
- Note: Requires NEXT_PUBLIC_SENTRY_DSN as GitHub repo secret

## Active Work
- Sentry observability complete — test pages, load test script, and GitHub Actions workflow all deployed
- Two-agent loop live — Codex audits every 6h, Claude repairs 1h later
- Intelligence Layer V1 complete — cross-module attention scoring, action cards, decision learning loop, thread summaries
- IMMEDIATE: Fix 3 Decimal serialization routes + 2 missing transactions + audit balance/vacancy sync call sites
- NEXT: Migrate 12 old role-check routes to can() helper, add pagination to 7 unbounded queries
- THEN: Start Stripe billing models and integration
- ODK command center deployed — accessible at myatlaspm.com/odk

## Deployment
- Production: https://www.myatlaspm.com
- ODK: https://www.myatlaspm.com/odk
- Last deploy: 2026-03-19
- Build: 0 TypeScript errors, 47 static pages

## Known Issues

### QA Audit — Critical (2026-03-19)
- RGB Orders API routes have no org scoping — cross-org data leak (GET/POST/PATCH/DELETE)
- `syncAllBuildings` violation sync crosses org boundaries — writes violations to other orgs' buildings
- `/turnovers/[id]` shows perpetual loading skeleton on non-existent ID — no not-found handling
- Violations/stats route gives ADMIN role cross-org visibility (should be SUPER_ADMIN only)

### QA Audit — High (2026-03-19)
- Onboarding company PATCH has no permission guard — any role can update org
- Two competing collection score algorithms (scoring.ts vs collections.service.ts) produce different results
- AR aging report double-counts 90+ and 120+ buckets (same `balance90plus` value used for both)
- Tenant PATCH dual-write (tenant + lease) not wrapped in transaction
- Payment deletion does not call `recalculateTenantBalance()` — balance drift
- Signal engine N+1: sequential DB calls per signal in loops
- Tenant detail GET returns raw Prisma Decimal objects as strings
- SUPER_ADMIN `organizationId!` null dereference in 20+ routes
- `collectionScore >= 80` used as proxy for "in legal" in collections report
- Legal review queue exposes null-candidateTenantId items across orgs
- 7+ dashboard pages silently break when API calls fail (no isError checks)
- 30 API routes have unbounded findMany() with no take/limit
- `/collections/[tenantId]` renders misleading page for invalid tenant IDs

### Pre-existing Known Issues
- Atlas Comms uses polling (5s messages, 30s unread count) — upgrade to Supabase Realtime in V2
- Atlas Comms file uploads not yet implemented — Supabase Storage bucket `comms-attachments` needs creation and client integration
- Entity thread types violation, legal_case, turnover return 501 — V2 feature
- Building and Unit detail pages are modals, not full pages — Chat tabs not yet added (only WO modal and Tenant page have chat)
- No @mention autocomplete in MessageComposer — mentions are tracked server-side but not suggested in UI
- Pre-existing TS error in utilities/accounts/route.ts (leaseStart → leaseStatus) — not introduced by Comms
- CollectionStage backfill cron (/api/cron/collections-refresh) needs Vercel cron job configured to run daily
- VERCEL_TOKEN missing from .env.local — deployment must be done manually until added
- CollectionProtocol defaults are hardcoded per-org; no admin UI to customize stage trigger days yet
- Owner Dashboard and Owner Portal are still both live; the owner experience is not yet fully consolidated
- Internal naming cleanup is incomplete — Coeus, Themis, and ODK remain visible in the product/docs
- Permission system v2 runs alongside the existing role system — old routes still use hasPermission(), new routes use can()/grants
- UserAccessGrant is ahead of the rest of the app — multi-org users are not actually supported end-to-end
- No subscription / billing model exists yet, so AtlasPM is not ready for Stripe plan enforcement or customer self-serve billing
- Onboarding remains founder-heavy despite docs promising very fast setup
- Demo seed is strong for a guided demo but too small to fully simulate a 1,000-unit client environment
- Long-running imports, syncs, and cron-style workloads still sit on the Vercel/serverless model; background workers are the next infrastructure need
- Documentation drift exists: requested roadmap filename differs from repo, tracker was more optimistic than the current product state, and onboarding docs still reference an admin password directly
- Sentry fully configured (2026-03-19) — full observability with structured capture, replay, sourcemaps; set NEXT_PUBLIC_SENTRY_DSN and SENTRY_AUTH_TOKEN in Vercel env vars; test at /test-error and /sentry-example-page
- Prisma 5.22.0 → 7.x upgrade available (major version, not urgent)
- ESLint config needs interactive setup (npm run lint prompts for config selection)
- Existing DB rows with old CollectionCase.status values (new_arrears, reminder_sent) still work via normalizer but should be migrated to canonical values (monitoring, demand_sent) when convenient
- Permission management UI built at /settings/users — needs sidebar nav link added
- First-login password change flow not yet implemented (users receive temp password)
- [userId] slug directory removed — permissions route moved to [id]/permissions
- ATLAS_COMMAND_PIN must be set in Vercel env vars manually (could not auto-set via CLI)
- 3 API routes return Prisma Decimal without toNumber() (risk-map, court-dates, violations) — financial display risk
- 2 multi-table write routes missing transactions (violations/create-work-order, work-orders/evidence)
- 12 API routes still use inline ADMIN_ROLES checks instead of can() helper
- 7 API routes have unbounded findMany() with no take/limit — Vercel timeout risk at scale
- 5 API routes missing try/catch error handling
- 2 GET routes (tenants/notes, tenants/[id]/payments) missing permission string in withAuth
- NYC Open Data sync has no rate limit handling or retry logic
- ODK PIN rate limiting is in-memory only (resets on cold start)
- 13 dashboard pages missing EmptyState components
- 30+ console.log calls should use logger
