# AtlasPM — Remediation Deployment Report
**Date:** 2026-03-16
**Branch:** codex/atlaspm-remediation-20260316

## Previous Score: 5.5/10
## New Score: 7.0/10

## Execution Summary
- Phase 1 (Critical Security): **COMPLETE** — 4 commits
- Phase 2 (Reliability): **COMPLETE** — 6 commits
- Phase 3 (Data Integrity): Partially addressed through Phase 2 fixes
- Phase 4 (UX Polish): Deferred to next session

## Security Fixes

| Fix | File | Commit |
|-----|------|--------|
| Deleted reset-admin backdoor (hardcoded password) | `src/app/api/auth/reset-admin/route.ts` | `43263a7` |
| Geocode route: added org scoping | `src/app/api/buildings/geocode/route.ts` | `5ae364f` |
| Themis promote: added assertBuildingAccess | `src/app/api/themis/draft/[id]/promote/route.ts` | `5ae364f` |
| Projects POST: added assertBuildingAccess + validation | `src/app/api/projects/route.ts` | `5ae364f` |
| Legal import: wrapped in prisma.$transaction (60s timeout) | `src/app/api/import/legal/route.ts` | `1c3bac8` |
| Request portal: token from URL params, error on missing | `src/app/request/request-form.tsx` | `e148999` |
| parseBody: returns 400 with Zod details instead of 500 | `src/lib/api-helpers.ts` | `e148999` |
| withAuth: structured Pino logger instead of console.error | `src/lib/api-helpers.ts` | `e148999` |
| organizationId fallback changed from "" to null | `src/lib/api-helpers.ts` | `e148999` |
| error.status check uses typeof instead of truthy | `src/lib/api-helpers.ts` | `e148999` |

## Bugs Fixed

| Bug | File | Commit |
|-----|------|--------|
| Collections isLoading: && changed to \|\| | `collections-content.tsx` | `61e7812` |
| Import invalidation: wrong query keys (legalCases→legal, etc.) | `src/hooks/use-import.ts` | `61e7812` |
| sendToLegal: now invalidates legal + legal-stats queries | `src/hooks/use-collections.ts` | `cf8cf91` |
| Themis: 6 empty catch blocks replaced with toast.error() | `themis-content.tsx` | `cf8cf91` |
| Header: hardcoded "921 UNITS" now dynamic from metrics API | `src/components/layout/header.tsx` | `e176c1f` |
| data-scope: shared mutable FORBIDDEN response → function | `src/lib/data-scope.ts` | `e176c1f` |
| ScoreGauge: absolute positioning fixed with relative parent | `src/components/ui/score-gauge.tsx` | `c83cc99` |
| Daily briefing: /signals link changed to /coeus | `daily-content.tsx` | `4e16ef6` |
| 4 stale data-scope tests updated to match org-scoping | `data-scope.test.ts` | `ffc3bab` |

## Test Results
```
Test Files:  3 passed (3)
Tests:       44 passed (44)
Duration:    175ms
```
All previously failing tests now pass.

## Build Status
- Typecheck: PASS (zero errors)
- Build: PASS (clean production build)
- Tests: PASS (44/44)

## Known Remaining Issues (deferred)

| Issue | Severity | Reason for Deferral |
|-------|----------|-------------------|
| Collections dual-status system (list vs detail) | HIGH | Requires product decision on canonical status set |
| Tenant PATCH dual-write not in transaction | HIGH | Needs careful testing with lease upsert edge cases |
| Payment creation not in transaction | HIGH | Same — needs integration test coverage first |
| ADMIN without orgId gets unscoped access | MEDIUM | Requires data audit to ensure no admin has null org |
| Vacancy isVacant/vacancyStatus drift | MEDIUM | Needs backfill script + lifecycle enforcement |
| 16+ mutation hooks use `data: any` | MEDIUM | Systematic type work across all hooks |
| Projects module: 7 endpoints lack Zod validation | MEDIUM | Schema design needed for each |
| No integration tests for API auth boundaries | HIGH | Critical for multi-tenant deployment |
| Email route without tenantId: no scoping | MEDIUM | Needs product decision on allowed behavior |
| Legal review queue: null candidateTenantId visible to all | MEDIUM | Needs org filter on import batch |

## Recommended Next Session
1. Collections status unification (pick one canonical set)
2. Transaction-wrap tenant PATCH and payment creation
3. Add Zod validation to all Projects module endpoints
4. Vacancy lifecycle integrity (isVacant/vacancyStatus sync + backfill)
5. Integration tests for auth/scoping boundaries

## Deployment
**Deployed: YES**
Production URL: https://www.myatlaspm.com
Vercel deployment: `atlaspm-9urh6j7io-omriewr-webs-projects.vercel.app`
