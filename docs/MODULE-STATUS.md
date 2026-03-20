# AtlasPM — Module Status Report
**Date:** 2026-03-20
**Commit:** 628f88d

---

## 1. Collections

### Current State
**What works:** Dashboard KPIs, paginated AR list with filters, collection notes with AI enhance, status management, send-to-legal flow, bulk operations, 6-stage protocol system (Phase 2), tenant detail page with balance chart/aging/timeline/stage panel/decision recommendations, AR aging report, export, stale tenant detection, alert system.

**What's broken:**
- Dual scoring algorithms (`scoring.ts` vs `collections.service.ts`) produce different results
- AR aging 120+ bucket double-counts (reuses `balance90plus` value)
- Stage column only shows for tenants with overdue alerts, not all staged tenants
- Backfill cron not deployed to Vercel

**What's missing:** Manual payment entry, payment plan tracking, automated stage advancement, tenant-facing email/SMS, bulk case creation from import.

### Top 3 ROI Improvements
1. **Fix stage column display** — show stage badges for all delinquent tenants, not just overdue (Low effort / High value)
2. **Unify scoring algorithm** — single `calcCollectionScore()` used everywhere (Medium / High)
3. **Deploy backfill cron** — configure Vercel cron for `/api/cron/collections-refresh` (Low / High)

### Data Needs
- Tenants with `balance > 0` and `arrearsDays > 0` (demo seed has 19, pilot needs 100+)
- `CollectionNote` records to avoid all tenants appearing stale
- `CollectionProtocol` per org (defaults hardcoded, no admin UI)

### Dependencies
Legal Pipeline (send-to-legal), Tenant imports (balance data), Atlas Comms (entity chat), Intelligence Layer (attention scores)

---

## 2. Legal Pipeline

### Current State
**What works:** Active cases table with stage/building/search filters, 9-stage pipeline with visual stage badges, legal modal with full case management (stage advancement, attorney/marshal assignment, court date, notes), court dates tab with urgency color coding, stats KPIs, import wizard, review queue, candidates tab, case history, vendor management, user assignment, export.

**What's broken:**
- Review queue cross-org data leak (exposes null-candidateTenantId items across orgs)
- Court dates route returns raw Prisma Decimal without `toNumber()`
- Collections report uses `collectionScore >= 80` as proxy for "in legal" instead of checking actual legal case

**What's missing:** Dedicated case detail page (all management through modal), document management, automated stage transitions, violation-to-legal linking, stipulation tracking.

### Top 3 ROI Improvements
1. **Fix court dates Decimal serialization** (Low / High)
2. **Fix review queue org scoping** (Low / High)
3. **Add legal case detail page** — full page instead of modal for complex case management (Medium / High)

### Data Needs
- `LegalCase` records with realistic stages, court dates, attorneys (demo seed has some)
- `Vendor` records with type ATTORNEY and MARSHAL
- `User` records assigned to buildings

### Dependencies
Collections (cases created via send-to-legal), Tenants, Vendors, Users

---

## 3. Work Orders / Maintenance

### Current State
**What works:** Kanban board with drag-drop, list view with sort/filter/checkboxes, create modal (building/unit/tenant/vendor/user/priority/category/photos/cost/source), detail modal with comments/photos/activity log/chat tab, activity logging on all changes, bulk operations, relation validation, KPIs, vendor management tab, schedule management tab, source tracking (violation/inspection/turnover/move-out), Comms integration (events emitted on changes), export, pagination.

**What's broken:**
- Evidence route and violation-to-WO route not wrapped in transactions
- Photo upload may not be fully wired to Supabase Storage
- `organizationId!` null dereference in Comms event emission for SUPER_ADMIN

**What's missing:** Recurring work order generation from schedules, SLA tracking, tenant notifications, cost analysis reports, trade/specialty filtering.

### Top 3 ROI Improvements
1. **Wrap evidence + violation-to-WO routes in transactions** (Low / High)
2. **Verify and fix photo upload** — ensure Supabase Storage bucket exists (Medium / High)
3. **Add building filter in UI** — API supports it, UI only uses global selector (Low / Medium)

