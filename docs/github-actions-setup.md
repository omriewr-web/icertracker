# GitHub Actions CI/CD Setup

## Required Secrets

The CI/CD pipeline requires the following secrets to be configured in GitHub.

| Secret | Purpose | Where to get it |
|--------|---------|-----------------|
| `VERCEL_TOKEN` | Deploy to Vercel in the deploy job | [Vercel Dashboard](https://vercel.com/account/tokens) > Create Token |
| `DATABASE_URL` | Prisma client generation (connection pooling URL) | Supabase project > Settings > Database > Connection string (port 6543, with `?pgbouncer=true`) |
| `DIRECT_URL` | Direct database connection (if needed for migrations) | Supabase project > Settings > Database > Connection string (port 5432) |

## How to Add Secrets

1. Go to your GitHub repository: https://github.com/omriewr-web/icertracker
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add each secret listed above with its name and value

## Why These Are Needed

- **`DATABASE_URL`** — `prisma generate` runs during the typecheck, lint, and test jobs to generate the Prisma client. Without a valid connection string in the schema's `datasource`, generation may fail depending on your Prisma version.
- **`VERCEL_TOKEN`** — The deploy job runs `npx vercel --prod` which requires authentication via this token.
- **`DIRECT_URL`** — Used by Prisma for direct connections (migrations, introspection). Add it if you plan to run migrations in CI.

## Pipeline Overview

| Job | Trigger | What it does |
|-----|---------|--------------|
| **typecheck** | push to main, all PRs | `tsc --noEmit` |
| **lint** | push to main, all PRs | `next lint` |
| **test** | push to main, all PRs | `vitest run --passWithNoTests` |
| **deploy** | push to main only (after all checks pass) | `vercel --prod --force` |
