# Wave 5 Report — Demo and Rollout Readiness

**Date:** 2026-03-18
**Status:** Complete

---

## W5-A: Realistic Demo Seed

**File:** `prisma/seed-demo.ts`
**Script:** `npm run seed:demo`
**Status:** Runs without errors, idempotent (safe to re-run)

### Demo Portfolio

| Building | Address | Profile | Units | Tenants |
|----------|---------|---------|-------|---------|
| Clean | 600 Edgecombe Ave, Manhattan | Well-managed, minimal issues | 6 | 6 |
| Violations | 2376 Hoffman St, Bronx | 7 HPD violations (3x Class C, 4x Class B) | 8 | 7 (+1 vacant) |
| Collections | 1515 Grand Concourse, Bronx | Deep arrears, 2 legal cases | 6 | 6 |

### Tenant Arrears Distribution

| Category | Count | Examples |
|----------|-------|---------|
| Current | 10 | Torres, Okafor, Santos, Kim, etc. |
| 30 days | 3 | Nguyen ($1,550), Tanaka ($1,500), Obi ($1,250) |
| 60 days | 2 | Washington ($2,560), Gutierrez ($3,100) |
| 90 days | 2 | Volkov ($7,200), M. Petrov ($4,800) |
| 120+ days | 1 | Jackson ($12,500, score: 92) |

### Legal Cases

| Tenant | Stage | Balance | Court Date |
|--------|-------|---------|-----------|
| Tyrone Jackson | NONPAYMENT | $12,500 | 14 days from seed |
| Svetlana Volkov | STIPULATION | $7,200 | 10 days ago |

### Work Orders

| Title | Priority | Status | Violation-linked |
|-------|----------|--------|-----------------|
| Boiler repair — no hot water | URGENT | IN_PROGRESS | Yes (Class C) |
| Leaking kitchen faucet | LOW | OPEN | No |
| Pest treatment | HIGH | OPEN | Yes (Class C) |
| Hallway light replacement | MEDIUM | COMPLETED | No |

### Users

| Role | Username | Password |
|------|----------|----------|
| Admin | demo-admin | demo1234 |
| PM | demo-pm | demo1234 |
| Collector | demo-collector | demo1234 |
| Owner | demo-owner | demo1234 |

---

## W5-B: Demo Walkthrough

**File:** `docs/DEMO-WALKTHROUGH.md`

15-minute, 6-act structure with 29 steps:
1. The Hook — Portfolio Overview + Daily Briefing
2. Collections — scoring, AI recommendations, tenant profiles
3. Violations — HPD sync, Class C flags, one-click work order dispatch
4. Work Orders — kanban view, violation linkage
5. Owner Portal — restricted dashboard view
6. Close — data import, 30-minute setup promise

---

## W5-C: README + Client Onboarding

**Files:**
- `README.md` — product description, features, setup, demo credentials
- `docs/CLIENT-ONBOARDING.md` — day-1 checklist, Yardi import, HPD sync, user setup, ongoing workflow

---

## Commits

1. `docs: W5-A complete — realistic demo seed`
2. `docs: W5-B complete — 15-minute demo walkthrough`
3. `docs: W5-C complete — README + client onboarding guide`

## TypeScript

`npx tsc --noEmit` — 0 errors