### Data Needs
- `WorkOrder` records across buildings with various statuses/priorities
- `Vendor` records for assignment
- Demo seed should include WOs linked to violations

### Dependencies
Violations (generates WOs), Vacancies (turnover source), Vendors, Atlas Comms (event threads), Buildings/Units/Tenants

---

## 4. Violations

### Current State
**What works:** 6-tab compliance page (Violations, Complaints, Hearings, Tracker, Calendar, Scorecard), paginated violation list with source/class/status/lifecycle filters, NYC Open Data sync from 4 APIs (HPD/DOB/ECB violations + HPD complaints) with SSE progress, per-building sync with boro detection, stats dashboard, violation-to-work-order creation, certification workflow, certification packets, violation interceptor, lifecycle status tracking, building scorecard, compliance calendar/tracker.

**What's broken:**
- **CRITICAL:** `syncAllBuildings` crosses org boundaries — writes violations to other orgs' buildings
- **CRITICAL:** Stats route gives ADMIN role cross-org visibility (should be SUPER_ADMIN only)
- No rate limit handling on NYC Open Data API calls
- Test route `/api/violations/test` should be removed
- 3 violation routes return Prisma Decimal without `toNumber()`

**What's missing:** Violation detail page, violation timeline/history, automated daily re-sync cron, penalty payment tracking, document/photo attachments, violation-to-legal linking.

### Top 3 ROI Improvements
1. **Fix cross-org violation sync** — scope `syncAllBuildings` to user's org only (Medium / **Critical**)
2. **Fix stats route org scoping** — restrict ADMIN to same-org buildings (Low / **Critical**)
3. **Add automated daily re-sync cron** (Medium / High)

### Data Needs
- Buildings with NYC `block` and `lot` fields populated
- `Violation` records (synced from NYC Open Data or seeded)
- Compliance templates

### Dependencies
Buildings (block/lot required for sync), Work Orders (violation-to-WO), NYC Open Data APIs (external)

---

## 5. Vacancies / Turnover

### Current State
**What works:** Vacancy command center with inline editing (BR/BA/SF/rent), 9-status pipeline with clickable badges, full lifecycle transitions with smart defaults, rent propose/approve workflow with role-based access, access management (key type + contact), turnover integration with vendor/cost/scope display, KPIs, filters, `syncVacancyState()` canonical function, utility automation hooks, export, turnovers page with status counts, turnover detail page, actions menu (create WO, create project, set dates).

**What's broken:**
- **CRITICAL:** `/turnovers/[id]` shows perpetual loading on non-existent ID (no 404 handling)
- Date setters may not call `syncVacancyState()`
- Days vacant computed and filtered client-side (slow at scale)

**What's missing:** Turnover task checklist, vendor assignment on turnovers, listing platform integration, move-out assessment UI, per-unit lost rent display, turnover timeline.

### Top 3 ROI Improvements
1. **Fix turnover detail 404 handling** (Low / **Critical**)
2. **Add lost rent per unit column** — `bestRent` is already computed, just needs display (Low / High)
3. **Add turnover task checklist** — common tasks (paint, clean, repair) with status tracking (Medium / High)

### Data Needs
- Units with `isVacant=true` or `vacancyStatus` set
- `TurnoverWorkflow` records with vendor assignments
- Unit data: bedrooms, bathrooms, SF, legal rent
- Realistic `vacantSince` dates

### Dependencies
Work Orders (create from vacancy), Projects (create for capex), Utilities (automation hooks), Buildings/Units

---

## 6. Owner Dashboard

### Current State
**What works:** Two separate dashboards exist — admin-facing `/owner-dashboard` (6 API endpoints, KPIs, building table, projects, vacancies, collections, compliance) and owner portal `/owner/dashboard` (single API, read-only portfolio view). Rich service layer (`owner-dashboard.service.ts`) with parallel data fetching, arrears bucketing, vacancy pipeline, renewal tracking, AR trend.

**What's broken:**
- **Two dashboards not consolidated** (W3-A still open) — 3 separate paths with different data shapes/UIs
- `use-owner-dashboard.ts` hook exists but is unused by either page (dead code)
- Admin dashboard uses raw `fetch()` instead of React Query
- Projects fetch has identical URL for owner/admin branches (incomplete logic)
- No `isError` handling on owner portal

