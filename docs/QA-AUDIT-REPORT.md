# AtlasPM QA Audit Report

**Date:** 2026-03-19
**Branch:** main (up to date with origin/main)
**Uncommitted changes:** 35 modified files + ~30 untracked files (security audit repair from same day)
**TypeScript errors:** 0
**Test results:** 467 passed / 0 failed (32 test files)

## Fix Status (2026-03-19)
62+ issues fixed across 13 automated passes. Remaining: M1 (CSRF — deferred, needs architecture), M2 (demo password — deferred by user), L12 (composite indexes — blocked on schema changes).

---

## CRITICAL ISSUES

### C1. `syncAllBuildings` is not org-scoped — cross-org violation sync
- **File:** `src/lib/violation-sync.ts:160-167`
- **What:** `syncAllBuildings()` queries ALL buildings with block/lot data across ALL organizations. When triggered by an admin of org A, it fetches external data for and writes violations to buildings belonging to org B.
- **Impact:** Cross-org data writes. An admin triggering a violation sync inadvertently modifies another org's buildings.
- **Fix:** Add `organizationId` filter to the `findMany` query, or scope to the triggering user's org.

### C2. RGB Orders endpoint has no org scoping — returns all orgs' data
- **File:** `src/app/api/settings/rgb-orders/route.ts:38-43`
- **What:** The GET route has no `organizationId` filter. Comment confirms this was deferred: `/* org-scoped if needed later */`. Any authenticated user with "edit" permission can read ALL RGB orders across ALL organizations.
- **Impact:** Cross-org data leakage of RGB order information.
- **Fix:** Add `organizationId: user.organizationId` to the `findMany` where clause.

### C3. RGB Order PATCH/DELETE has no org ownership check
- **File:** `src/app/api/settings/rgb-orders/[id]/route.ts`
- **What:** Any authenticated user with "edit" permission can modify or delete any org's RGB order by ID.
- **Impact:** Cross-org data manipulation.
- **Fix:** Verify the RGB order belongs to the user's org before update/delete.

### C4. `/turnovers/[id]` — perpetual skeleton on non-existent ID
- **File:** `src/app/(dashboard)/turnovers/[id]/turnover-detail-content.tsx`
- **What:** `if (isLoading || !turnover) return <PageSkeleton />` means if the turnover doesn't exist, the page shows a loading skeleton forever with no way to recover.
- **Impact:** Users see infinite loading state on invalid/deleted turnover links.
- **Fix:** Check `!isLoading && !turnover` separately and show a "not found" message.

---

## HIGH ISSUES

### H1. Onboarding company PATCH has no permission or completion guard
- **File:** `src/app/api/onboarding/company/route.ts:14`
- **What:** No permission string passed to `withAuth()`. Any authenticated user (any role) can create/update organizations. No check that onboarding is incomplete.
- **Impact:** Any user could potentially update their org's details post-onboarding.
- **Fix:** Add permission string and guard that `onboardingComplete === false`.

### H2. Violations stats route has inconsistent org scoping for ADMIN
- **File:** `src/app/api/violations/stats/route.ts:15-20`
- **What:** `ADMIN` role (org-level admin, not SUPER_ADMIN) gets `{}` as orgFilter, bypassing org restriction. This allows org ADMINs to potentially see violation stats from other orgs.
- **Impact:** Cross-org violation statistics visibility.
- **Fix:** Only SUPER_ADMIN should get `{}` orgFilter.

### H3. Two competing collection score algorithms with divergent logic
- **File:** `src/lib/scoring.ts:13-40` vs `src/lib/services/collections.service.ts:660-673`
- **What:** `calcCollectionScore()` in scoring.ts and the inline score in `recalculateTenantBalance()` use completely different inputs and weights. They produce different scores for the same tenant. The service version is what gets persisted.
- **Impact:** Confusion if scoring.ts is ever used; dead code risk.
- **Fix:** Remove `scoring.ts` if unused, or consolidate into one canonical algorithm.

### H4. AR aging buckets double-count 90+ and 120+ balances
- **File:** `src/lib/services/collections.service.ts:823-825`
- **What:** `days90` and `days120` both use `snap.balance90plus`. When `arrearsDays >= 120`, the same value appears in both columns. There is no `balance120plus` field.
- **Impact:** AR aging report shows inflated totals; buckets don't sum to total balance.
- **Fix:** Subtract 120+ portion from 90+ bucket, or add a `balance120plus` snapshot field.

