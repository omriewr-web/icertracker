# AtlasPM — Full Cross-Module Production-Readiness Review (Second Pass)

**Date:** 2026-03-16
**Reviewer:** Claude Opus 4.6 (automated deep audit)
**Scope:** All modules, APIs, schema, UI, workflows, auth, infra
**Files inspected:** ~200+ across all layers

---

## 1. Executive Summary

### Production-Readiness Score: 5.5 / 10

**Biggest Risks:**
1. **Security backdoor** — `/api/auth/reset-admin` has a hardcoded password in source code
2. **Cross-org data leaks** — Admins without `organizationId` see ALL orgs; geocode route has zero org scoping; Themis promote has no building access check
3. **Data integrity drift** — `Unit.isVacant` vs tenant/vacancy records, `Tenant` vs `Lease` dual-writes with two different sync implementations
4. **Import transaction safety** — Legacy legal import has NO transaction; rent-roll import does building updates outside its transaction
5. **Pervasive `any` types** — 16+ mutation hooks bypass TypeScript entirely

**Biggest Strengths:**
1. Solid auth middleware pattern (`withAuth` + permission strings) consistently applied across ~95% of routes
2. Centralized data-scoping helpers (`getBuildingScope`, `getTenantScope`) prevent most cross-tenant leaks
3. Clean module structure — each feature has a page, content component, hook, and API route
4. Existing KpiCard, ExportButton, and skeleton patterns are well-designed and reusable
5. Owner-visible filtering at API level (projects route) is well-implemented

**What improved since prior audit:**
- Org scoping added to non-admin scope helpers (tests now include `organizationId` — the code is more secure, tests are stale)
- Signal engine and Coeus provide operational intelligence layer
- Themis provides structured intake-to-work-order workflow
- Collections module has proper service-layer scoping

**What is still dangerous:**
- The reset-admin backdoor
- Import routes can partially write and leave inconsistent state
- No test coverage for any business-critical workflow
- 4 existing tests are failing (stale assertions after scope security improvement)

---

## 2. Cross-Module Drift Report

