# Prometheus Module — Implementation Results

## New Files Created

1. `src/lib/services/prometheus.service.ts` — Service layer (5 functions: createIntakeManual, runAIExtraction, findSimilarWorkOrders, runAIReview, promoteDraftToWorkOrder)
2. `src/lib/prometheus-pdf.tsx` — PDF generator using @react-pdf/renderer
3. `src/app/api/prometheus/intake/route.ts` — GET (list intakes) + POST (create intake)
4. `src/app/api/prometheus/intake/[id]/draft/route.ts` — POST (create/upsert draft from intake)
5. `src/app/api/prometheus/draft/[id]/verify/route.ts` — PATCH (verify draft)
6. `src/app/api/prometheus/draft/[id]/promote/route.ts` — POST (promote to work order, admin only)
7. `src/app/api/prometheus/draft/[id]/pdf/route.ts` — GET (download PDF)
8. `src/app/(dashboard)/prometheus/page.tsx` — Page shell
9. `src/app/(dashboard)/prometheus/prometheus-content.tsx` — Full 4-step wizard UI

## Existing Files Modified

1. `prisma/schema.prisma` — Added PrometheusIntake + WorkOrderDraft models, back-relations on User and Building
2. `src/components/layout/sidebar.tsx` — Added Zap import, added Prometheus nav item after Work Orders

## SQL for Supabase (Phase 1)

Run this in the Supabase SQL Editor:

```sql
-- PrometheusIntake
CREATE TABLE "prometheus_intakes" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "prometheus_intakes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "prometheus_intakes_buildingId_status_idx" ON "prometheus_intakes"("buildingId", "status");
CREATE INDEX "prometheus_intakes_organizationId_idx" ON "prometheus_intakes"("organizationId");

ALTER TABLE "prometheus_intakes"
  ADD CONSTRAINT "prometheus_intakes_buildingId_fkey"
  FOREIGN KEY ("buildingId") REFERENCES "buildings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "prometheus_intakes"
  ADD CONSTRAINT "prometheus_intakes_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- WorkOrderDraft
CREATE TABLE "work_order_drafts" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "work_order_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_order_drafts_intakeId_key" ON "work_order_drafts"("intakeId");
CREATE INDEX "work_order_drafts_buildingId_status_idx" ON "work_order_drafts"("buildingId", "status");
CREATE INDEX "work_order_drafts_organizationId_idx" ON "work_order_drafts"("organizationId");

ALTER TABLE "work_order_drafts"
  ADD CONSTRAINT "work_order_drafts_buildingId_fkey"
  FOREIGN KEY ("buildingId") REFERENCES "buildings"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "work_order_drafts"
  ADD CONSTRAINT "work_order_drafts_intakeId_fkey"
  FOREIGN KEY ("intakeId") REFERENCES "prometheus_intakes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "work_order_drafts"
  ADD CONSTRAINT "work_order_drafts_verifiedByUserId_fkey"
  FOREIGN KEY ("verifiedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

## Manual Test Steps

### Stage 1 — Intake
1. Navigate to `/prometheus`
2. Select a building from the dropdown
3. Enter a description (e.g. "Tenant in 4A reports water leaking from bathroom ceiling, dripping onto floor")
4. Click "Submit Intake"
5. Verify the intake appears in the left panel
6. Wait a few seconds for AI extraction (summary should appear in italic)

### Stage 2 — Verify
1. Click on a pending intake card
2. Verify fields are pre-filled from AI extraction
3. Adjust title, category, priority as needed
4. Add access attempt rows if applicable
5. Click "Confirm & Create Draft"

### Stage 3 — AI Review
1. Review flagged issues on the left panel
2. Check completeness score progress bar
3. Review similar past work orders on the right
4. Click "Mark as Verified"

### Stage 4 — Output
1. Click "Download PDF" — verify PDF downloads with correct layout
2. Click "Promote to Work Order" — verify success message
3. Navigate to `/maintenance` — verify the new work order appears

## Known Limitations / Deferred Items

- **Prisma client not regenerated**: The dev server EPERM issue prevents `prisma generate`. Run `npx prisma generate` after stopping the dev server, or apply the SQL above and run `npx prisma db push`.
- **Assigned To field**: Currently accepts raw user ID. Could be enhanced with a user dropdown picker.
- **Email forwarding**: The "Forwarded Email" source option stores the pasted content; actual email webhook integration (e.g., SendGrid inbound parse) is deferred.
- **File uploads**: Attachments are stored as base64 data URLs. For production, integrate with Supabase Storage for proper file hosting.
- **PDF similar WOs**: The PDF shows work order IDs but not full titles (would require a join at PDF generation time). The UI shows full details.