### H5. Tenant PATCH dual-write not in a transaction
- **File:** `src/app/api/tenants/[id]/route.ts:85-129`
- **What:** `prisma.tenant.update()` and `prisma.lease.upsert()` are two separate DB operations. If the lease upsert fails, tenant data is updated but lease is stale.
- **Impact:** Tenant/lease data inconsistency on partial failure.
- **Fix:** Wrap both operations in `prisma.$transaction()`.

### H6. Payment deletion doesn't recalculate tenant balance
- **File:** `src/app/api/tenants/[id]/payments/[paymentId]/route.ts:16-17`
- **What:** Deletes a payment record but does not call `recalculateTenantBalance()`. The tenant's `balance` field becomes stale.
- **Impact:** Balance drift — displayed balance no longer matches actual payment history.
- **Fix:** Call `recalculateTenantBalance(tenantId)` after deletion.

### H7. Signal engine N+1 sequential DB calls in loops
- **File:** `src/lib/signals/engine.ts:82-141`
- **What:** `runSignalScan()` iterates over every detected signal with individual `findUnique` + `create/update` calls, then iterates over active signals for resolution. Hundreds/thousands of signals = hundreds of sequential queries.
- **Impact:** Performance degradation; potential Vercel timeout on large portfolios.
- **Fix:** Batch upserts using `createMany` or `$transaction` with batched operations.

### H8. Tenant detail GET returns raw Prisma Decimals as strings
- **File:** `src/app/api/tenants/[id]/route.ts:35`
- **What:** `return NextResponse.json(tenant)` returns raw Prisma object. Decimal fields serialize as strings (`"1234.50"`) instead of numbers. The list route at `src/app/api/tenants/route.ts` correctly uses `toNumber()`.
- **Impact:** Frontend receives string Decimals; potential parsing issues in UI.
- **Fix:** Map Decimal fields through `.toNumber()` before returning.

### H9. SUPER_ADMIN `organizationId!` null dereference in 20+ routes
- **File:** Multiple (comms, campaigns, vendors, etc.)
- **What:** SUPER_ADMIN users have `organizationId = null` but pass through `withAuth`. Using `user.organizationId!` in these routes passes `null` where a string is expected, potentially creating org-less records.
- **Impact:** Org-less records for SUPER_ADMIN operations; data integrity issues.
- **Fix:** Guard routes that require org context with an explicit `if (!user.organizationId)` check, or require SUPER_ADMIN to act within an org context.

### H10. `collectionScore >= 80` used as proxy for "in legal"
- **File:** `src/app/api/collections/report/route.ts:88`
- **What:** `inLegalCount` includes tenants with `collectionScore >= 80`, conflating high arrears score with legal status.
- **Impact:** Inflated "in legal" counts in reports.
- **Fix:** Check actual `legalCases` relation or a dedicated `inLegal` flag.

### H11. Legal review queue exposes items with null candidateTenantId to all org users
- **File:** `src/app/api/legal/review/route.ts:58-66`
- **What:** The OR clause `{ candidateTenantId: null }` means pending queue items without a candidate tenant are visible to all non-SUPER_ADMIN users regardless of org.
- **Impact:** Potential cross-org data exposure of import queue data.
- **Fix:** Add org scoping to the null-candidate query branch.

### H12. 7+ pages silently break when API calls fail
- **Files:** `alerts-content.tsx`, `leases-content.tsx`, `vacancies-content.tsx`, `maintenance-content.tsx`, `projects-content.tsx`, `reports-content.tsx`, `compliance-content.tsx`
- **What:** These pages use React Query hooks that throw on error, but components have no `isError` check. When the API fails, pages show empty/broken UI with no error message.
- **Impact:** Silent failures; users see blank screens with no indication of what went wrong.
- **Fix:** Add `isError` checks and display error UI in each content component.

### H13. 30 unbounded `findMany()` queries with no `take` / pagination
- **Files:** See Performance section for complete list
- **What:** 30 API routes return ALL matching records with no row limit. Notable: work-orders, violations, units, buildings, legal cases, vacancies, utilities.
- **Impact:** Vercel function timeouts and OOM on large portfolios (1000+ units).
- **Fix:** Add `take` parameter with reasonable defaults; implement cursor-based or offset pagination.

---

## MEDIUM ISSUES

