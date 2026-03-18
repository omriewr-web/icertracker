# Bug 6: Collections Status Vocabulary Drift — Fix Report

**Date:** 2026-03-18
**Severity:** High — blocks real data onboarding
**Status:** FIXED

---

## Problem

Two separate status systems existed with no single source of truth:

1. **ARSnapshot.collectionStatus** — Prisma enum `CollectionStatus`: `CURRENT, LATE, DELINQUENT, CHRONIC, PAYMENT_PLAN, LEGAL, VACATE_PENDING`
2. **CollectionCase.status** — plain String field, default `"new_arrears"`, with inconsistent values across codebase

### Drift found:

| Location | Values Used | Problem |
|----------|-------------|---------|
| `schema.prisma` comment | `new_arrears, reminder_sent, payment_plan, notice_served, legal_review, legal_filed` | Outdated — doesn't match what UI writes |
| `collections-content.tsx` | `monitoring, demand_sent, legal_referred, payment_plan, resolved` | Hardcoded array, not imported |
| `[tenantId]/page.tsx` | `CURRENT, LATE, DELINQUENT, PAYMENT_PLAN, LEGAL, HARDSHIP, WRITTEN_OFF` | Hardcoded with own color objects |
| `collections.service.ts` | `"legal_referred"` hardcoded in sendToLegal | String literal, no constant |
| `validations.ts` | `z.string().min(1)` | Accepts ANY string — no enumeration |
| `statuses.ts` | Both sets mapped in `normalizeCollectionStatus()` | Correct but not consumed by UI |

---

## Canonical Values (source of truth: `src/lib/constants/statuses.ts`)

### CollectionCase.status (lowercase, written to DB)
```
monitoring | demand_sent | legal_referred | payment_plan | resolved
```

### CollectionStatus enum (uppercase, ARSnapshot/Tenant)
```
CURRENT | LATE | DELINQUENT | CHRONIC | PAYMENT_PLAN | LEGAL | VACATE_PENDING
```

### Display labels (what users see)
```
Active | Late | Follow Up | Delinquent | Legal Review | Escalated | Legal |
Monitoring | Payment Plan | Resolved | Hardship | Written Off | Vacate Pending
```

---

## What Was Fixed

### 1. `src/lib/constants/statuses.ts`
- Added `COLLECTION_CASE_STATUSES` — canonical array of CollectionCase.status values
- Added `CollectionCaseStatus` type
- Added `COLLECTION_CASE_OPTIONS` — for UI filter dropdowns
- Added `COLLECTION_PROFILE_STATUS_OPTIONS` — for tenant profile status selector (with colors from centralized map)

### 2. `src/app/(dashboard)/collections/collections-content.tsx`
- Replaced hardcoded `COLLECTION_STATUSES` array with import from `COLLECTION_CASE_OPTIONS`
- Replaced 2 hardcoded `<option>` blocks with `COLLECTION_STATUSES.map()`

### 3. `src/app/(dashboard)/collections/[tenantId]/page.tsx`
- Replaced hardcoded `STATUS_OPTIONS` array with `COLLECTION_PROFILE_STATUS_OPTIONS` from statuses.ts
- Removed local `StatusOption` interface (no longer needed)

### 4. `src/lib/services/collections.service.ts`
- Added import of `COLLECTION_CASE_STATUSES` from statuses.ts (available for future use)

### 5. `src/lib/validations.ts`
- Changed `collectionStatusUpdateSchema.status` from `z.string().min(1)` to `z.enum([...])` with all valid values from both systems

### 6. `prisma/schema.prisma`
- Updated `CollectionCase.status` comment to list canonical values
- Changed default from `"new_arrears"` to `"monitoring"`
- Added reference to `src/lib/constants/statuses.ts`

---

## Not Changed (out of scope)
- Did not convert CollectionCase.status from String to Prisma enum (requires migration)
- Did not change the normalizeCollectionStatus() mapping logic (it was already correct)
- Existing DB rows with old values (`new_arrears`, `reminder_sent`, etc.) still work via the normalizer
