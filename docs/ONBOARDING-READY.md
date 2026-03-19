# AtlasPM — Onboarding Ready Checklist

## Status: Ready for internal onboarding

## What was completed
- Waves 1–5 complete and deployed
- 99 tests passing
- 6/7 bugs fixed (Bug 6 being fixed in parallel)
- Demo seed available: npm run seed:demo
- Demo reset available: npm run reset:demo
- Demo walkthrough: docs/DEMO-WALKTHROUGH.md
- Client onboarding guide: docs/CLIENT-ONBOARDING.md

## Before importing real data
- [ ] Confirm Bug 6 fix is merged and deployed
- [ ] Run npm run reset:demo on production
- [ ] Verify admin login works at myatlaspm.com
- [ ] Verify onboarding wizard triggers on fresh login

## Onboarding order
1. Import Yardi rent roll (buildings + units + tenants)
2. Run HPD violation sync
3. Create 5 portfolio owner logins
4. Create 3 property manager logins
5. Assign buildings to each owner
6. Verify org scoping — each owner sees only their portfolio
7. Hand logins to employees — watch for friction

## Credentials (change after first login)
- Admin: username=admin / password=IcerTracker2026!
- Demo seed users: see prisma/seed-demo.ts