### M1. No CSRF protection on custom API routes
- **File:** `src/lib/auth.ts`
- NextAuth CSRF token only covers `/api/auth/*`. Custom API routes rely on JWT session cookies with `SameSite` but no CSRF token validation.

### M2. Hardcoded demo password "Atlas2026!" in seed
- **File:** `prisma/seed.ts:604`
- 9 demo users share a hardcoded password. Risk if seed runs against production.

### M3. Collections-refresh cron uses non-timing-safe string comparison
- **File:** `src/app/api/cron/collections-refresh/route.ts:9`
- Unlike other cron routes that use `withCronAuth` (timing-safe), this one does direct string comparison.

### M4. Collection tenant edit not in a transaction
- **File:** `src/app/api/collections/tenants/[tenantId]/edit/route.ts:45-67`
- Tenant update and unit update are separate DB calls.

### M5. `parseInt` / `Number()` NaN risks on query params
- **Files:** `src/app/api/tenants/route.ts:39-40`, `src/app/api/buildings/route.ts:33-34`, `src/app/api/collections/tenants/route.ts:12-18`
- Malformed query params produce NaN which flows into Prisma queries.

### M6. HPD Complaints fetch missing `boroid` parameter
- **File:** `src/lib/nyc-open-data.ts:132-138`
- Block/lot numbers can repeat across boroughs. Without `boroid`, complaints may be returned for wrong building.

### M7. `respondByDate` mapped from `currentstatusdate` (wrong field)
- **File:** `src/lib/nyc-open-data.ts:252`
- Shows when status was last updated, not the cure deadline. `daysUntilCure` displays incorrect values.

### M8. Stage regression allowed without validation
- **File:** `src/lib/collections/collectionsStageService.ts:147-166`
- `advanceStage` accepts `newStage` 1-6 with no check that `newStage > currentStage`.

### M9. Bulk work order updates skip cross-entity validation
- **File:** `src/app/api/work-orders/bulk/route.ts:56-85`
- Bulk assign-vendor/assign-user doesn't call `validateWorkOrderRelations` to verify same-org.

### M10. Vacancy lost rent shows $0 when no rent values set
- **File:** `src/app/api/vacancies/route.ts:72-76`
- `bestRent` falls back to 0 if no rent fields populated, showing $0 lost rent for genuinely valuable units.

### M11. Utility `occupied_owner_paid` risk flag fires on master/common meters
- **File:** `src/lib/utility-risk.ts:65-72`
- Doesn't check `meter.classification`. A building master meter linked to a unit generates a false-positive risk flag.

### M12. Inconsistent alternating row shading on tables
- Various files. Collections, legal, maintenance, users tables lack alternating rows per CLAUDE.md requirement.

### M13. Internal mythology names still visible in UI
- Dashboard: "Argus Threat Map", "Run Argus Scan". URL `/coeus`. Themis references in legal defense. Titan component messages ("Argus is watching...", "Coeus is analyzing..."). Per W3-B, should be plain English.

### M14. `<img>` tags instead of Next.js `<Image>`
- **Files:** `src/app/(auth)/login/page.tsx:42`, `src/components/layout/sidebar.tsx:129,139`, `src/components/maintenance/work-order-detail-modal.tsx:305`
- Logo images loaded on every page miss WebP conversion and lazy loading optimization.

### M15. XLSX library imported statically in client bundle (~300KB)
- **File:** `src/lib/export.ts` imported by `src/components/ui/export-button.tsx`
- Should use dynamic `import()` to load only when user clicks Export.

### M16. React Query staleTime only 30 seconds globally
- **File:** `src/app/providers.tsx:13`
- Routes serving stable data (buildings, vendors, users) refetch every 30s, causing excessive API calls.

### M17. Missing empty states on Alerts, Leases, Reports pages
- **Files:** `alerts-content.tsx`, `leases-content.tsx`, `reports-content.tsx`
- Show empty tables with no guidance when no data exists.

### M18. Buildings tab shows bare table with no EmptyState component
- **File:** `src/components/data/buildings-tab.tsx`
- New users see an empty table with "0 buildings" counter but no icon/message/CTA.

### M19. Work Order and Campaign forms: required fields not all marked with `*`
- **Files:** `src/components/maintenance/create-work-order-modal.tsx`, `src/app/(dashboard)/communicate/page.tsx`
- Title and Description are required but not visually indicated.

