# Utilities Fix Preflight — 2026-03-19

## Environment Check
- `DATABASE_URL`: Set
- `DIRECT_URL`: Set
- `VERCEL_TOKEN`: Not set (deploy step may need manual handling)

## Baseline Metrics
- **TypeScript errors**: 0
- **Tests**: 466 passed, 1 failed (pre-existing timeout in `w4b-import.test.ts`)

## File Inventory

| Area | File Path | Key Lines |
|------|-----------|-----------|
| Prisma schema — UtilityMeter | `prisma/schema.prisma:1722` | No `classification` field exists |
| Prisma schema — UtilityAccount | `prisma/schema.prisma:1744` | `tenantId` already exists as FK; no snapshot fields |
| Prisma schema — UtilityMonthlyCheck | `prisma/schema.prisma:1769` | — |
| Accounts POST route | `src/app/api/utilities/accounts/route.ts:9` | Creates without duplicate-active check |
| Accounts PATCH route | `src/app/api/utilities/accounts/[id]/route.ts:27` | Updates status/endDate/closedWithBalance |
| Meters list route | `src/app/api/utilities/meters/route.ts:60` | `.find()` picks first active account only |
| Meter detail route | `src/app/api/utilities/meters/[id]/route.ts:10` | Returns full meter with accounts+tenant |
| Meter detail modal | `src/app/(dashboard)/utilities/meter-detail-modal.tsx:229` | `acc.tenant \|\| meter.unit?.tenant` — runtime derivation |
| Open account modal | `src/app/(dashboard)/utilities/meter-detail-modal.tsx:342` | No tenant selector exists |
| Utilities dashboard | `src/app/(dashboard)/utilities/utilities-content.tsx:201-206` | 3 broken KPI drilldowns |
| Utility import route | `src/app/api/import/utilities/route.ts:71` | Meter match only when `accountNumber` present |
| Risk rules | `src/lib/utility-risk.ts:103-107` | `unitId === null` check without classification |
| Signal engine — utility risks | `src/lib/signals/engine.ts:1042-1069` | Same `unitId: null` check without classification |
| Signal engine — main scan | `src/lib/signals/engine.ts:28` | `runSignalScan()` |
| Cron route | `src/app/api/cron/signals/route.ts:9` | Calls `runSignalScan("scheduled")` |
| Summary route | `src/app/api/utilities/summary/route.ts` | Computes KPI numbers |
| Validations | `src/lib/validations.ts:349-369` | Account create/update schemas |

## Schema Findings

- **UtilityMeter**: No `classification` or `meterType` field. Has `utilityType` as free string ("electric" | "gas" | "water" | "common_electric" | "common_gas").
- **UtilityAccount**: Already has `tenantId` as optional FK. Does NOT have `tenantNameSnapshot`, `leaseStartSnapshot`, `leaseEndSnapshot`, `responsibleParty`, `closeReason`, or `closedByUserId`.
- Account closure uses `status: "closed"` + `endDate` + `closedWithBalance` — no `closeReason` or `closedAt` (uses `endDate`).
- No unique constraint preventing multiple active accounts per meter.

## KPI Drilldown Analysis

| KPI Card | Current onClick | Filter Used | Problem |
|----------|----------------|-------------|---------|
| Not Recorded | `setFilterCheckStatus("no_check")` | `filterCheckStatus` matches `currentMonthCheckStatus` | Value should be `"not_recorded"` |
| Transfer Needed | `setFilterRisk("transfer")` | `filterRisk` matches `riskFlag` | No risk flag called "transfer"; should use `setFilterTransfer("all")` |
| Risk Signals | `setFilterRisk("risk")` | `filterRisk` matches `riskFlag` | No risk flag called "risk"; should use `setFilterRiskOnly(true)` |
