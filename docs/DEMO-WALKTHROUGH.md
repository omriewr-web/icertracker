# AtlasPM Demo Walkthrough

**Duration:** 15 minutes
**Audience:** NYC property managers and landlords
**Seed data required:** Run `npm run seed:demo` first

---

## Setup

1. Ensure demo data is seeded: `npm run seed:demo`
2. Open https://www.myatlaspm.com (or localhost:3000)
3. Have two browser tabs ready — one for admin, one for owner

---

## Act 1: The Hook (3 min)

1. Log in as `demo-admin` / `demo1234`
2. Land on **Portfolio Overview** — point out KPI cards: total units, occupancy, total AR balance, lost rent
3. Scroll to the **Active Signals** banner — click through to the Signals page
4. Show the signal severity breakdown — "This is your morning briefing, every day"
5. Navigate to **Daily Briefing** — show the summary: urgent tenants, follow-ups due, legal dates

## Act 2: Collections (4 min)

6. Navigate to **Collections** — show the AR pipeline with tenant scores
7. Sort by collection score descending — Tyrone Jackson (score: 92) surfaces first
8. Click into Jackson's profile — show $12,500 balance, 145 days late, legal case active
9. Show the collection notes timeline — demand notice sent, voicemail, escalation
10. Point out the AI recommendation button — "It suggests next steps based on the profile"
11. Go back to the table — show Rosa Gutierrez (score: 40) — partial payment recorded, follow-up scheduled

## Act 3: Violations & Compliance (3 min)

12. Navigate to **Compliance** → Violations tab
13. Filter to 2376 Hoffman Street — 7 open violations appear
14. Point out Class C violations flagged in red — smoke detector, no hot water, roach infestation
15. Show the respond-by dates and penalty amounts
16. Click a Class C violation — show the detail panel with NOV description
17. Point out the "Create WO" button — "One click to dispatch maintenance"

## Act 4: Work Orders (2 min)

18. Navigate to **Work Orders** — show the kanban board view
19. Point out the urgent boiler repair linked to HPD violation
20. Click it — show the violation linkage, assignee, due date
21. Toggle to list view — show filtering by priority and status

## Act 5: Owner Portal (2 min)

22. Open the second browser tab — log in as `demo-owner` / `demo1234`
23. Owner lands on **Owner Dashboard** — restricted view, no tenant PII
24. Show: building-level metrics, occupancy, AR summary, open violations count
25. "Owners see what you want them to see — full transparency, no noise"

## Act 6: Close (1 min)

26. Back in admin tab — navigate to **Data Management** → Import tab
27. Show the 8 import card types — "Day 1, you upload your Yardi export and you're live"
28. Download a template to show the format — "We auto-detect Yardi, AppFolio, and DHCR"
29. Close: "This is AtlasPM — your entire portfolio, one dashboard, 30-minute setup"

---

## Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `demo-admin` | `demo1234` |
| Property Manager | `demo-pm` | `demo1234` |
| Collector | `demo-collector` | `demo1234` |
| Owner | `demo-owner` | `demo1234` |