### Status Systems
| Module | Status Field | Values | Source of Truth |
|--------|-------------|--------|-----------------|
| Collections List | `collectionCase.status` | `monitoring`, `demand_sent`, `legal_referred`, `payment_plan`, `resolved` | CollectionCase model |
| Collections Detail | `collectionCase.status` | `CURRENT`, `LATE`, `DELINQUENT`, `CHRONIC`, `PAYMENT_PLAN`, `LEGAL`, `VACATE_PENDING` | Same model, different enum |
| Tenant | `leaseStatus` (string) | `active`, `expiring-soon`, `expired`, `no-lease`, `vacant` | Computed on read |
| Lease | `status` (enum `LeaseStatus`) | `ACTIVE`, `EXPIRED`, `MONTH_TO_MONTH`, `PENDING`, `TERMINATED` | Lease model |
| Vacancy | `Unit.vacancyStatus` (enum) | `PRE_TURNOVER`, `IN_TURNOVER`, `READY_TO_SHOW`, `LISTED`, `OCCUPIED` | Unit model |
| Vacancy (bool) | `Unit.isVacant` | `true`/`false` | Unit model — **can drift from vacancyStatus** |
| Turnover | `Turnover.status` | `PENDING_INSPECTION`, `SCOPE_CREATED`, `IN_PROGRESS`, `PUNCH_LIST`, `COMPLETE`, `LISTED` | Turnover model — **not synced with Unit.vacancyStatus** |
| Work Order | `status` | `PENDING_REVIEW`, `OPEN`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED` | WorkOrder model |
| Project | `status` | `PLANNED`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, `CANCELLED` | Project model |

**Critical drift:** Collections list and detail pages use completely disjoint status sets for the same model. A status set in the detail page won't appear under any list filter.

### Duplicate Source-of-Truth Fields
| Data | Location 1 | Location 2 | Sync Mechanism |
|------|-----------|-----------|----------------|
| Rent amounts | `Tenant.marketRent/legalRent/actualRent` | `Lease.monthlyRent/legalRent/preferentialRent` | Dual-write in 2 different import services with different logic |
| Lease dates | `Tenant.leaseExpiration/moveInDate` | `Lease.leaseEnd/leaseStart/moveInDate` | Dual-write |
| Vacancy | `Unit.isVacant` (bool) | `Unit.vacancyStatus` (enum) + `VacancyInfo` record + absence of `Tenant` | Import sets `isVacant` only; vacancyStatus set by UI |
| Building contacts | `Building.superintendent` (JSON) | `BuildingVendor` records | Both actively written |
| Utility info | `Building.utilityMeters` (JSON) | `UtilityMeter` model | Both actively written |

### Metric Computation Differences
- **Leases page** computes "Active Leases" as `occupied - noLease - expiredLease - expiringSoon` which can go negative
- **Dashboard** uses `occupancyRate = (occupied / totalUnits) * 100` from metrics API
- **Owner Dashboard** uses the same formula but via a different API (`/api/owner-dashboard`)
- **Daily Briefing** and **Owner Dashboard** use raw `fetch` + manual state instead of React Query, so they don't share the metrics cache

---

## 3. Top 15 Fixes by Priority (Execution Order)

### 1. Remove `/api/auth/reset-admin` backdoor
**File:** `src/app/api/auth/reset-admin/route.ts`
**Why:** Hardcoded password "Atlas2026!" and hardcoded email in source. Non-timing-safe secret check. Any attacker who discovers `CRON_SECRET` can reset the admin account.
**Fix:** Delete this file entirely. Use a migration script or Prisma Studio for password resets.

### 2. Fix cross-org data leak in geocode route
**File:** `src/app/api/buildings/geocode/route.ts`
**Why:** Fetches ALL buildings across ALL orgs. Any user with "dash" permission triggers it.
**Fix:** Add `getOrgScope(user)` to the `where` clause.

### 3. Fix Themis promote cross-org access
**File:** `src/app/api/themis/draft/[id]/promote/route.ts`
**Why:** Only checks admin role, not `assertBuildingAccess`. Could promote drafts from other orgs.
**Fix:** Add `assertBuildingAccess(user, draft.intake.buildingId)`.

### 4. Add transaction to legacy legal import
**File:** `src/app/api/import/legal/route.ts` ~lines 232-347
**Why:** Individual creates/updates with no transaction. Crash = partial import with no rollback.
**Fix:** Wrap the match-results loop in `prisma.$transaction()`.

### 5. Fix Projects POST missing building access check
**File:** `src/app/api/projects/route.ts` POST handler
**Why:** Any user with "maintenance" can create projects on any building, including cross-org.
**Fix:** Add `assertBuildingAccess(user, body.buildingId)` and Zod validation.

### 6. Fix Collections dual-status system
**Files:** `src/app/(dashboard)/collections/collections-content.tsx`, `src/app/(dashboard)/collections/[tenantId]/page.tsx`
**Why:** List and detail pages use completely disjoint status enums. Statuses set in detail don't appear in list filters.
**Fix:** Unify to a single `CollectionStatus` enum used everywhere.

### 7. Fix `isLoading` logic in Collections
**File:** `src/app/(dashboard)/collections/collections-content.tsx` ~line 192
**Why:** `const isLoading = dashLoading && tenantsLoading` uses `&&` instead of `||`. Shows partial/empty data while one query is still loading.
**Fix:** Change to `dashLoading || tenantsLoading`.

### 8. Fix import invalidation query keys
**File:** `src/hooks/use-import.ts` ~lines 7-11
**Why:** Keys `"legalCases"`, `"workOrders"`, `"collectionCases"` don't match actual query keys (`"legal"`, `"work-orders"`, `"collections"`). After imports, these caches are never refreshed.
**Fix:** Update to `["legal", "work-orders", "collections"]`.

### 9. Fix tenant PATCH dual-write transaction safety
**File:** `src/app/api/tenants/[id]/route.ts` PATCH handler
**Why:** Updates tenant AND upserts lease in separate Prisma calls. If lease upsert fails, data drifts.
**Fix:** Wrap in `prisma.$transaction()`.

### 10. Fix payment creation transaction safety
**File:** `src/app/api/tenants/[id]/payments/route.ts` POST handler
**Why:** Creates payment and updates tenant balance separately. Balance can become stale.
**Fix:** Wrap in `prisma.$transaction()`.

### 11. Add Zod validation to all Projects module endpoints
**Files:** `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`, budget-lines, change-orders, milestones
**Why:** 7 POST/PATCH endpoints use raw `req.json()` with no validation. Malformed input goes straight to Prisma.
**Fix:** Create Zod schemas in `src/lib/validations.ts` for each.

### 12. Fix `parseBody` to return 400 on validation errors
**File:** `src/lib/api-helpers.ts` ~lines 53-56
**Why:** Zod validation failures propagate as 500 errors instead of 400 with field details.
**Fix:** Catch `ZodError` specifically, return 400 with `error.flatten()`.

### 13. Fix stale data-scope tests
**File:** `src/__tests__/data-scope.test.ts`
**Why:** 4 tests fail because `data-scope.ts` was improved to add `organizationId` scoping, but tests expect the old behavior without org filter.
**Fix:** Update test assertions to include `organizationId`.

### 14. Fix Themis silent error swallowing
**File:** `src/app/(dashboard)/themis/themis-content.tsx` ~lines 176, 220, 262, 279, 296
**Why:** Five `catch {}` blocks silently swallow all API errors. Users get zero feedback on failures.
**Fix:** Add toast notifications in each catch block.

### 15. Replace `console.error` with structured logger in withAuth
**File:** `src/lib/api-helpers.ts` ~line 42
**Why:** The central error handler uses `console.error` instead of Pino, making production errors unstructured and unsearchable.
**Fix:** Import and use `logger.error({ err, userId, route }, "API error")`.

---

## 4. Module-by-Module Review

### Dashboard (Command Center)
- **Solid:** KPI cards, signal integration, building table with financial aggregations
- **Risky:** `buildings.sort()` mutates array in-place on every render (~line 186 of dashboard-content.tsx). Should use `useMemo` + spread
- **Missing:** No error boundary around individual sections
- **Fix next:** Memoize the building sort

### Buildings
- **Solid:** Comprehensive building data with financial aggregations via raw SQL. Good pagination
- **Risky:** Geocode route has no org scoping. Deduplicate uses manual admin check instead of permission string
- **Missing:** No index on `Building.address` for matching
- **Fix next:** Add org scoping to geocode

### Units
- **Solid:** Clean CRUD with proper scoping
- **Risky:** `isVacant` boolean can drift from `vacancyStatus` enum
- **Missing:** No cross-validation when isVacant changes
- **Fix next:** Make vacancy status changes atomic

### Tenants
- **Solid:** Comprehensive tenant view with scoring, legal status, lease status
- **Risky:** PATCH dual-writes tenant+lease without transaction. All pages load ALL tenants into memory
- **Missing:** Server-side pagination on tenant lists. No index on `Tenant.name`
- **Fix next:** Transaction-wrap the PATCH handler; add server-side filtering to alerts/legal/leases pages

### Leases
- **Solid:** Good expiration tracking
- **Risky:** "Active Leases" KPI can go negative. `Tenant.leaseStatus` (string) vs `Lease.status` (enum) drift
- **Missing:** Empty state when no tenants
- **Fix next:** Clamp KPI to `Math.max(0, ...)`

### Vacancies
- **Solid:** Status pipeline, inline editing, leasing activity tracking
- **Risky:** Status dropdown allows OCCUPIED without creating a tenant. 250+ mutation hook instances (one per editable cell)
- **Missing:** Vacancy status not synced when turnover advances
- **Fix next:** Filter OCCUPIED from the dropdown; lift mutation hooks above the row level

### Turnovers
- **Solid:** Good detail page with vendor assignments, scope of work, checklists
- **Risky:** Status advances without validating prerequisites. `/turnovers` route redirects to `/vacancies` — turnovers-content.tsx is dead code
- **Missing:** No back-sync to Unit.vacancyStatus when turnover advances
- **Fix next:** Remove dead code; add status validation; sync vacancy status

### Work Orders
- **Solid:** Full CRUD, comments, activity tracking, evidence linking, bulk updates, public tenant portal
- **Risky:** Evidence creation + violation lifecycle update not in transaction
- **Missing:** No link from work order to parent project
- **Fix next:** Transaction-wrap evidence+lifecycle update

### Legal
- **Solid:** Case tracking, court dates, legal notes, attorney/assignee management
- **Risky:** GET route scoping uses `getBuildingScope` which may not properly filter through `tenant.unit.buildingId`. Review queue items with null `candidateTenantId` visible to all orgs
- **Missing:** `statusFilter` declared but never applied in legal-content.tsx (dead code)
- **Fix next:** Verify legal case scoping path; wire up status filter

### Collections
- **Solid:** Service-layer scoping, AR aging breakdown, bulk actions, send-to-legal flow
- **Risky:** List/detail use completely different status systems. `isLoading` uses `&&` instead of `||`. Bulk sendToLegal silently swallows per-tenant errors
- **Missing:** `sendToLegal` doesn't invalidate legal query keys
- **Fix next:** Unify status system; fix isLoading; add invalidation

### Compliance
- **Solid:** Clean CRUD, generation templates, building access checks
- **Risky:** No transaction on batch generation
- **Missing:** Nothing critical
- **Fix next:** Minor — batch generation could use transaction

### Violations
- **Solid:** NYC Open Data sync, stats aggregation, certification packets
- **Risky:** `/api/violations/test` exposes debug info — should be admin-only or removed. Certify endpoint lacks Zod validation
- **Missing:** No UI action to create work order directly from a violation
- **Fix next:** Remove/restrict test endpoint; add Zod to certify

### Utilities
- **Solid:** Full meter/account/check CRUD with proper scoping, summary aggregations
- **Risky:** Nothing critical
- **Missing:** Nothing critical
- **Fix next:** None urgent

### Projects
- **Solid:** Milestones, budget lines, change orders, approval workflow, violation/WO linking
- **Risky:** POST has no building access check (cross-org). 7 endpoints lack Zod validation. GET routes lack permission strings
- **Missing:** Back-link from work orders to parent project
- **Fix next:** Add assertBuildingAccess + Zod schemas

### Owner Dashboard
- **Solid:** Comprehensive portfolio view, export support, sortable building table
- **Risky:** Uses raw `fetch` instead of React Query (no caching, no deduplication)
- **Missing:** Vacancy pipeline data from the `/api/units?isVacant=true` endpoint may not return the expected shape
- **Fix next:** Migrate to React Query hooks

### AI / Coeus / Themis
- **Coeus solid:** Signal visualization, severity filtering, resolution workflow
- **Coeus risky:** Fetches signals twice (filtered + unfiltered) on every render
- **Themis solid:** Structured intake-to-draft-to-work-order pipeline
- **Themis risky:** Stores base64 file data in DB JSON column. Silently swallows all API errors. Promote endpoint lacks building access check
- **AI Chat solid:** SSE streaming, portfolio context injection
- **AI Chat risky:** No Zod validation on messages body; stale closure risk in `sendMessage`
- **Fix next:** Add building access to promote; add error toasts; move files to blob storage

### Import/Export/Reporting
- **Import solid:** Multi-format detection (Yardi, Atlas, generic), building matching, staging workflow
- **Import risky:** Legacy legal import has NO transaction. Rent-roll service does building updates outside transaction. AR aging can attribute to wrong tenant via unit-only fallback. No idempotency keys
- **Export solid:** CSV/JSON export with proper tenant scoping
- **Reports risky:** Loads ALL tenants into memory for report generation
- **Fix next:** Transaction-wrap legal import; add idempotency

---

## 5. API Consistency Matrix

### Auth Coverage
| Status | Count | Details |
|--------|-------|---------|
| All routes use `withAuth` | ~97% | 103 of ~107 route files |
| Routes without auth | 4 | `/api/health` (intentional), `/api/auth/reset-admin` (CRITICAL), `/api/work-orders/request` (intentional public portal), `/api/auth/[...nextauth]` (NextAuth) |
| Cron routes | 3 | Use `withCronAuth` (separate pattern, timing-safe) |

### Permission String Coverage
| Status | Count | Notes |
|--------|-------|-------|
| Routes with permission strings | ~90% | Most use appropriate strings |
| Routes with `withAuth` but no permission | ~8 | Projects `[id]` GET/PATCH/DELETE, budget-lines GET, change-orders GET, milestones GET, buildings GET |

### Scoping Coverage
| Status | Count | Notes |
|--------|-------|-------|
| Properly building/org scoped | ~90% | Via scope helpers |
| Missing scoping | 3-4 | Geocode (all orgs), email without tenantId (any address), legal review queue (null candidates), Themis promote |

### Validation Coverage
| Status | Count | Notes |
|--------|-------|-------|
| Zod-validated POST/PATCH | ~70% | Most CRUD routes |
| Manual/no validation | ~15 endpoints | All Projects module writes, AI chat, staging confirm, violation certify |

### Transaction Safety
| Status | Notes |
|--------|-------|
| Transaction-wrapped | User create/update, project create/update/approve/milestones, work order update/bulk, legal review, vacancy status, building deduplicate |
| Missing transactions | Tenant PATCH (dual-write), payment creation, legacy legal import, evidence+lifecycle, rent-roll building updates |

### Logging
| Status | Notes |
|--------|-------|
| Structured logger | 5 routes (buildings, tenants, legal, violations/stats, collections/dashboard) |
| Console only | All other routes (via withAuth catch block) |
| Cron logging | All 3 cron routes write to CronLog model |

### Response Shape Consistency
| Pattern | Routes |
|---------|--------|
| Direct array | Buildings, work orders, legal, compliance, violations, tenants (nested in `{tenants, pagination}`) |
| Wrapped object | Signals `{signals, counts}`, collections dashboard, legal stats |
| Single object | All detail/create/update endpoints |
| Inconsistent | Legal candidates `{candidates, total}` vs tenants `{tenants, pagination}` |

---

## 6. Schema / Lifecycle Integrity Review

### Vacancy Lifecycle
```
Expected: Move-out → Unit.isVacant=true → VacancyInfo created → Turnover created →
          Work orders → Listed → Lease signed → Unit.isVacant=false
