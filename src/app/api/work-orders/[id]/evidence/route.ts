import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { assertWorkOrderAccess } from "@/lib/data-scope";
import { z } from "zod";

export const dynamic = "force-dynamic";

const evidenceCreateSchema = z.object({
  imageUrl: z.string().url(),
  type: z.enum(["BEFORE", "AFTER", "TENANT_SIGNATURE", "SUPER_ATTESTATION", "MATERIAL_RECEIPT", "PM_VERIFICATION", "NO_ACCESS"]),
  lat: z.number().optional(),
  lng: z.number().optional(),
  notes: z.string().optional(),
});

export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertWorkOrderAccess(user, id);
  if (denied) return denied;

  const body = await req.json();
  const data = evidenceCreateSchema.parse(body);

  const evidence = await prisma.evidence.create({
    data: {
      workOrderId: id,
      type: data.type,
      imageUrl: data.imageUrl,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      notes: data.notes ?? null,
    },
  });

  // If AFTER evidence and WO has a linked violation, update lifecycle
  if (data.type === "AFTER") {
    const wo = await prisma.workOrder.findUnique({
      where: { id },
      select: { violationId: true },
    });
    if (wo?.violationId) {
      await prisma.violation.update({
        where: { id: wo.violationId },
        data: {
          lifecycleStatus: "EVIDENCE_PENDING",
          evidenceSubmittedAt: new Date(),
        },
      });
    }
  }

  return NextResponse.json(evidence, { status: 201 });
}, "maintenance");

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertWorkOrderAccess(user, id);
  if (denied) return denied;

  const evidence = await prisma.evidence.findMany({
    where: { workOrderId: id },
    orderBy: { capturedAt: "desc" },
  });

  return NextResponse.json(evidence);
}, "maintenance");
