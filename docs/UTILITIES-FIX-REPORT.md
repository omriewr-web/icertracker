# Utilities Module Fix Report — 2026-03-19

## Files Modified

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added `classification` to UtilityMeter; added `tenantNameSnapshot`, `leaseStartSnapshot`, `leaseEndSnapshot`, `closeReason`, `closedByUserId` to UtilityAccount |
| `src/app/api/utilities/accounts/route.ts` | Added one-active-account check in transaction + tenant snapshot on create + 409 conflict response |
| `src/app/api/utilities/accounts/[id]/route.ts` | Added `closeReason` and `closedByUserId` to PATCH handler |
| `src/app/api/utilities/meters/route.ts` | Added `classification` to POST create + passed to risk computation |
| `src/app/api/utilities/meters/[id]/route.ts` | Added `classification` to PATCH handler |
| `src/app/api/utilities/summary/route.ts` | Passed `classification` to risk computation |
| `src/app/api/import/utilities/route.ts` | Meter matching hierarchy: accountNumber > meterNumber+type > unit+type; added matchLog to response |
| `src/app/(dashboard)/utilities/utilities-content.tsx` | Fixed 3 broken KPI drilldowns; added meter classification to create form |
| `src/app/(dashboard)/utilities/meter-detail-modal.tsx` | Duplicate-active warning; tenant selector; classification edit field; snapshot display in history; closeReason recording |
| `src/lib/utility-risk.ts` | Classification-aware `meter_missing_unit` rule |
| `src/lib/signals/engine.ts` | Classification-aware `unitId: null` signal detection |
| `src/lib/validations.ts` | Added `classification` to meter create/update schemas; added `closeReason` to account update schema |
| `src/hooks/use-utilities.ts` | Added `classification` to useCreateMeter; improved error handling in useCreateAccount |
| `docs/TRACKER.md` | Marked all 5 utility findings as resolved |

## Schema Changes

Applied via `prisma db push` (project uses push, not migration files).

### UtilityMeter
- `classification String @default("unit_submeter")` — values: `unit_submeter`, `building_master`, `common_area`, `shared_meter`

### UtilityAccount
- `tenantNameSnapshot String?` — immutable snapshot of tenant name at account open
- `leaseStartSnapshot DateTime?` — immutable snapshot of lease start at account open
- `leaseEndSnapshot DateTime?` — immutable snapshot of lease end at account open
- `closeReason String?` — reason for account closure
- `closedByUserId String?` — who closed the account

### Database-Level Constraint
```sql
CREATE UNIQUE INDEX "utility_account_one_active_per_meter"
ON "utility_accounts" ("utilityMeterId")
WHERE "status" = 'active';
```

## Data Fix Scripts

### Backfill — Meter Classification
Ran directly via `prisma db execute`:
```sql
UPDATE "utility_meters"
SET "classification" = 'building_master'
WHERE "unitId" IS NULL AND "classification" = 'unit_submeter';
```
Reclassified all null-unit meters as `building_master` (safer default to avoid false-positive alerts).

### Duplicate Active Accounts
Script at `scripts/fix-duplicate-active-accounts.ts` — idempotent, safe to run again.
The partial unique index was applied successfully (no existing violations detected).

## Test Results

### Before
- TypeScript: 0 errors
- Tests: 466 passed, 1 failed (pre-existing timeout in w4b-import)

### After
- TypeScript: 0 errors
- Tests: 486 passed (467 existing all passing + 19 new)

### New Tests
- `src/__tests__/utilities/one-active-account-per-meter.test.ts` — 5 tests
- `src/__tests__/utilities/meter-import-dedup.test.ts` — 7 tests
- `src/__tests__/utilities/risk-engine-classification.test.ts` — 7 tests

## Deviations from Prompt

1. **Prisma enum for MeterClassification**: Used string field with validation instead of Prisma enum. The existing codebase uses string-based enums consistently (utilityType, assignedPartyType, status). Adding a Prisma enum would be inconsistent and more disruptive.

2. **`leaseStartSnapshot` uses `moveInDate`**: The Tenant model has `moveInDate` rather than `leaseStart`. Snapshots use `moveInDate` as the closest proxy for lease start.

3. **`closedAt` vs `endDate`**: The existing schema uses `endDate` for account closure date and `status: "closed"` for the status. Kept this pattern rather than adding a separate `closedAt` field, to avoid field duplication.

4. **Partial unique index uses `status = 'active'`** instead of `closedAt IS NULL`: The schema uses `status` for lifecycle state, not `closedAt`/`endDate`, so the constraint is aligned with the actual data model.

5. **No separate migration files**: Project uses `prisma db push` (no migration_lock.toml, no numbered migrations). Schema changes were applied via push + raw SQL for the partial index.

6. **Tenant selector shows current unit tenant only**: The prompt suggested fetching tenants via API. Since the meter detail modal already has the unit's tenant data loaded, I use that directly rather than adding a new API call — simpler and consistent with the existing data flow.

## Known Limitations / Follow-up Items

1. **Multi-tenant selector**: Currently shows only the current unit tenant. If multiple tenants can be on one unit (e.g., roommates), a broader tenant search would be needed.

2. **Historical account snapshots**: Existing closed accounts don't have snapshot data (fields are null). Only new accounts opened after this fix will have snapshots.

3. **Import classification**: Imported meters default to `unit_submeter`. The import route doesn't yet infer classification from import data. PMs should review imported meters and set classification as needed.

4. **Signal engine tenant derivation**: The signal engine (`detectUtilityRisks`) still derives tenant info from `meter.unit.tenant` for transfer-needed detection. This is correct for detecting current-state mismatches, but the account-level `tenantId`/`tenantNameSnapshot` should be used for historical accuracy in reporting.

5. **No `closedAt` separate from `endDate`**: If the business needs to distinguish "when the account period ended" from "when the closure was recorded in the system," these should be split into separate fields.
