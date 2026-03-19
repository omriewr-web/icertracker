# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AtlasPM** — a property management portfolio visibility platform for NYC landlords/managers. Sits on top of accounting systems (Yardi/AppFolio); not an accounting system itself. Core metric: Revenue at Risk = Vacancy Loss + Arrears.

## Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # ESLint
npm run typecheck        # TypeScript type checking (tsc --noEmit)
npm run db:push          # Push schema changes to database
npm run db:migrate       # Run Prisma migrations
npm run db:seed          # Seed database (tsx prisma/seed.ts)
npm run db:studio        # Open Prisma Studio GUI
npm run db:generate      # Regenerate Prisma client
```

## Tech Stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript
- **Database:** PostgreSQL (Supabase) via Prisma ORM
- **Auth:** NextAuth with credentials provider, JWT sessions (24h), role-based access
- **State:** Zustand (single store in `src/stores/app-store.ts`) for UI state; TanStack React Query for server state
- **Styling:** Tailwind CSS with dark theme (see UI/Design Standards below), fonts: DM Sans / Bebas Neue / JetBrains Mono
- **Validation:** Zod schemas in `src/lib/validations.ts`
- **Path alias:** `@/*` → `./src/*`

## Architecture

### Source Structure

```
src/
├── app/(auth)/           # Login page
├── app/(dashboard)/      # All dashboard routes (alerts, compliance, daily, data, leases, legal, maintenance, reports, users, vacancies)
├── app/api/              # ~44 REST API route handlers
├── components/ui/        # Reusable UI primitives (data-table, modal, button, stat-card, etc.)
├── components/{domain}/  # Domain-specific components (building/, tenant/, legal/, compliance/, maintenance/, ai/)
├── components/layout/    # Header, sidebar, global-modals
├── hooks/                # 18 React Query hooks (use-{entity}.ts pattern)
├── lib/                  # Utilities, middleware, validation, data integrations
├── stores/               # Zustand store
└── types/                # TypeScript type definitions
```

### API Route Pattern

All API routes use `withAuth` middleware with permission strings. Authorization is scope-based via `src/lib/data-scope.ts`:

```typescript
export const GET = withAuth(async (req, { user }) => {
  const scope = getBuildingScope(user, buildingId);
  if (scope === EMPTY_SCOPE) return NextResponse.json([]);
  const data = await prisma.model.findMany({ where: { ...scope } });
  return NextResponse.json(data);
}, "permission-name");
```

- **ADMIN** sees all data; non-admins see only their assigned buildings
- Scope helpers: `getBuildingScope()`, `getTenantScope()`, `assertBuildingAccess()`, `assertTenantAccess()`
- Default-deny: users with no property assignments see nothing

### Data Fetching Pattern

Custom hooks in `src/hooks/` wrap React Query. Queries key on `["entity", selectedBuildingId, ...filters]`. Mutations invalidate relevant query keys and show toast notifications.

### Page Pattern

Dashboard pages at `src/app/(dashboard)/{feature}/page.tsx` render a corresponding `src/components/{domain}/{feature}-content.tsx` component that manages hooks, loading states, and child components.

### User Roles

`ADMIN | PM | COLLECTOR | OWNER | BROKER` — defined as Prisma enum, extended into NextAuth session.

## Core Architecture Rules

DO NOT build disconnected feature modules. Build around shared core entities that link to each other.

**Core entities:** Organization, Owner, Building, Unit, Tenant/Resident, User/Staff, Vendor/Broker/Attorney

Every operational record (Vacancy, CollectionCase, LegalCase, Violation, WorkOrder, Inspection, MoveOutAssessment) MUST link to:
- building
- unit (where applicable)
- tenant (where applicable)
- assigned user (where applicable)

**Shared ActivityEvent model** is required so all modules feed into building history, unit history, tenant history, owner dashboard, and portfolio recent activity.

**Work orders** must support source relationships: `created_from: inspection | violation | vacancy_turnover | move_out`

Never create isolated modules that cannot relate to each other.

## UI/Design Standards

### Color Palette
- **Primary:** Navy `#0a1628` (backgrounds), Gold `#c9a84c` (accents, CTAs, active states)
- **Status only:** Red `#e05c5c` (critical alerts only), Amber `#e09a3e` (warnings), Green `#4caf82` (success)
- Do not introduce other colors outside this palette

### Typography
- **DM Sans** for body text and UI labels
- **Bebas Neue** for large numbers, KPI values, and section headings
- **JetBrains Mono** for code/data where monospace is needed

### Tables & Data Display
- Alternating row shading on all tables
- Sticky column headers when scrolling
- No flashy animations on data tables — subtle transitions only (opacity, short fades)
- High data density — minimize whitespace, maximize visible information per screen

### Building References
- Always show the street address as the primary building identifier, never the entity/internal name

### Target Users
- Property managers aged 40–65 — prioritize high contrast, large tap targets, legible type sizes
- Mobile readable — managers check dashboards on phones, ensure responsive layouts work at small widths

### Empty States
- Always show an icon + helpful message describing what would appear and how to get started
- Never leave blank space with no explanation

## Database Notes

- Schema has ~48 models in `prisma/schema.prisma`
- The `Tenant` model is known to be overloaded (identity + lease terms + financial state) — see `docs/architecture-review.md`
- The `Building` model has 47+ scalar fields plus JSON fields (`lifeSafety`, `elevatorInfo`, etc.) undergoing normalization
- `scripts/reset-tenants.ts` provides ordered deletion for dev/test cleanup

## Key Libraries

- `src/lib/data-scope.ts` — Authorization scoping (critical for all API routes)
- `src/lib/api-helpers.ts` — `withAuth()` middleware, `parseBody()`, error handling
- `src/lib/validations.ts` — 26+ Zod schemas for request validation
- `src/lib/excel-import.ts` — Format detection and parsing for Excel imports (Yardi, Atlas)
- `src/lib/building-matching.ts` — Address normalization and building deduplication
- `src/lib/violation-sync.ts` / `src/lib/nyc-open-data.ts` — NYC Open Data API integration (HPD, DOB, DHCR)
- `src/lib/compliance-templates.ts` — Compliance requirement presets
- `src/lib/email-templates.ts` — HTML email templates via Resend

---

## Operation: Client Ready — Wave Plan
Last Updated: 2026-03-18
Goal: AtlasPM goes from demo-ready to pilot-ready by hardening and refining what already exists.
No new modules. No speculative features. Improve only the current product.

### WAVE 1 — Data Trust
- W1-A: Payments cascade fix
  Create recalculateTenantBalance() as the canonical balance update path.
  Use it from manual payment entry and import flows.
- W1-B: Vacancy state consolidation
  Make Unit the source of truth for vacancy state.
  Create syncVacancyState() and route all vacancy writes through it.
- W1-C: Status vocabulary normalization
  Centralize app-layer status labels and mappings in src/lib/constants/statuses.ts.
  Do not create duplicate business logic outside that file.
- W1-D: Missing DB indexes
  Add only justified indexes for current query patterns:
  Unit, ProjectMilestone, CronLog, ImportLog, Violation, WorkOrder.

### WAVE 2 — Security Hardening
- W2-A: Org scoping gap fix — remove all orgless fallback to broad queries.
- W2-B: Auth rate limiting — replace in-memory login throttling with a durable/shared mechanism.
- W2-C: Write route validation sweep — all write routes must use Zod-backed validation through shared helpers.
- W2-D: Import hardening sweep — standardize file validation, row limits, parse safety, and error shape across all import endpoints.

### WAVE 3 — Product Refinement
- W3-A: Consolidate Owner Dashboard and Owner Portal into one clear owner experience.
- W3-B: Internal naming cleanup in UI only — replace internal mythology labels with plain English in visible UI.
- W3-C: Empty-state and loading-state audit across existing pages.
- W3-D: Redirect and alias cleanup across existing pages.
- W3-E: Refine existing dashboard metrics only if data already exists. No new backend feature creation.
- W3-F: Sentry configuration fix.

### WAVE 4 — Workflow Tests
- W4-A: Collections workflow tests.
- W4-B: Import workflow tests.
- W4-C: Vacancy lifecycle tests.
- W4-D: Owner data visibility tests.

### WAVE 5 — Demo and Rollout Readiness
- W5-A: Improve existing seed/demo data only.
- W5-B: Define a clean walkthrough path using existing screens.
- W5-C: README and onboarding guide for current product only.

### KEY ARCHITECTURE DECISIONS
- Payments come primarily from Yardi/AppFolio uploads, not manual entry.
- Future API ingestion should plug into the same balance-update path with minimal code change.
- Unit is the single source of truth for vacancy state.
- App-layer statuses are centralized in src/lib/constants/statuses.ts.
- recalculateTenantBalance() is the canonical function for balance updates.
- syncVacancyState() is the canonical function for vacancy updates.

### RULES FOR ALL WAVES
- Read before writing. Always.
- Do not add new product surfaces, modules, or speculative capabilities.
- Perfect existing workflows before extending anything.
- No new ts-ignore or suppression comments.
- Reduce loose typing where touched — do not expand it.
- Reuse existing patterns. Do not duplicate logic.
- Use Prisma transactions for every multi-step write.
- Apply org scoping from session context, never from request body.
- Run npx tsc --noEmit after every task.
- Run relevant tests after every task.
- Deploy only after a full wave passes typecheck, tests, and build.
- Commit after each task with a descriptive message.
