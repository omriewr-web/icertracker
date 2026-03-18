# Wave 4 — Workflow Test Report

**Date:** 2026-03-18
**Runner:** Vitest v4.0.18
**Total:** 99 tests across 4 suites, all passing
**Duration:** ~320ms

---

## W4-A: Collections Workflow Tests (23 tests)

**File:** `src/__tests__/w4a-collections.test.ts`

| Area | Tests | Status |
|------|-------|--------|
| Note schema validation | 5 | PASS |
| Status update schema | 3 | PASS |
| Status constants (statuses.ts) | 2 | PASS |
| Collection score algorithm | 6 | PASS |
| Arrears category derivation | 7 | PASS |

**Coverage:**
- All 10 valid `CollectionActionType` values tested
- Score algorithm mirrors `recalculateTenantBalance`: +10 balance>0, +15 b31_60, +25 b61_90, +30 b90plus, +20 legal, +10 months>=3, +10 no payment, +10 stale payment. Max 100.
- Arrears category: current/30/60/90/120+ based on worst AR snapshot bucket
- Status display labels and color mappings from `src/lib/constants/statuses.ts`

---

## W4-B: Import Workflow Tests (21 tests)

**File:** `src/__tests__/w4b-import.test.ts`

| Area | Tests | Status |
|------|-------|--------|
| parseImportFile (xlsx/csv/empty/null/corrupt) | 6 | PASS |
| checkRowLimit | 4 | PASS |
| validateUpload (FormData) | 6 | PASS |
| Import constants | 4 | PASS |
| Excel import module exports | 1 | PASS |

**Coverage:**
- File parsing: valid xlsx, csv, empty file, null cells, corrupt buffer, extension detection
- Row limit: under limit (null), over limit (400 + error code), custom limits
- Upload validation: valid xlsx/csv, missing file (MISSING_FILE), bad extension (INVALID_FILE_TYPE), oversized (FILE_TOO_LARGE, 413), MIME fallback
- Constants: MAX_FILE_SIZE=10MB, MAX_ROWS=5000, allowed extensions

---

## W4-C: Vacancy Lifecycle Tests (24 tests)

**File:** `src/__tests__/w4c-vacancy.test.ts`

| Area | Tests | Status |
|------|-------|--------|
| Status definitions | 3 | PASS |
| isVacant mapping | 5 | PASS |
| syncVacancyState stage mapping | 5 | PASS |
| Turnover workflow progression | 1 | PASS |
| Lost rent calculation | 6 | PASS |
| Days vacant calculation | 4 | PASS |

**Coverage:**
- All 9 VacancyStatus values tested against Prisma enum
- VACANT through LEASED = isVacant:true; OCCUPIED = isVacant:false
- Stage mapping: VACANT/PRE_TURNOVER→vacant, TURNOVER→renovation, READY_TO_SHOW through LISTED→listed, LEASED→lease_signed
- TurnoverWorkflow: forward-only progression verified (PENDING_INSPECTION < COMPLETE)
- bestRent cascade: approved || proposed || asking || legal || 0 (marketRent excluded)
- Days vacant: null input, today, 30 days ago, future date (clamped to 0)

---

## W4-D: Owner Data Visibility Tests (31 tests)

**File:** `src/__tests__/w4d-owner-visibility.test.ts`

| Area | Tests | Status |
|------|-------|--------|
| OWNER read permissions | 6 | PASS |
| OWNER write denied | 7 | PASS |
| OWNER no-access modules | 5 | PASS |
| OWNER zero writes check | 1 | PASS |
| getBuildingScope (OWNER) | 4 | PASS |
| getBuildingIdScope (OWNER) | 3 | PASS |
| getTenantScope (OWNER) | 2 | PASS |
| ADMIN vs OWNER comparison | 4 | PASS |
| EMPTY_SCOPE sentinel | 2 | PASS |

**Coverage:**
- OWNER read: owner-dashboard, collections, legal, tenants, vacancies, compliance, maintenance
- OWNER denied: dashboard, utilities, users, data-import, settings, organizations
- OWNER has zero write permissions across all 17 modules (verified exhaustively)
- Building scope: assigned buildings only + org filter; EMPTY_SCOPE for no assignments
- Tenant scope: nested unit.buildingId filter scoped to assigned buildings
- Unassigned building access returns EMPTY_SCOPE
- ADMIN sees org-wide; OWNER sees assigned-only

---

## Architecture Notes

- Tests use **unit test** pattern: direct function imports with mocked prisma
- No HTTP integration tests (those require a running server)
- Scoring and categorization logic extracted as pure functions for testability
- All tests run in <400ms total
- Vitest config: `globals: true`, `environment: "node"`, alias `@/ → ./src/`