Actual:   Import sets isVacant. VacancyInfo is optional. Turnover status is independent.
          No automatic sync between turnover status and vacancy status.
```
**Gap:** Turnover advancing to LISTED doesn't update `Unit.vacancyStatus` to `LISTED`. Setting `Unit.vacancyStatus` to OCCUPIED doesn't create a tenant or lease.

### Turnover Linkage
- Turnovers link to Unit + Building correctly
- Vendor assignments work well
- **Gap:** No automatic work order creation from turnover scope items
- **Gap:** `/turnovers` page redirects to `/vacancies` — turnovers list is inaccessible

### Project Linkage
- Projects link to Building, can link to violations and work orders via dedicated endpoints
- OWNER visibility filter works at API level
- **Gap:** Work order detail doesn't show parent project. One-directional link only
- **Gap:** POST endpoint doesn't verify building access

### Work Order Promotion
- Themis intake → AI draft → verify → promote to work order works end-to-end
- **Gap:** Promote endpoint lacks building access check (cross-org risk)
- **Gap:** After promotion, user is sent to generic maintenance page, not the specific work order

### Legal Escalation
- Collections `sendToLegal` creates a legal case via service
- Legal case tracks stage, court dates, notes, attorney
- **Gap:** `sendToLegal` doesn't invalidate legal-related React Query keys
- **Gap:** Legal review queue items with null `candidateTenantId` visible to all orgs

### Owner Visibility Boundaries
- Projects API correctly filters `ownerVisible=true` for OWNER role
- Owner dashboard uses dedicated `/api/owner-dashboard` endpoint
- **Gap:** Owner Dashboard new version (raw fetch) doesn't enforce OWNER filtering on client-side API calls to `/api/metrics`, `/api/buildings`, etc. — scoping happens at API level, which is correct, but the client could request data it shouldn't display
- **Gap:** Collections summary should hide tenant counts for OWNER role — this is implemented in the new owner-dashboard-content.tsx

---

## 7. Build / Typecheck / Test Status

### Typecheck
```
npm run typecheck → PASS (zero errors)
```

### Build
```
npm run build → PASS (clean production build, all routes compiled)
```

### Test Results
```
Test Files:  1 failed | 2 passed (3 total)
Tests:       4 failed | 40 passed (44 total)
```

**Failing tests:** All 4 in `data-scope.test.ts` — tests expect old behavior without `organizationId` in scoped-user results. The code was improved to add org scoping (more secure), but tests were not updated.

### Test Coverage Assessment
| Area | Coverage | Risk |
|------|----------|------|
| Data scoping (`data-scope.ts`) | 31 tests (4 stale) | **Medium** — core security logic has tests but they're outdated |
| NYC Open Data parsing | 8 tests | Good for parsing logic |
| Bootstrap admin | 5 tests | Good |
| Import workflows | **ZERO** | **CRITICAL** — rent roll, AR aging, legal, building imports have no tests |
| API route handlers | **ZERO** | **CRITICAL** — no integration tests for any endpoint |
| Legal escalation flow | **ZERO** | **HIGH** — complex multi-step workflow untested |
| Collections service | **ZERO** | **HIGH** — financial data with no test coverage |
| Scoring/computation logic | **ZERO** | **HIGH** — `calcCollectionScore`, arrears categorization untested |
| Building matching | **ZERO** | **HIGH** — false-positive-prone matching logic untested |
| Signal engine | **ZERO** | **MEDIUM** — operational signals generated with no test validation |

### Priority Test Additions
1. Import service integration tests (rent roll, AR aging, legal)
2. Data scoping unit tests (fix existing 4 + add cross-org scenarios)
3. Building matching unit tests (false positive scenarios)
4. Collections service tests (status transitions, AR calculation)
5. API route integration tests for auth/scoping (at minimum: tenants, buildings, projects, legal)

---

## 8. Final Verdict

### Can this be deployed for real internal use?
**Yes, with caveats.** The application is functional and the core data flows work. The auth middleware and data-scoping patterns provide reasonable protection for internal use where all users are trusted employees. However:
- Remove the `reset-admin` backdoor immediately
- Fix the geocode cross-org leak
- Fix the Collections dual-status issue (causes operational confusion)
- Fix the import invalidation keys (causes stale data after imports)

### Can this be deployed for external clients (multi-org)?
**Not yet.** Multi-tenant isolation has gaps that must be fixed first:
1. Admins without `organizationId` see all orgs' data
2. Geocode route processes all orgs
3. Themis promote lacks building access check
4. Legal review queue leaks cross-org items
5. Email route without tenantId has no scoping
6. Projects POST has no building access check
7. Zero automated test coverage for any auth/scoping boundary

### What must be fixed before internal deployment?
1. Delete `/api/auth/reset-admin`
2. Fix Collections `isLoading` (`&&` → `||`)
3. Fix import invalidation query keys
4. Fix Collections dual-status system

### What must be fixed before external client deployment?
All of the above, plus:
5. Add org scoping to geocode route
6. Add building access check to Themis promote
7. Add building access check to Projects POST
8. Fix legal review queue cross-org leak
9. Scope email route when no tenantId
10. Transaction-wrap tenant PATCH, payment creation, legacy legal import
11. Add Zod validation to Projects module (7 endpoints)
12. Fix `parseBody` to return 400 on validation errors
13. Add integration tests for all auth/scoping boundaries
14. Audit and fix `data-scope.ts` behavior for admins without organizationId

---

## Appendix: All Findings by Severity

### CRITICAL (5)

**[CRITICAL] Security** — File: `src/app/api/auth/reset-admin/route.ts` — Line: ~11
Issue: Hardcoded password "Atlas2026!" and hardcoded email. Non-timing-safe secret comparison
Why it matters: Production backdoor accessible to anyone who discovers CRON_SECRET
Recommendation: Delete this file entirely
Cross-module impact: Affects entire auth system trust

**[CRITICAL] Scoping** — File: `src/app/api/buildings/geocode/route.ts` — Line: ~15
Issue: Fetches ALL buildings across ALL orgs for geocoding
Why it matters: Any user with "dash" permission processes other orgs' data
Recommendation: Add `getOrgScope(user)` or `getBuildingIdScope(user)` filter
Cross-module impact: Affects multi-tenant isolation

**[CRITICAL] Authorization** — File: `src/lib/data-scope.ts` — Line: ~37-39
Issue: ADMIN/ACCOUNT_ADMIN with no `organizationId` get unscoped access to ALL orgs
Why it matters: Misconfigured admin = complete cross-tenant data breach
Recommendation: Return EMPTY_SCOPE when org is missing for non-SUPER_ADMIN roles
Cross-module impact: Every route using scope helpers is affected

**[CRITICAL] Transactions** — File: `src/app/api/import/legal/route.ts` — Line: ~232-347
Issue: Legal import loop with no transaction. Partial writes on crash
Why it matters: Incomplete imports with no rollback. Batch stuck in "processing" state
Recommendation: Wrap in `prisma.$transaction()`
Cross-module impact: Legal module data integrity

**[CRITICAL] Data Integrity** — File: `prisma/schema.prisma` — Line: ~236
Issue: `Unit.isVacant` (bool) drifts from actual tenant/vacancy/turnover state
Why it matters: Vacancy counts, occupancy rates, and lost rent calculations all depend on this field being accurate
Recommendation: Derive vacancy from tenant absence or enforce single state machine
Cross-module impact: Dashboard, metrics, owner dashboard, vacancy page, reports

### HIGH (15)

**[HIGH] Authorization** — File: `src/app/api/projects/route.ts` POST — Line: ~83
Issue: No `assertBuildingAccess` on body.buildingId
Why it matters: Cross-org project creation possible
Recommendation: Add building access check before create
Cross-module impact: Projects, owner dashboard

**[HIGH] Authorization** — File: `src/app/api/themis/draft/[id]/promote/route.ts`
Issue: Only checks admin role, not building access
Why it matters: Could promote drafts from other organizations
Recommendation: Add `assertBuildingAccess(user, draft.intake.buildingId)`
Cross-module impact: Themis → Work Orders flow

**[HIGH] Authorization** — File: `src/app/api/legal/review/route.ts` GET
Issue: Queue items with null `candidateTenantId` visible to all orgs
Why it matters: Cross-org data leak in legal review
Recommendation: Filter by `importBatch.organizationId`
Cross-module impact: Legal import review workflow

**[HIGH] Data Integrity** — File: `src/app/api/tenants/[id]/route.ts` PATCH
Issue: Dual-write (tenant + lease) NOT in transaction
Why it matters: If lease upsert fails, tenant/lease data drifts
Recommendation: Wrap in `prisma.$transaction()`
Cross-module impact: Tenants, leases, collections, legal

**[HIGH] Data Integrity** — File: `src/app/api/tenants/[id]/payments/route.ts` POST
Issue: Payment creation + balance update not in transaction
Why it matters: Balance can become stale
Recommendation: Wrap in `prisma.$transaction()`
Cross-module impact: Collections, alerts, metrics

**[HIGH] Data Integrity** — File: `src/hooks/use-import.ts` — Line: ~7-11
Issue: Import invalidation keys don't match actual query keys
Why it matters: Legal, work orders, collections caches never refreshed after imports
Recommendation: Change to `["legal", "work-orders", "collections"]`
Cross-module impact: All modules after any import

**[HIGH] UX/Workflow** — File: `src/app/(dashboard)/collections/collections-content.tsx` — Line: ~192
Issue: `isLoading = dashLoading && tenantsLoading` uses `&&` instead of `||`
Why it matters: Shows partial/empty data during load
Recommendation: Change to `||`
Cross-module impact: Collections page only

**[HIGH] UX/Workflow** — File: `src/app/(dashboard)/collections/` (list vs detail)
Issue: List uses lowercase statuses, detail uses uppercase — completely disjoint sets
Why it matters: Status set in detail doesn't appear in list filters
Recommendation: Unify to single CollectionStatus enum
Cross-module impact: Collections module, legal escalation

**[HIGH] UX/Workflow** — File: `src/app/(dashboard)/themis/themis-content.tsx` — Lines: ~176,220,262,279,296
Issue: Five `catch {}` blocks silently swallow all API errors
Why it matters: Users get zero feedback on failures
Recommendation: Add toast notifications
Cross-module impact: Themis workflow

**[HIGH] Type Safety** — File: Multiple hooks (16+ files)
Issue: Mutation hooks use `data: any` parameters
Why it matters: TypeScript safety completely bypassed for all writes
Recommendation: Define typed mutation input interfaces
Cross-module impact: All CRUD operations

**[HIGH] UX/Workflow** — File: `src/components/layout/header.tsx` — Line: ~30
Issue: Hardcoded "ARGUS ACTIVE · 921 UNITS" text
Why it matters: Always shows wrong unit count
Recommendation: Fetch from metrics API
Cross-module impact: Global header

**[HIGH] Reliability** — File: `src/lib/api-helpers.ts` — Lines: ~53-56
Issue: `parseBody` Zod validation failures return 500 instead of 400
Why it matters: API consumers can't distinguish validation errors from server errors
Recommendation: Catch ZodError, return 400 with `error.flatten()`
Cross-module impact: Every route using parseBody

**[HIGH] Performance** — File: `src/app/(dashboard)/alerts/alerts-content.tsx` — Line: ~19
Issue: Loads ALL tenants into memory, filters client-side
Why it matters: Performance degrades with portfolio growth
Recommendation: Add server-side filtering to tenants API
Cross-module impact: Same pattern in legal, leases, reports pages

**[HIGH] Testing** — File: `src/__tests__/data-scope.test.ts`
Issue: 4 tests fail — stale assertions after org-scoping improvement
Why it matters: CI is broken; security-critical code has outdated tests
Recommendation: Update assertions to include `organizationId`
Cross-module impact: Blocks any CI/CD pipeline

**[HIGH] Schema Design** — File: `prisma/schema.prisma`
Issue: Tenant.leaseStatus (string) vs Lease.status (enum LeaseStatus) — different types, different values
Why it matters: Code compares these strings with no type safety
Recommendation: Use the enum everywhere or compute leaseStatus
Cross-module impact: Tenants, leases, collections, legal, metrics

### MEDIUM (20+)

**[MEDIUM] Security** — File: `src/components/layout/org-switcher.tsx` — Line: ~67
Issue: Org override cookie missing `Secure` and `SameSite` attributes

**[MEDIUM] Security** — File: `src/lib/api-helpers.ts` — Line: ~31
Issue: `organizationId` fallback to empty string `""` instead of `null`

**[MEDIUM] Authorization** — File: `src/app/api/email/route.ts`
Issue: Without tenantId, no scoping — any email address allowed

**[MEDIUM] Authorization** — File: `src/app/api/violations/test/route.ts`
Issue: Debug endpoint exposes raw NYC Open Data responses

**[MEDIUM] API Consistency** — File: `src/app/api/projects/[id]/route.ts` GET/PATCH/DELETE
Issue: No permission strings on withAuth

**[MEDIUM] Transactions** — File: `src/lib/services/rent-roll-import.service.ts` — Lines: ~81-115
Issue: Building updates happen outside the transaction

**[MEDIUM] Data Integrity** — File: `src/lib/services/ar-import.service.ts` — Lines: ~88-91
Issue: Unit-only fallback matching can attribute AR data to wrong tenant

**[MEDIUM] Observability** — File: `src/lib/api-helpers.ts` — Line: ~42
Issue: `console.error` instead of structured Pino logger

**[MEDIUM] Observability** — File: `src/middleware.ts`
Issue: Request ID generated but not propagated to route handlers

**[MEDIUM] Observability** — File: Sentry configs
Issue: No `beforeSend` PII filtering, no `release` property

**[MEDIUM] Performance** — File: `src/components/dashboard/dashboard-content.tsx` — Line: ~186
Issue: `buildings.sort()` mutates array in-place on every render

**[MEDIUM] Performance** — File: `src/app/(dashboard)/vacancies/vacancies-content.tsx` — Line: ~94
Issue: 250+ mutation hook instances (one per editable cell per row)

**[MEDIUM] Performance** — File: `src/lib/building-matching.ts` — Lines: ~121-204
Issue: O(n*m*6) linear scan for every import row

**[MEDIUM] UX/Workflow** — File: `src/app/(dashboard)/turnovers/[id]/turnover-detail-content.tsx` — Line: ~49
Issue: Turnover status advances without prerequisite validation

**[MEDIUM] UX/Workflow** — File: `src/components/layout/sidebar.tsx` — Line: ~64
Issue: Role defaults to COLLECTOR when session is loading

**[MEDIUM] UX/Workflow** — File: `src/components/layout/property-selector.tsx` — Line: ~92
Issue: "Add Building" button shown to non-admin roles

**[MEDIUM] UX/Workflow** — File: `src/components/ui/score-gauge.tsx` — Line: ~48
Issue: Absolute positioning without relative parent — broken layout

**[MEDIUM] Architecture** — File: `src/hooks/use-buildings.ts` — Lines: ~15 vs ~27
Issue: `useBuildings` and `useAllBuildings` share query key `["buildings", null]` when portfolio is null

**[MEDIUM] Architecture** — File: `src/hooks/use-collections.ts` — Line: ~165
Issue: `sendToLegal` doesn't invalidate `["legal"]` or `["legal-stats"]` query keys

**[MEDIUM] Architecture** — File: `src/app/(dashboard)/daily/daily-content.tsx`
Issue: Uses raw `fetch` + manual state instead of React Query

**[MEDIUM] Reliability** — File: `src/lib/data-scope.ts` — Line: ~209
Issue: Shared mutable `FORBIDDEN` NextResponse object reused across requests

**[MEDIUM] Schema Design** — File: `prisma/schema.prisma`
Issue: Multiple orphanable FK references without `onDelete` cascade rules

---

*Generated by cross-module automated audit. All line numbers are approximate — verify against current source.*