### M20. Inconsistent success toast patterns across mutations
- Various forms. Some mutations show toasts, others silently close modals.

### M21. `as any` casts on vendor route bypass Zod schema type
- **File:** `src/app/api/vendors/route.ts:32`, `src/app/api/vendors/[id]/route.ts:20`
- `data as any` could pass unexpected fields to Prisma.

### M22. `/collections/[tenantId]` — no not-found handling for invalid tenant IDs
- **File:** `src/app/(dashboard)/collections/[tenantId]/page.tsx`
- Renders misleading page with "Tenant" as name and empty data instead of proper 404.

### M23. Zero code splitting beyond default Next.js route-level
- No `next/dynamic` or `React.lazy` usage found. Recharts loaded statically in 4 dashboard chart components.

### M24. Building detail GET has no permission string
- **File:** `src/app/api/buildings/[id]/route.ts:10`
- Any authenticated user with building access can fetch full building details including all units and tenants regardless of role.

---

## LOW / POLISH

### L1. User preferences routes have no permission string in `withAuth()`
- `src/app/api/user/preferences/route.ts` — self-scoped, likely intentional but undocumented.

### L2. `leaseCreateSchema` accepts client-supplied `organizationId`
- `src/lib/validations.ts:524` — latent risk if ever used for a create endpoint.

### L3. Double `as any` cast in middleware invocation
- `src/middleware.ts:123` — works but suppresses type checking.

### L4. `/turnovers` page is a dead redirect route
- Redirects to `/vacancies` — should be removed from the router.

### L5. `/violations/certification` not in sidebar navigation
- Orphaned page reachable only by direct URL.

### L6. No `not-found.tsx` or `loading.tsx` files in the app
- All routes share generic Next.js 404. No custom branded 404 page.

### L7. Compliance and Data page headings use inconsistent font styles
- Miss `font-display tracking-wide` used on other page headings.

### L8. "Occupied" KPI card navigates to `/alerts` (arrears) — unintuitive
- `src/app/(dashboard)/dashboard-content.tsx:103-109`

### L9. ComplianceWidget renders even when both values are zero
- Shows "Open Violations: 0 | Overdue Compliance: 0" with no value.

### L10. 19 `as any` casts in production code
- Mostly enum coercion and Prisma Json field assignments. See Section 2A for full list.

### L11. `findFirst` used where `findUnique` would suffice
- `src/app/api/users/invite/route.ts:62` — `email` is `@unique`.

### L12. Missing composite indexes
- `Violation[isOpen, class]` and `CollectionCase[tenantId, isActive]` — table scan risk at scale.

### L13. Sort parameter accepts arbitrary field names (safely defaulted)
- `src/app/api/tenants/route.ts:36`

### L14. `/settings/users` and `/users` appear to be duplicate user management pages
- Two separate paths for the same feature.

### L15. Daily briefing section empties use plain text instead of EmptyState component
- Plain `<p>` tags instead of consistent EmptyState with icon/message.

### L16. Sidebar collapse button hidden on mobile (intentional but noted)
- Mobile users can only toggle open/close, not minimize.

### L17. Vacancy table uses `min-w-[1200px]` — very wide for mobile
- No mobile-friendly alternative view (cards).

### L18. Two separate Owner nav items still live
- `/owner-dashboard` ("Owner View") and `/owner/dashboard` ("Owner Portal") — per W3-A, should be consolidated.

### L19. Zero API routes set Cache-Control headers
- All routes use `force-dynamic`. Stable data endpoints (buildings, vendors, users) could benefit from short cache headers.

### L20. 5 N+1 loop patterns in API routes
- `buildings/geocode`, `cron/maintenance`, `collections/bulk-followup`, `buildings/deduplicate`, `cron/collections-refresh`

---

## PAGE INVENTORY

