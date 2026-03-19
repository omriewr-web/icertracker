# Utility Phase 1+2 Preflight — 2026-03-19

## P.1 Environment
- `DATABASE_URL`: Set
- `DIRECT_URL`: Set
- `VERCEL_TOKEN`: Set

## P.2 Repo
- Path: `C:/Users/omrid/Documents/icertracker` — confirmed

## P.3 Git Status
- Working tree clean (only `.claude/settings.local.json` auto-modified)

## P.4 TypeScript Baseline
- **0 errors**

## P.5 Codebase Findings

### Auth pattern
- All utility routes use `withAuth(handler, "permission-string")` from `src/lib/api-helpers.ts`
- `withAuth` signature: `(handler: ApiHandler, perm?: string)` — gets session via `getServerSession(authOptions)`, loads fresh user via `loadFreshAuthUserById`, checks permission via `hasPermission`
- Body parsing: `parseBody(req, zodSchema)` from same file
- Access checks: `canAccessBuilding(user, buildingId)` from `src/lib/data-scope.ts`

### Prisma relation names
- `UtilityAccount` → meter: **`meter`** (relation field `utilityMeterId`, relation name `meter`)
- `UtilityMeter` → building: **`building`** (relation field `buildingId`)
- `UtilityMeter` → unit: **`unit`** (relation field `unitId`)
- `UtilityAccount` → tenant: **`tenant`** (relation field `tenantId`)

### Org field naming
- **Building** uses `organizationId`
- **Newer workflow models** (Conversation, Project, OutreachCampaign, RgbOrder) use **`orgId`**
- **UserAccessGrant**, **PermissionAuditLog** use `orgId`
- **User** uses `organizationId`
- **Decision: New models will use `orgId`** — matches the newer pattern (Conversation, Project, OutreachCampaign)

### Tenant model
- `Tenant` does NOT have `buildingId` — derive via `unit.buildingId`
- `Tenant` does NOT have `leaseStart` — use `moveInDate` and `leaseExpiration`
- `Tenant` has: `unitId` (unique), `moveInDate`, `leaseExpiration`, `moveOutDate`, `name`

### Lease model
- `Lease` has `isCurrent`, `leaseStart`, `leaseEnd`, `tenantId`, `unitId`

### Meter detail API response
- Returns raw Prisma meter object (not wrapped): `NextResponse.json(meter)`
- Includes: `building`, `unit` (with tenant), `accounts` (with tenant)
- Frontend consumers: `useUtilityMeter(meterId)` in `src/hooks/use-utilities.ts`, consumed by `MeterDetailModal`

### Vacancy service
- `src/lib/services/vacancy.service.ts` has canonical `syncVacancyState(unitId)` function
- It handles: Unit.isVacant sync, VacancyInfo, Vacancy record, TurnoverWorkflow
- Runs inside `prisma.$transaction`
- Good hook point: after vacancy is created (shouldBeVacant && !activeVacancy) and after vacancy is deactivated (shouldBeOccupied && activeVacancy)

### Phase 0 verification (already exists in schema)
- `classification` on UtilityMeter: YES
- `tenantNameSnapshot`, `leaseStartSnapshot`, `leaseEndSnapshot` on UtilityAccount: YES
- `closeReason`, `closedByUserId` on UtilityAccount: YES
- One-active-account enforcement: YES (partial unique index + transaction guard)

### Not yet built
- `UtilityResponsibilityEvent` model: NOT in schema
- `UtilityTask` model: NOT in schema
- `workflowState` on UtilityAccount: NOT in schema
- Utility automation service: DOES NOT exist
- Utility task API routes: DO NOT exist

### Existing utility tests
- `src/__tests__/utilities/meter-import-dedup.test.ts`
- `src/__tests__/utilities/one-active-account-per-meter.test.ts`
- `src/__tests__/utilities/risk-engine-classification.test.ts`
