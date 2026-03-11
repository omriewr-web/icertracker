// Permission: "legal" — legal import review queue
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { LegalStage } from "@prisma/client";
import { assertTenantAccess } from "@/lib/data-scope";

const STAGE_MAP: Record<string, LegalStage> = {
  "notice sent": "NOTICE_SENT", "notice": "NOTICE_SENT",
  "holdover": "HOLDOVER", "nonpayment": "NONPAYMENT",
  "non-payment": "NONPAYMENT", "court date": "COURT_DATE",
  "court": "COURT_DATE", "stipulation": "STIPULATION",
  "judgment": "JUDGMENT", "judgement": "JUDGMENT",
  "warrant": "WARRANT", "eviction": "EVICTION", "settled": "SETTLED",
};

function parseStage(value: string | undefined | null): LegalStage {
  if (!value) return "NONPAYMENT";
  return STAGE_MAP[value.toLowerCase().replace(/[_-]/g, " ").trim()] || "NONPAYMENT";
}

// GET — List pending review items
export const GET = withAuth(async (req: NextRequest) => {
  const items = await prisma.legalImportQueue.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ items });
}, "legal");

// POST — Resolve a review item (approve with tenant assignment, or reject)
export const POST = withAuth(async (req: NextRequest, { user }) => {
  const body = await req.json();
  const { queueId, action, tenantId } = body as {
    queueId: string;
    action: "approve" | "reject";
    tenantId?: string;
  };

  if (!queueId || !action) {
    return NextResponse.json({ error: "queueId and action required" }, { status: 400 });
  }

  const item = await prisma.legalImportQueue.findUnique({ where: { id: queueId } });
  if (!item) {
    return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
  }

  if (action === "reject") {
    await prisma.legalImportQueue.update({
      where: { id: queueId },
      data: { status: "rejected", resolvedById: user.id, resolvedAt: new Date() },
    });
    return NextResponse.json({ status: "rejected" });
  }

  // Approve — need tenantId
  const targetTenantId = tenantId || item.candidateTenantId;
  if (!targetTenantId) {
    return NextResponse.json({ error: "tenantId required to approve" }, { status: 400 });
  }

  const forbidden = await assertTenantAccess(user, targetTenantId);
  if (forbidden) return forbidden;

  const rawData = item.rawData as any;
  const stage = parseStage(rawData.legalStage);

  await prisma.$transaction(async (tx) => {
    // Deactivate any existing active case
    await tx.legalCase.updateMany({
      where: { tenantId: targetTenantId, isActive: true },
      data: { isActive: false },
    });

    // Create new case
    const created = await tx.legalCase.create({
      data: {
        tenantId: targetTenantId,
        inLegal: true,
        stage,
        caseNumber: rawData.caseNumber || null,
        attorney: rawData.attorney || null,
        filedDate: rawData.filingDate ? new Date(rawData.filingDate) : null,
        courtDate: rawData.courtDate ? new Date(rawData.courtDate) : null,
        arrearsBalance: rawData.arrearsBalance || null,
        status: rawData.status || "active",
        importBatchId: item.importBatchId,
        isActive: true,
      },
    });

    if (rawData.notes) {
      await tx.legalNote.create({
        data: {
          legalCaseId: created.id,
          authorId: user.id,
          text: `[Import - Manual Review] ${rawData.notes}`,
          stage,
          isSystem: true,
        },
      });
    }

    await tx.legalImportQueue.update({
      where: { id: queueId },
      data: { status: "approved", resolvedById: user.id, resolvedAt: new Date() },
    });
  });

  return NextResponse.json({ status: "approved", tenantId: targetTenantId });
}, "legal");
