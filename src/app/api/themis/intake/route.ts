import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { getBuildingScope, EMPTY_SCOPE, assertBuildingAccess } from "@/lib/data-scope";
import { createIntakeManual, runAIExtraction } from "@/lib/services/themis.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const intakeCreateSchema = z.object({
  source: z.string().default("MANUAL"),
  buildingId: z.string().min(1),
  unitId: z.string().nullable().optional(),
  rawBody: z.string().min(1),
  attachmentUrls: z.array(z.string()).nullable().optional(),
});

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const buildingId = url.searchParams.get("buildingId");

  const scope = getBuildingScope(user, buildingId);
  if (scope === EMPTY_SCOPE) return NextResponse.json([]);

  const where: any = { ...scope };
  if (status) where.status = status;

  const intakes = await prisma.prometheusIntake.findMany({
    where,
    include: { building: { select: { address: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(intakes);
}, "maintenance");

export const POST = withAuth(async (req, { user }) => {
  const data = await parseBody(req, intakeCreateSchema);

  const forbidden = await assertBuildingAccess(user, data.buildingId);
  if (forbidden) return forbidden;

  const intake = await createIntakeManual({
    buildingId: data.buildingId,
    unitId: data.unitId ?? undefined,
    rawBody: data.rawBody,
    attachmentUrls: data.attachmentUrls ?? undefined,
    userId: user.id,
    orgId: user.organizationId ?? undefined,
    source: data.source,
  });

  // Fire-and-forget AI extraction
  runAIExtraction(intake.id).catch((err) => logger.error({ err }, "AI extraction failed"));

  return NextResponse.json(intake, { status: 201 });
}, "maintenance");