**What's missing:** Consolidated single experience, historical trend charts (data exists in service, not rendered), renewal pipeline and vacancy pipeline (computed but not displayed), owner notifications/summary emails.

### Top 3 ROI Improvements
1. **Consolidate into one owner dashboard** (W3-A) — wire to existing service layer, eliminate duplicates (Medium / High)
2. **Render renewal + vacancy pipeline data** — service already computes, just add UI sections (Low / High)
3. **Migrate to React Query** — replace 6 raw fetch calls with existing hook (Low / Medium)

### Data Needs
- ARSnapshot records for arrears trends
- Projects with `ownerVisible` flag
- Vacancy records with `askingRent`

### Dependencies
Metrics API, Buildings, Violations, Collections, Projects (consumption-only)

---

## 7. AI Assistant (Coeus / Themis)

### Current State
**What works:** Coeus/Signals dashboard (signals with severity badges, grouping, filtering, analytics, acknowledge/resolve, export, manual risk scan), Themis/Legal Defense wizard (4-step intake-to-WO with AI review, PDF download, promote-to-WO), AI Chat (global slide-out panel with Claude Sonnet 4.6, SSE streaming, portfolio + tenant context, quick actions), AI Enhance Text (8 context types, used across app), Intelligence Layer (attention scores, action cards, decision learning, thread summarization), AI guardrails.

**What's broken:**
- Internal naming: `/coeus` and `/themis` still used (W3-B incomplete)
- Themis "Assigned To" field takes raw user ID string (no picker)
- Themis attachments stored as base64 in JSON (breaks with large files)

**What's missing:** @mention autocomplete, anomaly detection (signals are rule-based only), AI chat history persistence, violation/legal_case/turnover entity threads (return 501).

### Top 3 ROI Improvements
1. **Rename routes** — `/coeus` → `/signals`, `/themis` → `/legal-defense` (Low / High)
2. **Add user picker** to Themis assigned-to field (Low / Medium)
3. **Persist AI chat history** to database using existing Conversation/Message model (Medium / High)

### Data Needs
- `ANTHROPIC_API_KEY` required for all AI features
- Signal data from risk scans
- Sufficient tenant/building/payment/note data for meaningful AI context

### Dependencies
Anthropic API (external), Signal system (all modules), Buildings/Tenants/Payments/Notes/Legal/Vacancies/Work Orders (AI context)

---

## 8. Atlas Inbox / Communications

### Current State
**What works:** Full messaging system (5 pages: all/direct/groups/work-orders/unread), complete backend services (conversation CRUD, messages, members, entity threads, mark-read), API routes, UI components (layout, sidebar with tabs/search, conversation view with pinned/summary/messages, message bubbles, composer with message types + AI enhance, new conversation modal, entity chat tab), React Query hooks with polling (5s/15s/30s), work order event integration, thread summarization, proper org scoping.