| Route | Auth | Loading | Empty | Error | Notes |
|-------|:----:|:-------:|:-----:|:-----:|-------|
| `/` (Portfolio) | Yes | Skeleton | Yes | error.tsx | OK |
| `/alerts` | Yes | Skeleton | **No** | error.tsx | Missing empty state |
| `/coeus` (Signals) | Yes | Skeleton | Yes | error.tsx | OK |
| `/collections` | Yes | Skeleton | Yes | error.tsx | OK |
| `/collections/report` | Yes | Skeleton | Yes | error.tsx | OK |
| `/collections/[tenantId]` | Yes | Skeleton | Partial | **No** | No not-found, no error UI |
| `/communicate` | Yes | Text | Yes | **No** | Plain text loading |
| `/compliance` | Yes | Skeleton | Delegated | error.tsx | Tabs handle empties |
| `/daily` | Yes | Section skeletons | Per-section | error.tsx | Good per-section |
| `/data` | Yes | Skeleton | Delegated | error.tsx | Buildings tab bare |
| `/leases` | Yes | Skeleton | **No** | error.tsx | Missing empty state |
| `/legal` | Yes | Skeleton | Yes | error.tsx | OK |
| `/maintenance` | Yes | Skeleton | Yes | error.tsx | OK |
| `/onboarding` | Yes | Spinner | Yes | Fallback msg | OK |
| `/owner/dashboard` | Yes | Skeleton | Yes | error.tsx | Duplicate of owner-dashboard |
| `/owner-dashboard` | Yes | Skeleton | Yes | error.tsx | Duplicate of owner/dashboard |
| `/projects` | Yes | Skeleton | Yes | error.tsx | OK |
| `/projects/[id]` | Yes | Skeleton | Text msg | **No** | Bare "not found" text |
| `/reports` | Yes | Skeleton | **No** | error.tsx | Missing empty state |
| `/settings/billing` | Yes | Text | Yes | Inline | OK |
| `/settings/legal-rent-import` | Yes | **No** | Upload step | **No** | Minimal |
| `/settings/preferences` | Yes | Spinner | **No** | **No** | No error/empty |
| `/settings/rgb-orders` | Yes | Text | Yes | Inline | OK |
| `/settings/users` | Yes | Skeleton | Yes | **No** | No error UI |
| `/themis` | Yes | Suspense | Delegated | error.tsx | OK |
| `/turnovers` | Yes | N/A | N/A | N/A | Redirects to /vacancies |
| `/turnovers/[id]` | Yes | Skeleton | **Infinite skeleton** | **No** | CRITICAL: perpetual load |
| `/users` | Yes | Skeleton | Yes | error.tsx | OK |
| `/utilities` | Yes | Skeleton | Yes | error.tsx | OK |
| `/vacancies` | Yes | Skeleton | Yes | error.tsx | OK |
| `/violations/certification` | Yes | Spinner | Yes | **No** | Not in nav |
| `/login` | No | Spinner | N/A | Inline | OK |
| `/odk` | PIN | Skeleton | N/A | Partial | Internal tool |
| `/request` | No | Suspense | Delegated | Delegated | Public form |

---

## API ROUTE INVENTORY

