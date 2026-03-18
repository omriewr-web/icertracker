# AtlasPM — Master Tracker
*Claude Code updates this file at the end of every prompt. Never edit manually.*

---

## Last Updated
- Date: 2026-03-18
- Session: Operation Client Ready

---

## 🎯 End Goal
Internal rollout on real 1,200-unit portfolio across 5 portfolios.
Treat as client zero — full onboarding experience, no shortcuts.

---

## PHASE 1: Operation Client Ready

### Wave Status
| Wave | Name | Status | Tasks |
|------|------|--------|-------|
| Wave 1 | Data Trust | ✅ Complete | 4/4 |
| Wave 2 | Security | ✅ Complete | 4/4 |
| Wave 3 | Product Refinement | ✅ Complete | 6/6 |
| Wave 4 | Workflow Tests | 🔴 In Progress | 0/4 |
| Wave 5 | Demo Readiness | 🔴 In Progress | 0/3 |

### Wave 4 Tasks
- [ ] W4-A: Collections workflow tests
- [ ] W4-B: Import workflow tests
- [ ] W4-C: Vacancy lifecycle tests
- [ ] W4-D: Owner data visibility tests

### Wave 5 Tasks
- [ ] W5-A: Realistic portfolio seed (5 portfolios, ~1,200 units)
- [ ] W5-B: Demo walkthrough path (15-minute script)
- [ ] W5-C: README + client onboarding guide

---

## PHASE 2: Codex Bug Fixes
| # | Description | Status | Notes |
|---|-------------|--------|-------|
| 1 | Owner data leak | ✅ Fixed | Blocked OWNER on 5 tenant-level collections GET routes |
| 2 | Org scoping fail-closed | ✅ Verified OK | getBuildingScope returns EMPTY_SCOPE for no-assignment users |
| 3 | Owner dashboard violations column | ✅ Fixed | W3-E — now shows real violation count |
| 4 | Building legal count display | ✅ Fixed | W3-E — legalCaseCount no longer hardcoded to 0 |
| 5 | Owner routes leak into /data pages | ✅ Fixed | Middleware blocks OWNER from /data, /collections, /alerts, /users, /settings |
| 6 | Collections status vocabulary drift | 🟡 Confirmed present | Tracked as W1-C — String field, no DB constraint violations |
| 7 | Public request honeypot not working | ✅ Fixed | Form now reads honeypot from DOM and sends in POST body |

---

## PHASE 3: Pre-Onboarding Reset
- [ ] Build `npm run reset:demo` script
- [ ] Archive all seed data, preserve admin user only
- [ ] Verify onboarding wizard triggers fresh

---

## PHASE 4: Internal Onboarding (Client Zero)
- [ ] Import real Yardi rent roll (1,200 units)
- [ ] Sync real HPD violations
- [ ] Set up 5 portfolio owner logins (one per asset manager)
- [ ] Set up 3 property manager logins
- [ ] Verify org scoping per portfolio — no cross-portfolio data leaks
- [ ] Run with employees for 2 weeks
- [ ] Collect feedback, fix friction points

---

## PHASE 5: Post-Rollout Backlog
- [ ] Atlas Communicate — AI tenant outreach (Twilio + SendGrid)
- [ ] Legal module — auto-generated NYC Housing Court forms
- [ ] GitHub Actions CI/CD
- [ ] ActivityLog model — intelligence layer foundation
- [ ] External client onboarding (Phase 2 SaaS)

---

## Active Terminals
| Terminal | Task | Status |
|----------|------|--------|
| T1 | Codex bug fixes | ✅ Complete (Bugs 1, 5, 7 fixed; 2, 6 verified) |
| T2 | Wave 4 workflow tests | 🔴 Not started |
| T3 | Wave 5 demo seed + docs | 🔴 Not started |

---

## Known Issues / Watch List
- legalRent null on units — must be populated in seed (breaks Lost Rent calc)
- Prisma Decimal serialization inconsistency across endpoints
- Yardi import: 2-row merged header diagnosed, fix not confirmed
- Reset script not yet built (needed before real onboarding)
- Collections status vocabulary drift (W1-C) — UI and schema comment use different values
- seed-demo.ts has pre-existing TS error (buildingId_externalId_source not in ViolationWhereUniqueInput)

---

## Recently Completed
- 2026-03-18: Waves 1-3 complete and deployed
- 2026-03-18: Bug fixes — Owner data leak (Bug 1), Owner nav leak (Bug 5), Honeypot (Bug 7)
- 2026-03-18: Verified — Org scoping fail-closed (Bug 2), Status drift confirmed (Bug 6)
- 2026-03-18: TRACKER.md created

---

## Rules (from CLAUDE.md)
- Read before writing always
- No ts-ignore or any suppressions
- Prisma transactions for all multi-step writes
- Org scoping from session, never request body
- npx tsc --noEmit after every task
- Commit after each task with descriptive message
- Update docs/TRACKER.md at the end of every prompt
