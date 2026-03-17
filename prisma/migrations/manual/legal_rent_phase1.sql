-- Migration: legal_rent_phase1
-- Date: 2026-03-17
-- Purpose: Add rent stabilization tracking fields to Unit/Tenant models,
--          create RgbOrder table for NYC Rent Guidelines Board data.
--
-- Run this in Supabase SQL Editor BEFORE deploying.
-- All new fields are nullable or have defaults — no breaking changes.

BEGIN;

-- ============================================================
-- 1. New enums
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "RegulationType" AS ENUM ('STABILIZED', 'CONTROLLED', 'UNREGULATED', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TenantLeaseType" AS ENUM ('ONE_YEAR', 'TWO_YEAR', 'MONTH_TO_MONTH', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Unit model — rent regulation fields
-- ============================================================

ALTER TABLE "units"
  ADD COLUMN IF NOT EXISTS "isRentControlled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "regulationType" "RegulationType" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS "dhcrRegistrationId" TEXT,
  ADD COLUMN IF NOT EXISTS "lastDhcrRegistrationYear" INTEGER,
  ADD COLUMN IF NOT EXISTS "mciMonthlyIncrease" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "mciExpirationDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unitRooms" INTEGER;

-- ============================================================
-- 3. Tenant model — lease type and rent stabilization tracking
-- ============================================================

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "leaseType" "TenantLeaseType" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS "rgbOrderApplied" TEXT,
  ADD COLUMN IF NOT EXISTS "iaiMonthlyIncrease" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "iaiStartDate" TIMESTAMP(3);

-- ============================================================
-- 4. RgbOrder table — NYC Rent Guidelines Board orders
-- ============================================================

CREATE TABLE IF NOT EXISTS "rgb_orders" (
  "id" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3) NOT NULL,
  "oneYearPct" DECIMAL(5,4) NOT NULL,
  "twoYearPct" DECIMAL(5,4) NOT NULL,
  "twoYearY1Pct" DECIMAL(5,4),
  "twoYearY2Pct" DECIMAL(5,4),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rgb_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rgb_orders_orderNumber_key" ON "rgb_orders"("orderNumber");

COMMIT;
