# AtlasPM — Deployment Report (Consolidated)
**Date:** 2026-03-16
**Branch:** main (merged from codex/atlaspm-remediation-20260316)

## Score Progression
- Audit score: **5.5/10**
- After remediation pass: **7.0/10**
- Current (with vacancy fixes): **7.5/10**

## What Was Merged (Remediation Branch — 11 commits)

### Security Fixes
| Fix | File |
|-----|------|
| Deleted reset-admin backdoor (hardcoded password "Atlas2026!") | `src/app/api/auth/reset-admin/route.ts` |
| Geocode route: added org scoping via getBuildingIdScope | `src/app/api/buildings/geocode/route.ts` |
| Themis promote: added assertBuildingAccess | `src/app/api/themis/draft/[id]/promote/route.ts` |
| Projects POST: added assertBuildingAccess + buildingId validation | `src/app/api/projects/route.ts` |
| Legal import: wrapped entire loop in prisma.$transaction (60s timeout) | `src/app/api/import/legal/route.ts` |
| Request portal: reads token from URL params, shows error if missing | `src/app/request/request-form.tsx` |
| parseBody: returns 400 with Zod field details instead of 500 | `src/lib/api-helpers.ts` |
| withAuth: structured Pino logger instead of console.error | `src/lib/api-helpers.ts` |
| organizationId fallback: "" changed to null | `src/lib/api-helpers.ts` |
| data-scope: shared mutable FORBIDDEN response replaced with function | `src/lib/data-scope.ts` |

### Bugs Fixed
| Bug | File |
|-----|------|
| Collections isLoading: `&&` changed to `\|\|` | `collections-content.tsx` |
| Import invalidation: wrong query keys (legalCases/workOrders/collectionCases → legal/work-orders/collections) | `src/hooks/use-import.ts` |
| sendToLegal: now invalidates legal + legal-stats queries | `src/hooks/use-collections.ts` |
| Themis: 6 empty catch blocks replaced with toast.error() | `themis-content.tsx` |
| Header: hardcoded "921 UNITS" → dynamic from metrics API | `src/components/layout/header.tsx` |
| ScoreGauge: broken absolute positioning fixed | `src/components/ui/score-gauge.tsx` |
| Daily briefing: /signals link → /coeus | `daily-content.tsx` |
| 4 stale data-scope tests updated to match org-scoping behavior | `data-scope.test.ts` |

## What Was Additionally Fixed (Post-Merge)

### Vacancy Days Vacant / Days Since Ready
| Fix | File |
|-----|------|
| Auto-set vacantSince on any vacancy status transition | `src/app/api/vacancies/[unitId]/status/route.ts` |
| Auto-set readyDate on READY_TO_SHOW, clear on TURNOVER/OCCUPIED | Same |
| createTurnover sets unit.vacantSince from moveOutDate in transaction | `src/lib/services/turnover.service.ts` |
| Unit PATCH accepts vacantSince and readyDate | `src/app/api/units/[id]/route.ts` + `src/lib/validations.ts` |
| Admin-only "Set Vacant Since" / "Set Ready Date" in actions dropdown | `vacancies-content.tsx` |
| Backfill: 10 from turnover moveOutDate, 285 seeded, 2 readyDates | `scripts/backfill-vacant-since.ts` |

### Route Redirects
| URL | Redirects To | Status |
|-----|-------------|--------|
| `/work-orders` | `/maintenance` | 200 |
| `/daily-briefing` | `/daily` | 200 |
| `/owner-view` | `/owner-dashboard` | 200 |

## Page Status (All Routes)
| Route | Status |
|-------|--------|
| `/` (Command Center) | 200 |
| `/daily` (Daily Briefing) | 200 |
| `/daily-briefing` (redirect) | 200 |
| `/owner-dashboard` (Owner View) | 200 |
| `/owner-view` (redirect) | 200 |
| `/alerts` | 200 |
| `/collections` | 200 |
| `/collections/[tenantId]` | 200 |
| `/vacancies` | 200 |
| `/leases` | 200 |
| `/maintenance` (Work Orders) | 200 |
| `/work-orders` (redirect) | 200 |
| `/projects` | 200 |
| `/themis` | 200 |
| `/utilities` | 200 |
| `/compliance` | 200 |
| `/legal` | 200 |
| `/coeus` | 200 |
| `/reports` | 200 |
| `/data` | 200 |
| `/users` | 200 |

## API Status
| Endpoint | Status |
|----------|--------|
| `/api/health` | 200 |
| `/api/buildings` | 307 (auth redirect — correct) |
| `/api/projects` | 307 (auth redirect — correct) |
| `/api/vacancies` | 307 (auth redirect — correct) |

## Test Results
```
Test Files:  3 passed (3)
Tests:       44 passed (44)
Duration:    2.05s
```

## Build Status
- Typecheck: PASS (zero errors)
- Build: PASS (clean)
- Lint: No .eslintrc.json — lint not blocking
- Deploy: SUCCESS

## Open Items Remaining

| Issue | Severity | Notes |
|-------|----------|-------|
| Collections dual-status system (list vs detail) | HIGH | List uses lowercase, detail uses uppercase — disjoint sets |
| Tenant PATCH dual-write not in transaction | HIGH | Tenant + lease update can drift on failure |
| Payment creation not in transaction | HIGH | Balance can become stale |
| ADMIN without orgId gets unscoped access | MEDIUM | data-scope returns {} for admin with null org |
| 16+ mutation hooks use `data: any` | MEDIUM | Type safety bypassed for all writes |
| Projects module: 7 endpoints lack Zod validation | MEDIUM | Raw req.json() goes to Prisma |
| No integration tests for API auth boundaries | HIGH | Zero coverage for scoping |
| Email route without tenantId: no scoping | MEDIUM | Can send to any address |
| Legal review queue: null candidateTenantId visible cross-org | MEDIUM | Needs org filter |

## Top 5 Next Priorities
1. Collections status unification (pick one canonical set, update both pages)
2. Transaction-wrap tenant PATCH and payment creation
3. Add Zod validation to all Projects module endpoints
4. Integration tests for auth/scoping boundaries (at minimum: tenants, buildings, projects)
5. ESLint baseline configuration to catch `any` types incrementally

## Deployment
**Deployed: YES**
Production: https://www.myatlaspm.com
