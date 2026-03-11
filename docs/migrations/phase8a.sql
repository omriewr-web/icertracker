-- Phase 8a: Expand Violation & WorkOrder, add Complaint model
-- Generated from prisma migrate diff

-- AlterTable
ALTER TABLE "violations" ADD COLUMN     "certifyByDate" TIMESTAMP(3),
ADD COLUMN     "complaintId" TEXT,
ADD COLUMN     "needsWorkOrder" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "normalizedCategory" TEXT,
ADD COLUMN     "reconciliationStatus" TEXT NOT NULL DEFAULT 'UNMATCHED',
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT;

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "dueDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "unitId" TEXT,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reportedBy" TEXT,
    "reportedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "complaints_buildingId_idx" ON "complaints"("buildingId");

-- CreateIndex
CREATE INDEX "complaints_status_idx" ON "complaints"("status");

-- CreateIndex
CREATE INDEX "complaints_source_idx" ON "complaints"("source");

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
