import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { assertBuildingAccess } from "@/lib/data-scope";
import { findSimilarWorkOrders, runAIReview, enrichWithPortfolioContext, analyzeNYCLegalExposure, generateTenantResponseEmail, autoLinkViolations } from "@/lib/services/themis.service";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const draftCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(["PLUMBING", "ELECTRICAL", "HVAC", "APPLIANCE", "GENERAL", "OTHER"]).default("GENERAL"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  trade: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  vendorId: z.string().nullable().optional(),
  scheduledDate: z.string().nullable().optional(),
  incidentDate: z.string().nullable().optional(),
  accessAttempts: z.array(z.object({
    date: z.string(),
    result: z.string(),
    notes: z.string().optional(),
  })).nullable().optional(),
});

export const POST = withAuth(async (req, { user, params }) => {
  const { id: intakeId } = await params;
  const data = await parseBody(req, draftCreateSchema);

  const intake = await prisma.prometheusIntake.findUnique({
    where: { id: intakeId },
    select: { id: true, buildingId: true, unitId: true, tenantId: true, organizationId: true, attachmentUrls: true, extractedIssue: true, extractedUnit: true, extractedContact: true, rawBody: true },
  });

  if (!intake) return NextResponse.json({ error: "Intake not found" }, { status: 404 });
  if (!intake.buildingId) return NextResponse.json({ error: "Intake has no building" }, { status: 400 });

  const forbidden = await assertBuildingAccess(user, intake.buildingId);
  if (forbidden) return forbidden;

  // Upsert draft for this intake
  const draft = await prisma.workOrderDraft.upsert({
    where: { intakeId },
    create: {
      intakeId,
      organizationId: intake.organizationId,
      buildingId: intake.buildingId,
      unitId: intake.unitId,
      tenantId: intake.tenantId,
      title: data.title,
      description: data.description,
      category: data.category as any,
      priority: data.priority as any,
      trade: data.trade ?? null,
      assignedToId: data.assignedToId ?? null,
      vendorId: data.vendorId ?? null,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
      incidentDate: data.incidentDate ? new Date(data.incidentDate) : null,
      accessAttempts: data.accessAttempts ?? Prisma.JsonNull,
      photoUrls: intake.attachmentUrls ?? Prisma.JsonNull,
    },
    update: {
      title: data.title,
      description: data.description,
      category: data.category as any,
      priority: data.priority as any,
      trade: data.trade ?? null,
      assignedToId: data.assignedToId ?? null,
      vendorId: data.vendorId ?? null,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
      incidentDate: data.incidentDate ? new Date(data.incidentDate) : null,
      accessAttempts: data.accessAttempts ?? Prisma.JsonNull,
    },
  });

  // Find similar work orders
  const similarWOs = await findSimilarWorkOrders(intake.buildingId, data.category, data.description);
  await prisma.workOrderDraft.update({
    where: { id: draft.id },
    data: { similarWOIds: similarWOs.map((w) => w.id) },
  });

  // Run AI review
  const review = await runAIReview(draft.id);

  // Portfolio context enrichment
  const portfolioContext = await enrichWithPortfolioContext(intakeId);

  // NYC legal exposure analysis
  const exposure = analyzeNYCLegalExposure(intake.extractedIssue, portfolioContext);

  // Generate tenant response email
  const suggestedResponseEmail = await generateTenantResponseEmail(intake, exposure, portfolioContext);

  // Auto-link violations
  const violationLinks = await autoLinkViolations(draft.id, portfolioContext, intake.extractedIssue);

  // Filter linked violations from portfolio context
  const linkedViolations = portfolioContext.openViolations.filter((v) =>
    violationLinks.linkedViolationIds.includes(v.id),
  );

  return NextResponse.json({
    draft: { ...draft, similarWOIds: similarWOs.map((w) => w.id), flaggedIssues: review.flaggedIssues },
    similarWorkOrders: similarWOs,
    review,
    portfolioContext,
    exposure,
    suggestedResponseEmail,
    linkedViolations,
  }, { status: 201 });
}, "maintenance");
