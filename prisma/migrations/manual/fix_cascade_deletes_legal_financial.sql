-- Migration: fix_cascade_deletes_legal_financial
-- Date: 2026-03-17
-- Purpose: Replace dangerous CASCADE deletes with RESTRICT on legal/financial models,
--          and add soft delete columns to tenants table.
--
-- IMPORTANT: Run this in Supabase SQL Editor BEFORE running prisma db push.
-- These changes prevent permanent loss of legal history, payment records,
-- and other audit-critical data when a tenant or parent record is deleted.

BEGIN;

-- ============================================================
-- TASK 1: Add soft delete columns to tenants
-- ============================================================

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "tenants_isDeleted_idx" ON "tenants" ("isDeleted");

-- ============================================================
-- TASK 2: Fix Tenant → Unit cascade (was CASCADE, now RESTRICT)
-- Prevents deleting a unit from destroying all tenant data
-- ============================================================

ALTER TABLE "tenants"
  DROP CONSTRAINT IF EXISTS "tenants_unitId_fkey",
  ADD CONSTRAINT "tenants_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- TASK 3: Fix child → Tenant cascades (all were CASCADE, now RESTRICT)
-- These models have independent legal/financial value
-- ============================================================

-- TenantNote → Tenant
ALTER TABLE "tenant_notes"
  DROP CONSTRAINT IF EXISTS "tenant_notes_tenantId_fkey",
  ADD CONSTRAINT "tenant_notes_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- CommLog → Tenant
ALTER TABLE "comm_logs"
  DROP CONSTRAINT IF EXISTS "comm_logs_tenantId_fkey",
  ADD CONSTRAINT "comm_logs_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Payment → Tenant
ALTER TABLE "payments"
  DROP CONSTRAINT IF EXISTS "payments_tenantId_fkey",
  ADD CONSTRAINT "payments_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- LegalCase → Tenant
ALTER TABLE "legal_cases"
  DROP CONSTRAINT IF EXISTS "legal_cases_tenantId_fkey",
  ADD CONSTRAINT "legal_cases_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Task → Tenant
ALTER TABLE "tasks"
  DROP CONSTRAINT IF EXISTS "tasks_tenantId_fkey",
  ADD CONSTRAINT "tasks_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- CollectionNote → Tenant
ALTER TABLE "collection_notes"
  DROP CONSTRAINT IF EXISTS "collection_notes_tenantId_fkey",
  ADD CONSTRAINT "collection_notes_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- CollectionNote → Building (also had CASCADE, now RESTRICT)
ALTER TABLE "collection_notes"
  DROP CONSTRAINT IF EXISTS "collection_notes_buildingId_fkey",
  ADD CONSTRAINT "collection_notes_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "buildings"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ARSnapshot → Tenant
ALTER TABLE "ar_snapshots"
  DROP CONSTRAINT IF EXISTS "ar_snapshots_tenantId_fkey",
  ADD CONSTRAINT "ar_snapshots_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ARSnapshot → Building (also had CASCADE, now RESTRICT)
ALTER TABLE "ar_snapshots"
  DROP CONSTRAINT IF EXISTS "ar_snapshots_buildingId_fkey",
  ADD CONSTRAINT "ar_snapshots_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "buildings"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- TASK 4: Fix LegalNote → LegalCase cascade (was CASCADE, now RESTRICT)
-- Legal notes are audit records — must survive case deletion
-- ============================================================

ALTER TABLE "legal_notes"
  DROP CONSTRAINT IF EXISTS "legal_notes_legalCaseId_fkey",
  ADD CONSTRAINT "legal_notes_legalCaseId_fkey"
    FOREIGN KEY ("legalCaseId") REFERENCES "legal_cases"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- TASK 5: Fix Lease → Unit cascade (was CASCADE, now RESTRICT)
-- Leases are financial records — must survive unit deletion
-- ============================================================

ALTER TABLE "leases"
  DROP CONSTRAINT IF EXISTS "leases_unitId_fkey",
  ADD CONSTRAINT "leases_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