| Route | Methods | Auth | Org Scoped | Error Handled | Notes |
|-------|---------|:----:|:----------:|:-------------:|-------|
| `/api/ai/chat` | POST | withAuth | Yes | Yes | |
| `/api/ai/enhance-text` | POST | withAuth | Yes | Yes | |
| `/api/auth/[...nextauth]` | GET,POST | NextAuth | N/A | Yes | |
| `/api/billing/status` | GET | withAuth | Yes | Yes | |
| `/api/buildings` | GET,POST | withAuth | Yes | Yes | GET unbounded |
| `/api/buildings/[id]` | GET,PATCH,DEL | withAuth | Yes | Yes | GET no perm string |
| `/api/buildings/deduplicate` | GET,POST,PUT | withAuth | Yes | Yes | N+1 in merge |
| `/api/buildings/geocode` | POST | withAuth | Yes | Yes | N+1 per building |
| `/api/buildings/risk-map` | GET | withAuth | Yes | Yes | Unbounded, heavy |
| `/api/collections/alerts` | GET | withAuth | Yes | Yes | |
| `/api/collections/bulk` | POST | withAuth | Yes | Yes | |
| `/api/collections/bulk-followup` | POST | withAuth | Yes | Yes | N+1 access check |
| `/api/collections/dashboard` | GET | withAuth | Yes | Yes | |
| `/api/collections/recalculate` | POST | withAuth | Yes | Yes | |
| `/api/collections/report` | GET | withAuth | Yes | Yes | Unbounded; score>=80 bug |
| `/api/collections/send-to-legal` | POST | withAuth | Yes | Yes | |
| `/api/collections/stage-alerts` | GET | withAuth | Yes | Yes | |
| `/api/collections/tenants` | GET | withAuth | Yes | Yes | |
| `/api/collections/tenants/[id]` | GET | withAuth | Yes | Yes | |
| `/api/collections/tenants/[id]/action` | POST | withAuth | Yes | Yes | |
| `/api/collections/tenants/[id]/advance-stage` | POST | withAuth | Yes | Yes | No regression guard |
| `/api/collections/tenants/[id]/ai-recommend` | GET | withAuth | Yes | Yes | |
| `/api/collections/tenants/[id]/edit` | PATCH | withAuth | Yes | Yes | No transaction |
| `/api/collections/tenants/[id]/notes` | GET,POST | withAuth | Yes | Yes | GET unbounded |
| `/api/collections/tenants/[id]/stage` | GET | withAuth | Yes | Yes | |
| `/api/collections/tenants/[id]/status` | PATCH | withAuth | Yes | Yes | |
| `/api/command/docs` | GET | ODK PIN | N/A | Partial | Path hardened |
| `/api/command/status` | GET | ODK PIN | N/A | Partial | |
| `/api/command/tracker` | GET | ODK PIN | N/A | Partial | |
| `/api/command/verify` | POST | Rate-limited | N/A | Yes | |
| `/api/comms/conversations` | GET,POST | withAuth | Yes | Yes | |
| `/api/comms/conversations/[id]` | GET,PATCH | withAuth | Yes | Yes | |
| `/api/comms/conversations/[id]/mark-read` | POST | withAuth | Yes | Yes | |
| `/api/comms/conversations/[id]/members` | POST,DEL | withAuth | Yes | Yes | |
| `/api/comms/conversations/[id]/messages` | GET,POST | withAuth | Yes | Yes | |
| `/api/comms/entity-thread` | GET | withAuth | Yes | Yes | |
| `/api/comms/search` | GET | withAuth | Yes | Yes | |
| `/api/comms/unread-count` | GET | withAuth | Yes | Yes | |
| `/api/communicate/campaigns` | GET,POST | withAuth | Yes | Yes | GET unbounded |
| `/api/compliance` | GET,POST | withAuth | Yes | Yes | GET unbounded |
| `/api/compliance/[id]` | PATCH,DEL | withAuth | Yes | Yes | |
| `/api/compliance/generate` | POST | withAuth | Yes | Yes | |
| `/api/cron/collections-refresh` | POST | Bearer | All orgs | Yes | Non-timing-safe auth |
| `/api/cron/maintenance` | POST | withCronAuth | All orgs | Yes | N+1 |
| `/api/cron/signals` | POST | CRON_SECRET | All orgs | Yes | |
| `/api/cron/violations` | POST | CRON_SECRET | All orgs | Yes | |
| `/api/email` | POST | withAuth | Yes | Yes | |
| `/api/export` | GET | withAuth | Yes | Yes | Unbounded |
| `/api/health` | GET | **None** | N/A | Yes | Intentionally public |
| `/api/import/*` (15 routes) | POST | withAuth | Yes | Yes | |
| `/api/leasing-activities` | GET,POST | withAuth | Yes | Yes | |
| `/api/legal` | GET | withAuth | Yes | Yes | Unbounded |
| `/api/legal/candidates` | GET | withAuth | Yes | Yes | Unbounded |
| `/api/legal/court-dates` | GET | withAuth | Yes | Yes | Unbounded |
| `/api/legal/review` | GET,POST | withAuth | Yes | Yes | Cross-org leak risk |
| `/api/legal/stats` | GET | withAuth | Yes | Yes | ADMIN org scope bug |
| `/api/legal/users` | GET | withAuth | Yes | Yes | |
| `/api/legal/vendors` | GET | withAuth | Yes | Yes | |
| `/api/maintenance-schedules` | GET,POST | withAuth | Yes | Yes | GET unbounded |
| `/api/maintenance-schedules/[id]` | PATCH,DEL | withAuth | Yes | Yes | |
| `/api/metrics` | GET | withAuth | Yes | Yes | All tenants in memory |
| `/api/metrics/daily-summary` | GET | withAuth | Yes | Yes | |
| `/api/onboarding/building` | POST | withAuth | Yes | Yes | |
| `/api/onboarding/company` | POST | withAuth | Yes | Yes | No perm string |
| `/api/onboarding/complete` | POST | withAuth | Yes | Yes | |
| `/api/onboarding/status` | GET | withAuth | Yes | Yes | |
| `/api/organizations` | GET | withAuth | Yes | Yes | |
| `/api/owner/summary` | GET | withAuth | Yes | Yes | Deep includes, unbounded |
| `/api/owner-dashboard` | GET | withAuth | Yes | Yes | |
| `/api/projects` | GET,POST | withAuth | Yes | Yes | GET unbounded |
| `/api/projects/[id]` | GET,PATCH | withAuth | Yes | Yes | |
| `/api/projects/[id]/approve` | POST | withAuth | Yes | Yes | |
| `/api/projects/[id]/budget-lines` | POST | withAuth | Yes | Yes | |
| `/api/projects/[id]/change-orders` | POST | withAuth | Yes | Yes | |
| `/api/projects/[id]/link-violations` | POST | withAuth | Yes | Yes | Same-building enforced |
| `/api/projects/[id]/link-work-orders` | POST | withAuth | Yes | Yes | Same-building enforced |
| `/api/projects/[id]/milestones` | POST | withAuth | Yes | Yes | |
| `/api/projects/[id]/milestones/[mid]` | PATCH | withAuth | Yes | Yes | |
| `/api/settings/rgb-orders` | GET,POST | withAuth | **No** | Yes | CRITICAL: no org scope |
| `/api/settings/rgb-orders/[id]` | PATCH,DEL | withAuth | **No** | Yes | CRITICAL: no org check |
| `/api/signals` | GET | withAuth | Yes | Yes | Unbounded |
| `/api/signals/[id]` | PATCH | withAuth | Yes | Yes | |
| `/api/tenants` | GET,POST | withAuth | Yes | Yes | Paginated (good) |
| `/api/tenants/[id]` | GET,PATCH | withAuth | Yes | Yes | GET: raw Decimals |
| `/api/tenants/[id]/legal/*` | Various | withAuth | Yes | Yes | |
| `/api/tenants/[id]/notes/*` | Various | withAuth | Yes | Yes | GET unbounded |
| `/api/tenants/[id]/payments/*` | Various | withAuth | Yes | Yes | GET unbounded; DEL no rebalance |
| `/api/themis/*` | Various | withAuth | Yes | Yes | |
| `/api/turnovers` | GET,POST | withAuth | Yes | Yes | |
| `/api/turnovers/[id]` | GET,PATCH | withAuth | Yes | Yes | |
| `/api/units` | GET,POST | withAuth | Yes | Yes | GET unbounded |
| `/api/units/[id]` | PATCH,DEL | withAuth | Yes | Yes | |
| `/api/user/preferences` | GET,PATCH | withAuth | Yes | Yes | No perm string |
| `/api/user/terms` | POST | withAuth | Yes | Yes | |
| `/api/users` | GET,POST | withAuth | Yes | Yes | GET unbounded |
| `/api/users/invite` | POST | withAuth | Yes | Yes | |
| `/api/users/[id]` | PATCH,DEL | withAuth | Yes | Yes | |
| `/api/users/[id]/assign-buildings` | PATCH | withAuth | Yes | Yes | |
| `/api/users/[id]/permissions` | GET,PATCH | withAuth | Yes | Yes | |
| `/api/utilities/accounts` | POST | withAuth | Yes | Yes | Unique active enforced |
| `/api/utilities/accounts/[id]` | GET,PATCH | withAuth | Yes | Yes | |
| `/api/utilities/accounts/[id]/checks` | GET,POST | withAuth | Yes | Yes | |
| `/api/utilities/accounts/[id]/checks/[cid]` | PATCH | withAuth | Yes | Yes | |
| `/api/utilities/meters` | GET,POST | withAuth | Yes | Yes | GET unbounded, deep |
| `/api/utilities/meters/[id]` | GET,PATCH,DEL | withAuth | Yes | Yes | |
| `/api/utilities/summary` | GET | withAuth | Yes | Yes | Unbounded, deep |
| `/api/vacancies` | GET | withAuth | Yes | Yes | Unbounded |
| `/api/vacancies/[uid]/rent` | POST | withAuth | Yes | Yes | |
| `/api/vacancies/[uid]/status` | PATCH | withAuth | Yes | Yes | |
| `/api/vendors` | GET,POST | withAuth | Yes | Yes | GET unbounded, `as any` |
| `/api/vendors/[id]` | PATCH,DEL | withAuth | Yes | Yes | `as any` |
| `/api/violations` | GET | withAuth | Yes | Yes | Unbounded |
| `/api/violations/cert-packets` | GET,POST | withAuth | Yes | Yes | GET unbounded, deep |
| `/api/violations/stats` | GET | withAuth | **Partial** | Yes | ADMIN scope bug |
| `/api/violations/sync` | POST | withAuth | Yes | Yes | Cross-org sync risk |
| `/api/violations/test` | GET | withAuth | Yes | Yes | |
| `/api/violations/[id]/certify` | POST | withAuth | Yes | Yes | |
| `/api/violations/[id]/create-work-order` | POST | withAuth | Yes | Yes | |
| `/api/work-orders` | GET,POST | withAuth | Yes | Yes | GET unbounded |
| `/api/work-orders/bulk` | POST | withAuth | Yes | Yes | Skips relation validation |
| `/api/work-orders/request` | GET,POST | **None** | N/A | Yes | Intentional (tenant-facing) |
| `/api/work-orders/[id]` | GET,PATCH,DEL | withAuth | Yes | Yes | |
| `/api/work-orders/[id]/activity` | GET | withAuth | Yes | Yes | Unbounded |
| `/api/work-orders/[id]/comments` | GET,POST | withAuth | Yes | Yes | Unbounded |
| `/api/work-orders/[id]/evidence` | GET,POST | withAuth | Yes | Yes | Unbounded |
| `/api/work-orders/[id]/photos` | POST | withAuth | Yes | Yes | |

