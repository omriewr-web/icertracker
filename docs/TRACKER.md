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
| Wave 4 | Workflow Tests | ✅ Complete | 4/4 — 99 tests passing |
| Wave 5 | Demo Readiness | ✅ Complete | 3/3 |

### Wave 4 Tasks
- [x] W4-A: Collections workflow tests
- [x] W4-B: Import workflow tests
- [x] W4-C: Vacancy lifecycle tests
- [x] W4-D: Owner data visibility tests

### Wave 5 Tasks
- [x] W5-A: Realistic portfolio seed (5 portfolios, ~1,200 units)
- [x] W5-B: Demo walkthrough path (15-minute script)
- [x] W5-C: README + client onboarding guide

---

## PHASE 2: Codex Bug Fixes
| # | Description | Status | Notes |
|---|-------------|--------|-------|
| 1 | Owner data leak | ✅ Fixed | commit ebfe048 — Blocked OWNER on 5 tenant-level collections GET routes |
| 2 | Org scoping fail-closed | ✅ Verified OK | No fix needed — getBuildingScope returns EMPTY_SCOPE correctly |
| 3 | Owner dashboard violations column | ✅ Fixed | W3-E — now shows real violation count |
| 4 | Building legal count display | ✅ Fixed | W3-E — legalCaseCount no longer hardcoded to 0 |
| 5 | Owner routes leak into /data pages | ✅ Fixed | commit b44c562 — Middleware blocks OWNER from /data, /collections, /alerts, /users, /settings |
| 6 | Collections status vocabulary drift | ⚠️ Confirmed open | Severe — UI, DB, and statuses.ts out of sync. Must fix before real onboarding |
| 7 | Public request honeypot not working | ✅ Fixed | commit d306999 — Form now reads honeypot from DOM and sends in POST body |

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
| T1 | Codex bug fixes | ✅ Complete — Bugs 1, 5, 7 fixed; Bug 2 verified; Bug 6 deferred |
| T2 | Wave 4 workflow tests | ✅ Complete — 99 tests passing across W4-A, W4-B, W4-C, W4-D |
| T3 | Wave 5 demo seed + docs | ✅ Complete — seed-demo.ts, DEMO-WALKTHROUGH.md, README.md, CLIENT-ONBOARDING.md |

---

## Known Issues / Watch List
- legalRent null on units — must be populated in seed (breaks Lost Rent calc)
- Prisma Decimal serialization inconsistency across endpoints
- Yardi import: 2-row merged header diagnosed, fix not confirmed
- Reset script not yet built (needed before real onboarding)
- seed-demo.ts line 270: ViolationWhereUniqueInput field name mismatch — TS error, needs fix
- Collections status vocabulary drift (Bug 6): UI, DB, and statuses.ts out of sync — must resolve before Yardi import

## Next Up
1. Fix Bug 6 — collections status vocabulary drift
2. Fix seed-demo.ts TypeScript error line 270
3. Build `npm run reset:demo` script
4. Deploy + run reset
5. Onboard real portfolio as client zero

---

## Recently Completed
- 2026-03-18: All 5 waves complete
- 2026-03-18: 99 tests passing (W4 full suite)
- 2026-03-18: Demo seed, walkthrough, README, onboarding guide created
- 2026-03-18: Bugs 1, 5, 7 fixed and deployed
- 2026-03-18: Bug 2 verified OK, Bug 6 confirmed open and deferred
- 2026-03-18: TRACKER.md created and synced to completion state

---

## Rules (from CLAUDE.md)
- Read before writing always
- No ts-ignore or any suppressions
- Prisma transactions for all multi-step writes
- Org scoping from session, never request body
- npx tsc --noEmit after every task
- Commit after each task with descriptive message
- Update docs/TRACKER.md at the end of every prompt
