// Permission: "legal" — legal case management
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { legalCaseSchema } from "@/lib/validations";
import { assertTenantAccess } from "@/lib/data-scope";
import { LegalStage } from "@prisma/client";

const LEGAL_CASE_INCLUDE = {
  notes: {
    orderBy: { createdAt: "desc" as const },
    include: { author: { select: { name: true } } },
  },
  attorneyContact: { select: { id: true, name: true, company: true, email: true, phone: true } },
  marshalContact: { select: { id: true, name: true, company: true, email: true, phone: true } },
  assignedUser: { select: { id: true, name: true } },
};

// GET — active case for tenant
export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertTenantAccess(user, id);
  if (denied) return denied;

  const legalCase = await prisma.legalCase.findFirst({
    where: { tenantId: id, isActive: true },
    include: LEGAL_CASE_INCLUDE,
  });
  return NextResponse.json(legalCase);
}, "legal");

// POST — upsert active case (deactivates old case if creating new one)
export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertTenantAccess(user, id);
  if (denied) return denied;

  const data = await parseBody(req, legalCaseSchema);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.legalCase.findFirst({
      where: { tenantId: id, isActive: true },
    });

    if (existing) {
      // Detect stage change for audit trail
      const newStage = data.stage as LegalStage | undefined;
      if (newStage && newStage !== existing.stage) {
        await tx.legalNote.create({
          data: {
            legalCaseId: existing.id,
            authorId: user.id,
            text: `Stage changed from ${existing.stage.replace(/_/g, " ")} to ${newStage.replace(/_/g, " ")}`,
            stage: newStage,
            isSystem: true,
          },
        });
      }

      // Update existing active case
      const updated = await tx.legalCase.update({
        where: { id: existing.id },
        data: {
          inLegal: data.inLegal,
          stage: data.stage as LegalStage | undefined,
          caseNumber: data.caseNumber,
          attorney: data.attorney,
          attorneyId: data.attorneyId,
          filedDate: data.filedDate ? new Date(data.filedDate) : undefined,
          courtDate: data.courtDate ? new Date(data.courtDate) : data.courtDate === null ? null : undefined,
          arrearsBalance: data.arrearsBalance !== undefined ? data.arrearsBalance : undefined,
          status: data.status,
          assignedUserId: data.assignedUserId,
          marshalId: data.marshalId,
          marshalScheduledDate: data.marshalScheduledDate ? new Date(data.marshalScheduledDate) : data.marshalScheduledDate === null ? null : undefined,
          marshalExecutedDate: data.marshalExecutedDate ? new Date(data.marshalExecutedDate) : data.marshalExecutedDate === null ? null : undefined,
        },
        include: LEGAL_CASE_INCLUDE,
      });
      return updated;
    } else {
      // No active case — create new one
      const created = await tx.legalCase.create({
        data: {
          tenantId: id,
          inLegal: data.inLegal ?? true,
          stage: (data.stage as LegalStage) || "NOTICE_SENT",
          caseNumber: data.caseNumber,
          attorney: data.attorney,
          attorneyId: data.attorneyId,
          filedDate: data.filedDate ? new Date(data.filedDate) : null,
          courtDate: data.courtDate ? new Date(data.courtDate) : null,
          arrearsBalance: data.arrearsBalance ?? null,
          status: data.status || "active",
          assignedUserId: data.assignedUserId,
          marshalId: data.marshalId,
          marshalScheduledDate: data.marshalScheduledDate ? new Date(data.marshalScheduledDate) : null,
          marshalExecutedDate: data.marshalExecutedDate ? new Date(data.marshalExecutedDate) : null,
          isActive: true,
        },
        include: LEGAL_CASE_INCLUDE,
      });
      return created;
    }
  });

  return NextResponse.json(result);
}, "legal");
