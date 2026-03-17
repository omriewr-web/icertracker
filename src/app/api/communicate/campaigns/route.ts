import { NextRequest, NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createCampaignSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  triggerType: z.enum(["DAYS_10", "DAYS_30", "DAYS_60", "MANUAL"]),
});

export const GET = withAuth(async (_req, { user }) => {
  const campaigns = await prisma.outreachCampaign.findMany({
    where: { orgId: user.organizationId! },
    include: { _count: { select: { messages: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(campaigns);
}, "collections");

export const POST = withAuth(async (req, { user }) => {
  const data = await parseBody(req, createCampaignSchema);
  const campaign = await prisma.outreachCampaign.create({
    data: {
      orgId: user.organizationId!,
      name: data.name,
      triggerType: data.triggerType,
      status: "DRAFT",
    },
  });
  return NextResponse.json(campaign, { status: 201 });
}, "collections");
