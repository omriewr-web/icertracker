# AtlasPM

A comprehensive web-based property management and rent collection tracking application.

## Features

- **Dashboard** — Portfolio-wide KPIs: occupancy, total arrears, collection rates
- **Daily Summary** — What needs attention today (overdue, expiring leases, follow-ups)
- **Arrears Alerts** — Tenants with outstanding balances categorized by severity (30/60/90+ days)
- **Legal Cases** — Manual legal case pipeline with 9 stages (Notice → Eviction → Settled)
- **Vacancies** — Vacant unit tracking with lost rent calculations
- **Lease Management** — Lease expiration tracking and renewal alerts
- **Payment Tracking** — Log payments with date, amount, method, and notes
- **Collection Notes** — 6 note categories (Phone Call, Payment Promise, Letter Sent, Door Knock, Email/Text, Other)
- **PDF Reports** — Generate collection reports with tenant details and notes
- **Excel Export** — Export filtered tenant data to spreadsheet
- **Bulk Actions** — Select multiple tenants for batch operations
- **Advanced Filters** — Filter by arrears, lease status, balance range, property

## Tech Stack

- Next.js 14 (App Router)
- PostgreSQL via Supabase + Prisma ORM
- Tailwind CSS
- NextAuth.js (credentials)
- React Query + Zustand
- Recharts for analytics
- SheetJS (XLSX) for Excel import/export

## Getting Started

```bash
npm install
npm run dev
```

## License

Proprietary
