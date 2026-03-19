# AtlasPM — Technical Deep Dive

Date: March 18, 2026
Scope: Current working tree in `/Users/omri/atlaspm`, not just the last clean commit. This audit included `.env.local`, `prisma/schema.prisma`, `package.json`, `tsconfig.json`, `next.config.js`, `middleware.ts`, the full `src/app/api` tree, dashboard pages, hooks, services, components, and seed/deploy scripts.

## Executive technical snapshot

### Verification status
- `npm test`: pass (`44/44`)
- `npx tsc --noEmit --pretty false`: pass
- `npm run build`: pass

### Codebase scale reviewed
- API route handlers: 122
- App pages: 34
- Hooks: 26
- Service modules: 10
- UI components: 85
- Test files: 3

### Overall technical assessment
AtlasPM is a serious Next.js application, not a prototype. The stack choice is fine. The main risks are not framework-level. They are domain-model drift, uneven route discipline, and operational hardening gaps.

The repo has a real service layer, central auth wrapper, scoping helpers, import logging, React Query-based data fetching, and enough tests/build hygiene to ship. The biggest technical problem is that the product domain has grown faster than the schema and workflow rules have been normalized.

## Architecture overview

### Application structure
- Next.js 14 App Router
- API routes live under `src/app/api`
- UI routes live under `src/app/(dashboard)` and `src/app/request`
- Data access is mostly Prisma through a shared client in `src/lib/prisma.ts`
- Authentication is NextAuth credentials-based via `src/lib/auth.ts`
- Route protection is primarily handled by `withAuth()` in `src/lib/api-helpers.ts`
- Org/building/tenant scoping is centralized in `src/lib/data-scope.ts`
- React Query hooks under `src/hooks` drive most client-side data loading and invalidation
- Domain-heavy logic is partially moved into `src/lib/services`

### Architectural strengths
- There is a recognizable pattern for auth, route wrapping, and Prisma usage.
- The service layer is meaningful in collections, imports, owner dashboards, turnovers, and Themis.
- Data scoping is at least centralized enough to audit.
- Import logging exists and is reused.
- The current code builds, which suggests the system is still being actively maintained.

### Architectural weaknesses
- The repo is running on `main` with a large dirty working tree, which weakens release provenance.
- Some business logic lives cleanly in services, while some still lives directly inside route handlers.
- Status vocabularies drift across modules, especially collections and vacancy workflows.
- Several alias pages exist only to redirect to the “real” page, which is okay operationally but suggests unresolved product structure.

## Database schema assessment

## Overall schema judgment
The schema is ambitious and workable, but it is not cleanly normalized yet.

### What is well designed
- The project system is fairly rich: milestones, change orders, activities, linked work orders, linked violations.
- The legal/compliance/work-order areas have enough relational structure to support real workflows.
- Many core models already have timestamps, ownership, and relationships needed for production reporting.

### Where the schema is weak

#### 1. `Tenant` is still overloaded
`Tenant` holds identity, rent terms, deposit, balance, arrears state, collection score, lease timing, legal state inputs, and import identifiers. That makes it too easy for one workflow to mutate another workflow’s source of truth.

Impact:
- lease history is weak
- balances and lease terms are too tightly mixed
- imports and manual edits can fight each other
- collection and leasing logic depend on the same mutable record

#### 2. Vacancy state is duplicated across multiple models
Vacancy-related information lives in `Unit`, `VacancyInfo`, `Vacancy`, and `TurnoverWorkflow`. The product can present a clean vacancy view, but the schema still allows those states to drift.

#### 3. `Building` still carries legacy JSON blobs
`Building` stores many operational details as JSON blobs (`lifeSafety`, `elevatorInfo`, `boilerInfo`, `complianceDates`, utility JSON, etc.). That is survivable, but it weakens queryability, validation, and migration safety.

#### 4. `yardiResidentId` is globally unique
That is convenient for import matching, but dangerous in a multi-org system. A global unique constraint on an external system ID can create cross-org coupling or collisions.

### Missing or weak indexes
The following indexes still look justified but absent in the current schema:
- `Unit(vacancyStatus)`
- `Unit(buildingId, isVacant)`
- `ProjectMilestone(projectId, status)`
- `CronLog(jobName, status)`
- `ImportLog(organizationId, importType)`

### Schema design verdict
The schema is good enough for internal use and early pilots, but not yet the schema you want to freeze around first-client scale. The next phase should be normalization, not more sprawl.

## Security audit

## What is solid
- The public reset-admin API route is not present in the current `app/api` tree.
- NextAuth handles auth flows instead of a homegrown session system.
- Public maintenance intake requires a building token and has rate limiting plus a honeypot.
- Cron endpoints use a dedicated `CRON_SECRET` wrapper with timing-safe comparison.
- Many protected routes use `withAuth()` consistently.

## Main security and scoping risks

### 1. Admin-without-org behavior is still too broad
`src/lib/data-scope.ts` still allows some full-org roles with no `organizationId` to fall back to broad unscoped queries.

Why it matters:
- if non-super-admin accounts ever exist without an org assignment, cross-org access becomes possible
- several routes trust `getOrgScope()`/`getBuildingScope()` implicitly

### 2. Login throttling is weak for production internet exposure
`src/lib/auth.ts` uses an in-memory `Map` keyed by username. That means rate limiting resets on deploy and does not scale horizontally.

