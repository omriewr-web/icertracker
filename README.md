# AtlasPM

AtlasPM is a portfolio visibility platform for NYC property managers. It sits on top of accounting systems like Yardi and AppFolio to surface revenue risk, violations, and collections — not replace your back office.

---

## Who it's for

Property managers, landlords, and management companies running 3–300 buildings in New York City.

## Key Features

- **Portfolio Dashboard** — occupancy, arrears, lost rent, and compliance KPIs at a glance
- **Collections Pipeline** — tenant-level scoring, aging buckets, AI-powered next-step recommendations
- **HPD/DOB Violation Sync** — automatic import from NYC Open Data with cure-date tracking
- **Legal Case Tracking** — stage pipeline from demand notice through eviction, court date calendar
- **Work Orders** — kanban + list views, violation-linked dispatch, vendor management
- **Owner Portal** — restricted view for building owners, no tenant PII
- **Data Import** — auto-detects Yardi, AppFolio, DHCR, and ConEd formats; 8 native templates

## Tech Stack

- Next.js 14 (App Router), React 18, TypeScript
- PostgreSQL (Supabase) via Prisma ORM
- NextAuth (credentials), Zustand, TanStack React Query
- Tailwind CSS, Recharts, Lucide icons

## Setup

```bash
# 1. Clone and install
git clone <repo-url> && cd atlaspm
npm install

# 2. Environment
cp .env.example .env.local
# Fill in: DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXTAUTH_URL

# 3. Database
npx prisma db push
npx prisma generate

# 4. Seed demo data (optional)
npm run seed:demo

# 5. Run
npm run dev
# Open http://localhost:3000
```

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection (pooled, port 6543) |
| `DIRECT_URL` | PostgreSQL connection (direct, port 5432) |
| `NEXTAUTH_SECRET` | Random secret for JWT signing |
| `NEXTAUTH_URL` | App URL (http://localhost:3000 for dev) |

## Demo Credentials

After running `npm run seed:demo`:

| Role | Username | Password |
|------|----------|----------|
| Admin | `demo-admin` | `demo1234` |
| Property Manager | `demo-pm` | `demo1234` |
| Collector | `demo-collector` | `demo1234` |
| Owner | `demo-owner` | `demo1234` |

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run seed:demo    # Seed demo portfolio
npm run db:push      # Push schema to DB
npm run db:studio    # Open Prisma Studio
```

---

Copyright (c) 2026 AtlasPM. All rights reserved.
This software is proprietary and confidential.
Unauthorized copying, distribution, or use is strictly prohibited.
