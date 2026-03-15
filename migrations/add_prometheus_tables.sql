-- Migration: Add Prometheus/Themis tables
-- Run this in Supabase SQL Editor to fix PrismaClientInitializationError
-- These tables were added to schema.prisma but never created in the database.

-- 1. Create prometheus_intakes table
CREATE TABLE IF NOT EXISTS "prometheus_intakes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "buildingId" TEXT,
    "unitId" TEXT,
    "tenantId" TEXT,
    "source" TEXT NOT NULL,
    "rawSubject" TEXT,
    "rawBody" TEXT,
    "rawSender" TEXT,
    "attachmentUrls" JSONB,
    "extractedDate" TIMESTAMP(3),
    "extractedIssue" TEXT,
    "extractedUnit" TEXT,
    "extractedContact" TEXT,
    "aiSummary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "convertedWOId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prometheus_intakes_pkey" PRIMARY KEY ("id")
);

-- 2. Create work_order_drafts table
CREATE TABLE IF NOT EXISTS "work_order_drafts" (
    "id" TEXT NOT NULL,
    "intakeId" TEXT,
    "organizationId" TEXT,
    "buildingId" TEXT NOT NULL,
    "unitId" TEXT,
    "tenantId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "WorkOrderCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "WorkOrderPriority" NOT NULL DEFAULT 'MEDIUM',
    "trade" TEXT,
    "assignedToId" TEXT,
    "vendorId" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "incidentDate" TIMESTAMP(3),
    "accessAttempts" JSONB,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "flaggedIssues" JSONB,
    "similarWOIds" JSONB,
    "photoUrls" JSONB,
    "promotedToWOId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_drafts_pkey" PRIMARY KEY ("id")
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS "prometheus_intakes_buildingId_status_idx" ON "prometheus_intakes"("buildingId", "status");
CREATE INDEX IF NOT EXISTS "prometheus_intakes_organizationId_idx" ON "prometheus_intakes"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "work_order_drafts_intakeId_key" ON "work_order_drafts"("intakeId");
CREATE INDEX IF NOT EXISTS "work_order_drafts_buildingId_status_idx" ON "work_order_drafts"("buildingId", "status");
CREATE INDEX IF NOT EXISTS "work_order_drafts_organizationId_idx" ON "work_order_drafts"("organizationId");

-- 4. Foreign keys
ALTER TABLE "prometheus_intakes" ADD CONSTRAINT "prometheus_intakes_buildingId_fkey"
  FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "prometheus_intakes" ADD CONSTRAINT "prometheus_intakes_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "work_order_drafts" ADD CONSTRAINT "work_order_drafts_buildingId_fkey"
  FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "work_order_drafts" ADD CONSTRAINT "work_order_drafts_intakeId_fkey"
  FOREIGN KEY ("intakeId") REFERENCES "prometheus_intakes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "work_order_drafts" ADD CONSTRAINT "work_order_drafts_verifiedByUserId_fkey"
  FOREIGN KEY ("verifiedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
