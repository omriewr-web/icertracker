# Agent 2 Results — Auth & Route Hardening

## Files Modified

| File | Task | Change |
|------|------|--------|
| `src/lib/data-scope.ts` | 1 | Added organizationId defense-in-depth to 4 scope functions |
| `src/app/api/metrics/route.ts` | 2 | Added `"dash"` permission string |
| `src/app/api/metrics/daily-summary/route.ts` | 2 | Added `"dash"` permission string |
| `src/app/api/tenants/route.ts` | 2 | Added `"dash"` permission string to GET |
| `src/app/api/units/route.ts` | 2 | Added `"dash"` permission string to GET |
| `src/app/api/export/route.ts` | 2 | Added `"reports"` permission string |
| `src/app/api/import/legal-cases/route.ts` | 3 | Extract user from session, pass organizationId to service |
| `prisma/schema.prisma` | 4 | Added 7 composite indexes |

## Task 1 — organizationId Defense-in-Depth

Added `organizationId` as a secondary filter for **all non-admin, non-SUPER_ADMIN users** in:

- **`getBuildingScope()`** — added `building: { organizationId: user.organizationId }` to both the explicit-buildingId and assigned-properties branches
- **`getBuildingIdScope()`** — added `organizationId: user.organizationId` (this model queries the Building table directly)
- **`getTenantScope()`** — added `building: { organizationId: user.organizationId }` nested under the `unit` relation
- **`getLeaseScope()`** — added `organizationId: user.organizationId` (Lease has a direct organizationId FK)

The `ScopeUser` interface already had `organizationId?: string | null`, and `AuthUser` in api-helpers.ts populates it from the session. No type changes needed.

## Task 2 — Permission Strings

| Route | Method | Permission | Rationale |
|-------|--------|------------|-----------|
| `api/metrics` | GET | `"dash"` | Portfolio metrics are core dashboard data. Blocks SUPER (maintenance-only) and ACCOUNTING roles. Matches pattern used by `api/signals`, `api/buildings/risk-map`, `api/ai/chat`. |
| `api/metrics/daily-summary` | GET | `"dash"` | Daily summary feeds the dashboard. Same rationale as metrics. |
| `api/tenants` | GET | `"dash"` | Tenant list is primary dashboard content. POST already had `"edit"`. |
| `api/units` | GET | `"dash"` | Unit list is primary dashboard content. POST already had `"edit"`. |
| `api/export` | GET | `"reports"` | Data export is a reporting function. Blocks SUPER, BROKER, LEASING_AGENT, and other roles without `reports` permission. |

### Roles affected by new permissions

- **SUPER** role: loses access to metrics, tenants, units, export (correct — SUPER is for maintenance/compliance only)
- **ACCOUNTING** role: loses access to metrics, tenants, units (correct — ACCOUNTING has `fin`, `reports`, `legal`, `collections` only); retains export via `reports`
- **LEASING_AGENT** role: loses access to export (correct — no `reports` permission); retains metrics/tenants/units via `dash`

## Task 3 — Legal-Cases Import orgId Passthrough

- Changed handler signature from `async (req: NextRequest)` to `async (req: NextRequest, { user })`
- Changed service call from `importLegalCases(rows)` to `importLegalCases(rows, user.organizationId!)`
- Agent 1 had already updated `legal-import.service.ts` to accept `organizationId: string` as a required second parameter and scope building/tenant queries to the org

## Task 4 — Database Indexes

| Model | New Index | Purpose |
|-------|-----------|---------|
| Tenant | `[unitId, balance]` | Scoped arrears queries (Tenant has no direct buildingId; scopes through unitId) |
| WorkOrder | `[status, priority]` | Filtered work order lists by status + priority |
| WorkOrder | `[buildingId, status]` | Building-scoped work order queries |
| Violation | `[source, currentStatus]` | Violation source + status filtering (field is `currentStatus`, not `status`) |
| Violation | `[buildingId, isOpen]` | Building-scoped open violation lookups |
| CollectionCase | `[buildingId, status]` | Building-scoped collection pipeline views |
| LegalCase | `[buildingId, isActive]` | Building-scoped active legal case lookups |

### Already-existing indexes (no changes needed)

- Building `[block, lot]` — already existed
- Building `[organizationId]` — already existed
- Tenant `[balance]` — already existed as single-column index
- Tenant `[leaseExpiration]` — already existed as single-column index

### Adaptation note

The task specified `@@index([buildingId, balance])` on Tenant, but the Tenant model has no direct `buildingId` field (it relates through `Unit`). Added `[unitId, balance]` instead, which serves the same query optimization purpose for scoped balance queries.

## Files NOT Fixed (Out of Scope)

| File | Issue | Reason |
|------|-------|--------|
| `src/app/api/import/ar-aging/route.ts` | TS2554: `importARAgingData(rows)` now expects 2 arguments | Agent 1 updated `ar-import.service.ts` to require `organizationId` but this route was not in my task scope. Needs the same fix as legal-cases: extract `user.organizationId` and pass it to the service. |

## Type Errors

- **Resolved**: All errors from my changes compile cleanly
- **Pre-existing (not from my changes)**:
  - `ar-aging/route.ts` TS2554 — Agent 1's service signature change (see above)
  - `tenants/route.ts` — multiple TS errors from concurrent external modifications adding pagination support (not from my permission string change)
  - `.next/types/**` TS6053 — missing build artifacts (normal for a project without a recent `next build`)
