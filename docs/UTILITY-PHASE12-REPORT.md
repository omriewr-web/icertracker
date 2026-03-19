# Utility Phase 1+2 Report — 2026-03-19

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/utilities/responsibility-event.service.ts` | Immutable event recording (opened, closed, transferred, owner hold, move in/out, history queries) |
| `src/lib/utilities/utility-task.service.ts` | Task CRUD, batch creation, completion, dashboard counts |
| `src/lib/utilities/utility-automation.service.ts` | Fire-and-forget hooks for move-out, vacancy, new tenant, vacancy closed |
| `src/app/api/utilities/tasks/route.ts` | GET (list with filters) + POST (manual task creation) |
| `src/app/api/utilities/tasks/[id]/route.ts` | GET (detail) + PATCH (complete/skip/reassign) |
| `src/app/api/utilities/tasks/counts/route.ts` | GET dashboard counts |
| `src/__tests__/utilities/utility-automation.test.ts` | 10 tests for automation logic |
| `docs/UTILITY-PHASE12-PREFLIGHT.md` | Preflight findings |

## Files Modified

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added 4 enums + 2 models + workflowState on UtilityAccount |
| `src/app/api/utilities/accounts/route.ts` | Records `account_opened` event after creation |
| `src/app/api/utilities/accounts/[id]/route.ts` | Records `account_closed` event when status→closed |
| `src/app/api/utilities/meters/[id]/route.ts` | Adds `eventHistory` to GET response |
| `src/app/(dashboard)/utilities/meter-detail-modal.tsx` | EventHistorySection component + renders in modal |
| `src/lib/signals/engine.ts` | 3 new rules: task overdue, owner hold pending, old tenant active |
| `src/app/api/vacancies/[unitId]/status/route.ts` | Hooks onUnitBecameVacant / onVacancyClosed |
| `src/app/api/tenants/route.ts` | Hooks onNewTenantCreated after POST |
| `src/app/api/tenants/[id]/route.ts` | Hooks onMoveOutRecorded when moveOutDate set |
| `src/lib/validations.ts` | Added moveOutDate to tenantUpdateSchema |

## Schema Changes

- `UtilityWorkflowState` enum (7 values)
- `UtilityEventType` enum (14 values)
- `UtilityTaskType` enum (8 values)
- `UtilityTaskStatus` enum (5 values)
- `UtilityResponsibilityEvent` model (immutable audit log, 6 indexes)
- `UtilityTask` model (workflow tasks, 7 indexes)
- `UtilityAccount.workflowState` String field with default + index

## Automation Hooks

| Trigger | Hook | Location |
|---------|------|----------|
| Account opened | `recordAccountOpened` | `accounts/route.ts` POST (route-level) |
| Account closed | `recordAccountClosed` | `accounts/[id]/route.ts` PATCH (route-level) |
| Move-out date set | `onMoveOutRecorded` | `tenants/[id]/route.ts` PATCH (route-level) |
| Unit becomes vacant | `onUnitBecameVacant` | `vacancies/[unitId]/status/route.ts` (route-level) |
| Vacancy closed | `onVacancyClosed` | `vacancies/[unitId]/status/route.ts` (route-level) |
| New tenant created | `onNewTenantCreated` | `tenants/route.ts` POST (route-level) |

## Vacancy Automation Approach

Route-level hooks in `vacancies/[unitId]/status/route.ts` rather than inside `vacancy.service.ts`. Reason: `syncVacancyState` runs inside a `prisma.$transaction` — calling the automation service (which uses its own prisma instance) from inside the transaction risks deadlocks. The vacancy status route is the primary entry point for vacancy state changes.

## Org Field Name

New models use `orgId` — matching Conversation, Project, OutreachCampaign. Building uses `organizationId`. Org is derived from building: `building.organizationId`.

## Prisma Relation Names

- `UtilityAccount.meter` → UtilityMeter (field `utilityMeterId`)
- `UtilityMeter.building` → Building (field `buildingId`)
- `Building.organizationId` → Organization

## API Response Contract Changes

- `GET /api/utilities/meters/[id]` — now returns `{ ...meter, eventHistory: UtilityResponsibilityEvent[] }`. The `eventHistory` field is additive — all existing fields remain at top level. No consumer breakage.

## TypeScript

- Before: 0 errors
- After: 0 errors

## Tests

- Before: 1058 tests passing
- After: 1068 tests passing (+10 new utility automation tests)

## Known Limitations

1. Vacancy automation uses route-level hooks (not service-level) to avoid transaction conflicts
2. EventHistorySection is appended to meter detail modal — no tab switching (modal doesn't have tabs)
3. Task dashboard UI (KPI cards, task list) not yet added to utilities-content.tsx — requires separate frontend work
4. Turnover checklist integration not implemented — no turnover detail page currently has utility checklist
5. `workflowState` on UtilityAccount is a String (not enum reference) for compatibility with existing string-based status pattern