### 3. Some scripts are risky even if they are not shipped APIs
The current working tree includes `scripts/reset-admin.ts`, which contains a hardcoded target email and hardcoded password reset logic. It is not an API route, but it should not be committed or normalized into normal operations.

### 4. Input validation is inconsistent across write routes
A scan of the API tree shows many routes still call `req.json()` directly for write payloads instead of using Zod-backed `parseBody()`. The discipline is much better than before, but not complete.

Examples include project-related link routes and some project mutation routes.

### 5. Spreadsheet import hardening is uneven
Some import routes enforce size and row-count limits, but the overall import surface is still inconsistent about file-type validation and parse containment. `src/lib/importer/parseFile.ts` still calls `XLSX.read()` directly without a local try/catch boundary.

### 6. Logging is mixed
The app has a real logger, but `console.*` is still scattered across services, AI helpers, and import paths. That weakens structured incident diagnosis.

## Security verdict
Reasonable for internal usage. Not yet fully hardened for broad external client exposure without another tightening pass around scoping, imports, and auth rate limiting.

## Code quality assessment

## Strengths
- `strict: true` TypeScript is enabled.
- The repo currently typechecks and builds.
- The `withAuth()` wrapper and `parseBody()` pattern are good foundations.
- The service layer reduces duplicated business logic in some of the hardest parts of the app.

## Weaknesses

### `any` is still widespread
There are many explicit `any` types across pages, hooks, route params, mutation payloads, and service logic. The build passes, but the type surface is looser than it should be.

### Error handling is uneven
Some routes cleanly return structured errors; others rely on thrown exceptions or narrow catches. Some services still swallow errors or log via `console.error`.

### Not enough tests for the riskiest workflows
There are only three test files. Current coverage is concentrated around bootstrap admin logic, data scoping, and one NYC open data utility. There are no meaningful tests for imports, collections status transitions, project health calculations, vacancy lifecycle, or owner data visibility.

### The repo’s state management is operationally messy
The current working tree is already dirty on `main`. That is not a code bug, but it is a delivery and auditing problem.

## Performance risks

### 1. Signals engine does a lot of record-by-record work
`src/lib/signals/engine.ts` runs many broad detection queries and then upserts or updates signals inside loops. It is fine for modest scale, but it will become expensive as portfolios grow.

### 2. Owner summary and some dashboards overfetch
`/api/owner/summary` loads buildings with nested units and tenant data, then calculates aggregates in memory. That works, but it is not especially efficient.

### 3. Some list endpoints have high caps or no real pagination discipline
`/api/legal` returns up to 200 active cases in one go. Other endpoints default to 50 or more. Some pages do extra client-side sorting/filtering after loading a wide dataset.

### 4. Daily and owner dashboards make many parallel client fetches
That is a valid product choice, but it increases the chance of inconsistent partial states and duplicated overfetching.

## What is production-ready today
- App Router structure and deployment packaging
- Basic auth/session flow
- Current build/test/typecheck baseline
- Centralized data-scoping helper layer
- Portfolio dashboards, collections pages, vacancies, work orders, owner views, and imports as real product surfaces
- Tokenized public maintenance intake

## What still needs work before confident external rollout
- normalize tenant/lease/vacancy/collection state ownership
- remove orgless access ambiguity
- improve rate limiting and auth hardening
- standardize write-route validation
- strengthen import safety consistently across all endpoints
- add tests around real business workflows, not just helpers
- clean up logging and script hygiene

## Top 10 technical debt items ranked by risk

1. **Orgless admin scoping fallback**
   - Risk: cross-org data exposure
   - Primary files: `src/lib/data-scope.ts`, many API routes

2. **Overloaded `Tenant` model**
   - Risk: workflow drift across leasing, collections, and imports
   - Primary file: `prisma/schema.prisma`

3. **Vacancy state duplicated across models**
   - Risk: inconsistent UI and wrong operational timing metrics
   - Primary files: `prisma/schema.prisma`, `src/app/api/units/[id]/route.ts`, `src/app/api/vacancies/[unitId]/status/route.ts`, `src/lib/services/turnover.service.ts`

4. **Payments do not cascade balance/arrears updates**
   - Risk: collections dashboards become stale after manual payment entry
   - Primary file: `src/app/api/tenants/[id]/payments/route.ts`

5. **Write routes without strong schema validation**
   - Risk: inconsistent data and brittle clients
   - Primary files: multiple project, link, and import endpoints

6. **Import hardening is uneven**
   - Risk: parser crashes, bad uploads, spreadsheet edge cases
   - Primary files: `src/lib/importer/parseFile.ts`, import routes

7. **Signals engine scales poorly**
   - Risk: background scans get slower as data grows
   - Primary file: `src/lib/signals/engine.ts`

8. **Collection status vocabulary drift**
   - Risk: UI confusion and inconsistent automation logic
   - Primary files: `src/lib/services/collections.service.ts`, `src/lib/collections/types.ts`, dashboard/detail pages

9. **Missing operational indexes**
   - Risk: slower vacancy/project/cron/import queries over time
   - Primary file: `prisma/schema.prisma`

10. **Low workflow test coverage**
    - Risk: regressions in the modules that matter most to paying clients
    - Primary folder: `src/__tests__`

## Bottom line
AtlasPM is technically credible and materially closer to “real product” than “concept app.” The good news is that the stack itself is not the problem. The hard part now is data ownership discipline and operational hardening. If the team narrows focus and normalizes the riskiest workflows, the existing architecture is good enough to carry the product into early customer use.