---

## SUMMARY SCORECARD

| Category | Score /10 | Notes |
|----------|:---------:|-------|
| **Security** | 7 | Strong withAuth + data-scope foundation. RGB orders cross-org leak, violation sync cross-org, SUPER_ADMIN null dereference, and legal review queue leak bring it down. |
| **Data Integrity** | 6 | Payment deletion doesn't rebalance, tenant PATCH not transactional, AR aging double-counts, Decimal serialization inconsistent, dual scoring algorithms. |
| **Page Completeness** | 7 | 34 pages total. Most work well. Turnovers detail infinite skeleton, collections detail no not-found, 3 pages missing empty states. |
| **UX/UI Quality** | 6 | Solid dark theme. 7+ pages silently break on API errors. Missing empty states. Inconsistent success toasts. Mythology names still in UI. |
| **Mobile** | 7 | Sidebar collapses, tables scroll, responsive grids. Vacancy table very wide. Dashboard map questionable on touch. |
| **Performance** | 4 | 30 unbounded queries. 5 N+1 patterns. XLSX in client bundle. No code splitting. 30s global staleTime. All routes force-dynamic. |
| **Code Quality** | 7 | Clean TypeScript (0 errors). Consistent patterns. 19 `as any` casts (mostly low risk). Good test coverage (467 tests). |

