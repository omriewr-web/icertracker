# Test Coverage Analysis

**Date:** 2026-03-19

## Current State: ~2% Coverage

The codebase has **~25,000+ lines of source code** across 220+ files, but only **3 test files totaling ~317 lines** in `src/__tests__/`:

| Test File | What it covers |
|---|---|
| `data-scope.test.ts` | Authorization scoping (getBuildingScope, getTenantScope, canAccessBuilding) |
| `bootstrap-admin.test.ts` | Import safety checks for auth module |
| `nyc-open-data.test.ts` | HPD violation field mapping |

Testing framework (Vitest) is configured, but there is no CI/CD pipeline to run tests automatically — testing is entirely manual.

## Recommended Areas for Test Improvement (Priority Order)

### 1. Data Import Pipeline — Highest Risk, 0% coverage

**Files:** `src/lib/importer/` (15 files, ~1,746 lines) and `src/lib/excel-import.ts` (626 lines)

This is the most critical gap. Import logic parses external Excel/CSV files from Yardi and AppFolio, normalizes headers, fuzzy-matches columns, validates rows, and commits data to the database. A bug here silently corrupts tenant/financial data at scale.

**Tests should cover:**
- Header normalization and fuzzy matching (`normalizeHeader.ts`, `fuzzyMapHeaders.ts`, `mapHeadersWithAliases.ts`)
- Structure analysis and format detection (`analyzeStructure.ts`, `matchImportProfile.ts`)
- Row validation with known-good and known-bad sample data (`validateImportRows.ts`)
- Excel parsing edge cases (empty rows, merged cells, multiple sheets)

### 2. Building & Legal Matching — Data Quality Risk, 0% coverage

**Files:** `src/lib/building-matching.ts` (197 lines), `src/lib/legal-matching.ts` (243 lines)

These modules do address normalization and fuzzy deduplication — string-manipulation logic that is both error-prone and highly testable as pure functions.

**Tests should cover:**
- Address normalization (abbreviations, casing, punctuation)
- Match/no-match boundary cases for deduplication scoring
- Legal case matching against tenants and buildings

### 3. Decision Engine — Core Business Logic, 0% coverage

**Files:** `src/lib/decision/` (8 modules: collections, leases, moveOut, vacancy, violations, workOrders, ownerSummary)

This is the strategic recommendation engine — the business logic that drives what property managers see and act on.

**Tests should cover:**
- Collection escalation rules produce correct action recommendations
- Lease renewal/expiration logic handles edge cases (month-to-month, expired, future start)
- Vacancy turnover workflow state transitions
- Violation severity scoring and prioritization

### 4. Zod Validation Schemas — API Contract Safety, 0% coverage

**Files:** `src/lib/validations.ts` (307 lines, 26+ schemas)

These schemas guard every API endpoint. Testing them ensures that valid payloads pass and invalid payloads are rejected with clear errors.

**Tests should cover:**
- Each schema should have at least one positive and one negative test case
- Edge cases: missing required fields, wrong types, boundary values
- These are pure data-in/data-out — very easy to test

### 5. API Route Authorization — Security Risk, 0% coverage

**Files:** `src/app/api/` (44 route files, ~3,892 lines)

While `data-scope.ts` is tested, the actual routes that use it are not. Integration tests should verify:

- Unauthenticated requests are rejected (401)
- Role-based access is enforced (PM can't access admin routes)
- Scoped users can't access unassigned buildings through any endpoint
- Request body validation rejects malformed payloads
- This would require a lightweight test harness (e.g., calling route handlers directly with mocked `NextRequest` objects)

### 6. Compliance & Risk Scoring — Business Accuracy, 0% coverage

**Files:** `src/lib/scoring.ts` (71 lines), `src/lib/compliance-scoring.ts` (44 lines)

These are small, pure functions that calculate the core "Revenue at Risk" metric — the platform's primary value proposition. They are trivial to test and high-value to get right.

## Infrastructure Recommendations

| Gap | Recommendation |
|---|---|
| **No CI/CD** | Add a GitHub Actions workflow that runs `npm run test`, `npm run typecheck`, and `npm run lint` on every PR |
| **No component tests** | Add `jsdom` environment to vitest config and `@testing-library/react` for component testing when ready |
| **No E2E tests** | Consider Playwright for critical flows (login, import, report generation) as a later phase |
| **No test data fixtures** | Create shared fixture files for buildings, tenants, and users to reduce test boilerplate |
| **No coverage reporting** | Add `--coverage` flag to vitest and set a coverage floor (start with 20%, ratchet up over time) |

## Quick Wins (Highest ROI for Least Effort)

If you want to start improving coverage immediately, these give the best return:

1. **Validation schemas** — Pure input/output, no mocking needed, ~1 hour of work
2. **Building/legal matching** — Pure string functions, easy to test, catches real bugs
3. **Scoring functions** — Small files, high business value, 30 minutes of work
4. **Import header normalization** — Pure functions, many edge cases, prevents data corruption

All of these are pure-function modules with no database or network dependencies, making them ideal first targets.