**What's broken:**
- Polling-only (no WebSocket/Realtime)
- File uploads not implemented (icon exists, handler doesn't — Supabase Storage bucket not created)
- Entity threads for violation/legal_case/turnover return 501
- No @mention autocomplete
- Conversation list unbounded (no pagination)

**What's missing:** WebSocket/Realtime, file uploads, @mention autocomplete, message editing, in-conversation search, typing indicators, read receipt visualization, push/email notifications, pagination.

### Top 3 ROI Improvements
1. **Implement file uploads** — service + schema ready, need upload route + UI handler (Medium / High)
2. **Add pagination** to conversation and message lists (Low / Medium)
3. **Add @mention autocomplete** in composer (Medium / Medium)

### Data Needs
- Users in same org for DMs
- Work orders for entity threads
- Supabase Storage bucket `comms-attachments` needs creation

### Dependencies
Users, Work Orders, Tenants (entity threads), Anthropic API (summarization/enhance), Supabase Storage (file uploads)

---

## 9. Leasing

### Current State
**What works:** Page at `/leases` showing KPIs (active/expiring/expired/no lease), filterable tenant table with lease columns, tenant detail/edit modals, export. `Lease` model exists in Prisma schema with full fields. RGB order constants built with helper functions (`calculateLegalRentIncrease`, `getRGBOrderForLeaseDate`).

**What's broken:**
- No dedicated lease API routes — all data flows through Tenant model
- `leaseStatus` computed at Tenant level, not from Lease model (Tenant model "overloaded")
- Page is essentially a filtered tenants view with different labels
- `useLeases` hook doesn't exist
- RGB orders not integrated into any UI

**What's missing:** Lease lifecycle management (create/renew/amend/terminate), rent increase calculations, document management, renewal tracking workflow, rent roll report, lease comparison, stabilized rent history.

### Top 3 ROI Improvements
1. **Lease renewal workflow** — "Renew" action with RGB-calculated rent increase, new Lease record (Medium-High / **Very High**)
2. **Rent roll view** — table of all units with current/legal/preferential rent + lease expiration (Low / High)
3. **Wire RGB orders into lease UI** — show applicable order + calculated new legal rent for stabilized tenants (Low / Medium)

### Data Needs
- Tenants with populated `leaseExpiration`, `moveInDate`, `leaseStatus`, rents, `isStabilized`
- Lease records should be backfilled from Tenant data

### Dependencies
Tenants (primary data source), Metrics API, RGB constants, Buildings/Units. Feeds into: Owner Dashboard (renewals), Collections (rent changes)

---

## 10. Reports / AR

### Current State
**What works:** Reports page with KPIs, three report generators (Collection/Arrears/Legal) rendered as HTML in new window, Excel export, Metrics API (unit counts, occupancy, arrears bucketing, legal counts, lease status, lost rent), Collections Report API (per-building aging with 5 buckets), Daily Summary API (urgent tenants, recent notes/payments, legal, expiring leases, alerts, followups, Class C violations), CSV/JSON export, React Query hooks.

**What's broken:**
- AR aging 90+/120+ display inconsistency between metrics API and collections report
- Reports are HTML-in-new-window (not proper PDFs, fragile across browsers)
- Collections report has unbounded `findMany()`
- Two competing scoring algorithms

**What's missing:** Server-side PDF generation, scheduled/emailed reports, vacancy/maintenance/compliance reports, cash flow report, building-level P&L, custom report builder, report history/archive, owner-specific report delivery.

### Top 3 ROI Improvements
1. **Server-side PDF generation** — replace `window.open(html)` with proper PDF endpoint (Medium / High)
2. **Add vacancy + compliance reports** — data already available, need report templates (Low-Medium / High)
3. **Fix AR aging display** — standardize 90+/120+ buckets between metrics and collections report (Low / Medium)

### Data Needs
- Tenant records with balances and lease data
- Payment records for cash flow
- ARSnapshot records for historical trends

### Dependencies
Tenants, Metrics API, Collections, Legal, Violations, Buildings. Feeds into: Owner Dashboard, AI Chat

---

## Cross-Module Summary

| Module | Completeness | Critical Bugs | Pilot Ready? |
|--------|-------------|---------------|-------------|
| Collections | 85% | 0 | Yes |
| Legal Pipeline | 80% | 0 | Yes (fix Decimal) |
| Work Orders | 85% | 0 | Yes |
| Violations | 70% | 2 (cross-org) | **No — fix first** |
| Vacancies | 80% | 1 (turnover 404) | Mostly |
| Owner Dashboard | 60% | 0 | Needs consolidation |
| AI Assistant | 75% | 0 | Yes (needs API key) |
| Atlas Comms | 70% | 0 | Yes (polling only) |
| Leasing | 40% | 0 | No — filtered view only |
| Reports / AR | 50% | 0 | Partial |

## Top 5 Cross-Module Priorities

1. **Fix Violations cross-org data leaks** (C2, C4) — security-critical, blocks pilot
2. **Fix turnover detail 404** — prevents user confusion on missing data
3. **Consolidate Owner Dashboard** (W3-A) — eliminates 3 competing paths, surfaces existing rich data
4. **Lease renewal workflow with RGB integration** — highest-value PM feature, data and helpers already built
5. **Server-side PDF reports** — owner deliverable, replaces fragile HTML-in-window approach