**Overall: 6.3 / 10** — Solid architecture and security foundation, but performance and error handling need significant work before a production client environment at scale.

---

## TOP 10 PRIORITY FIXES

1. **Fix RGB Orders cross-org data leak** (C2, C3) — Add `organizationId` scoping to all RGB order routes. 15 minutes. Security blocker.

2. **Fix `syncAllBuildings` cross-org writes** (C1) — Scope the building query to the triggering user's org. 10 minutes. Security blocker.

3. **Fix violations/stats ADMIN org scoping** (H2) — Only SUPER_ADMIN should bypass org filter. 5 minutes. Security.

4. **Fix legal review queue cross-org leak** (H11) — Add org scoping to null-candidate query. 10 minutes. Security.

5. **Add pagination to top 10 heaviest unbounded queries** (H13) — work-orders, violations, units, buildings, legal, vacancies, utilities/meters, utilities/summary, owner/summary, metrics. Prevents Vercel timeouts at scale.

6. **Wrap tenant PATCH in transaction + fix payment deletion rebalance** (H5, H6) — Two data integrity bugs. 30 minutes combined.

7. **Fix AR aging bucket double-count** (H4) — Separate 90-day and 120+ day buckets. 20 minutes. Report accuracy.

8. **Fix Decimal serialization on tenant detail GET** (H8) — Map through `.toNumber()`. 10 minutes. Frontend data consistency.

9. **Add error UI to 7+ content pages** (H12) — Add `isError` checks and display error components. 1-2 hours. UX reliability.

10. **Fix turnovers/[id] perpetual skeleton** (C4) — Check `!isLoading && !turnover` and show not-found. 5 minutes. UX blocker.
