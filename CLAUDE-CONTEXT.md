# AtlasPM — Claude Session Context
# Read this at the start of every session

## Project
- **Name:** AtlasPM — NYC property management SaaS platform
- **Production:** https://www.myatlaspm.com
- **Repo path:** /Users/omri/atlaspm (macOS) or C:/Users/omrid/Documents/icertracker (Windows)
- **Stack:** Next.js 14, TypeScript, Prisma, PostgreSQL (Supabase), NextAuth, Zustand, TanStack React Query
- **Deploy:** `npm run deploy` (Vercel, token in .env.local)
- **Typecheck:** `npm run typecheck`
- **Tests:** `npm test` (vitest, 44 tests across 3 files)
- **DB credentials:** stored in `.env.local` — never commit these

## Current State (March 16, 2026)
- **Score:** 7.5/10 (up from 5.5 after remediation)
- **Tests:** 44/44 passing
- **Build:** clean, zero type errors
- **All 21 pages return 200**

## Page Routes (all working)
| Route | Page | Notes |
|-------|------|-------|
| `/` | Command Center | Main dashboard with KPIs, signals, building table |
| `/daily` | Daily Briefing | Morning command center — KPIs, alerts, 3 columns |
| `/daily-briefing` | Redirect → `/daily` | Alias |
| `/owner-dashboard` | Owner View | Portfolio dashboard for building owners |
| `/owner-view` | Redirect → `/owner-dashboard` | Alias |
| `/alerts` | Arrears Alerts | Tenants in arrears, filterable |
| `/collections` | Collections | AR aging, status pipeline, send-to-legal |
| `/collections/[tenantId]` | Collection Detail | Individual tenant collection profile |
| `/vacancies` | Vacancies | Unified vacancy + turnover command center |
| `/leases` | Leases | Lease expiration tracking |
| `/maintenance` | Work Orders | Full CRUD, comments, activity, bulk actions |
| `/work-orders` | Redirect → `/maintenance` | Alias |
| `/projects` | Projects | Project tracker with milestones, budget, WO linking |
| `/themis` | Themis | AI intake → draft → verify → promote to WO |
| `/coeus` | Coeus | Operational signals intelligence |
| `/utilities` | Utilities | Meter/account/check tracking |
| `/compliance` | Compliance | Compliance items, generation templates |
| `/legal` | Legal Cases | Case tracking, court dates, attorney management |
| `/reports` | Reports | Export/reporting |
| `/data` | Data Management | Import workflows (rent roll, AR aging, legal, buildings) |
| `/users` | Users | User management, role assignment, building access |

## Key Files
| Purpose | Path |
|---------|------|
| Prisma schema (~48 models) | `prisma/schema.prisma` |
| Auth config (NextAuth) | `src/lib/auth.ts` |
| API auth wrapper | `src/lib/api-helpers.ts` |
| Data scoping (authorization) | `src/lib/data-scope.ts` |
| Zod validation schemas | `src/lib/validations.ts` |
| Sidebar navigation | `src/components/layout/sidebar.tsx` |
| Types & permissions | `src/types/index.ts` |
| Zustand store | `src/stores/app-store.ts` |
| All hooks | `src/hooks/` (18 files) |
| All API routes | `src/app/api/` (~107 route files) |
| Audit report | `CODE-REVIEW-SECOND-PASS.md` |
| Deployment report | `DEPLOYMENT-REPORT.md` |
| Backfill scripts | `scripts/backfill-vacant-since.ts`, `scripts/seed-projects.ts` |

## Architecture Patterns
- **Pages:** `src/app/(dashboard)/{feature}/page.tsx` → renders `{feature}-content.tsx`
- **API routes:** `withAuth(handler, "permission")` + scope helpers (`getBuildingScope`, `getTenantScope`)
- **Hooks:** `src/hooks/use-{entity}.ts` wrapping TanStack React Query
- **Roles:** SUPER_ADMIN, ADMIN, ACCOUNT_ADMIN, PM, APM, COLLECTOR, OWNER, LEASING_SPECIALIST, BROKER, SUPER, ACCOUNTING, LEASING_AGENT
- **Scoping:** SUPER_ADMIN sees all orgs. ADMIN/ACCOUNT_ADMIN see their org. Others see assigned buildings only.

## Top 5 Priorities for Next Session
1. **Collections status unification** — list page and detail page use completely different status enums
2. **Transaction-wrap tenant PATCH and payment creation** — dual-writes can drift on failure
3. **Add Zod validation to Projects module** — 7 endpoints accept raw `req.json()`
4. **Integration tests for auth/scoping boundaries** — zero coverage currently
5. **ESLint baseline** — catch `any` types incrementally

## What Was Fixed in Last Session
- Security: reset-admin backdoor deleted, cross-org leaks fixed (geocode, Themis promote, Projects POST)
- Legal import wrapped in prisma.$transaction
- Tenant request portal: token from URL params
- parseBody returns 400 with Zod details (was 500)
- withAuth uses structured Pino logger (was console.error)
- Collections isLoading bug fixed (&&→||)
- Import invalidation query keys corrected
- sendToLegal invalidates legal queries
- Themis error feedback (6 silent catches → toast.error)
- Header unit count dynamic (was hardcoded "921")
- ScoreGauge layout fixed
- Vacancy lifecycle: vacantSince/readyDate auto-populate + admin override + backfill (297 units)

## How to Start a Session
1. Read this file and `CLAUDE.md`
2. Run: `npm run typecheck` (should pass clean)
3. Run: `npm test` (should be 44/44)
4. Check: `git log --oneline -5`
5. Pick up from the top priorities list above
