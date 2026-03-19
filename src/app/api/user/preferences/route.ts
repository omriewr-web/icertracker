import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const preferencesUpdateSchema = z.object({
  displayName: z.string().max(100).nullable().optional(),
  jobTitle: z.string().max(100).nullable().optional(),
  mobile: z.string().max(30).nullable().optional(),
  timezone: z.string().max(50).optional(),
  defaultView: z.string().max(50).optional(),
  briefingItems: z.array(z.string()).optional(),
  briefingTime: z.enum(["morning", "midday", "off"]).optional(),
  alertWorkOrderAssigned: z.boolean().optional(),
  alertTenant30Days: z.boolean().optional(),
  alertTenant60Days: z.boolean().optional(),
  alertTenant90Days: z.boolean().optional(),
  alertViolationClassC: z.boolean().optional(),
  alertViolationAll: z.boolean().optional(),
  alertLeaseExpiring30: z.boolean().optional(),
  alertWorkOrderOverdue: z.boolean().optional(),
  alertChannel: z.enum(["in_app", "sms", "both"]).optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().max(10).nullable().optional(),
  quietHoursEnd: z.string().max(10).nullable().optional(),
});

export const GET = withAuth(async (req: NextRequest, { user }) => {
  let prefs = await prisma.userPreferences.findUnique({
    where: { userId: user.id },
  });

  if (!prefs) {
    prefs = await prisma.userPreferences.create({
      data: {
        userId: user.id,
        displayName: user.name || null,
      },
    });
  }

  return NextResponse.json(prefs);
}, "dash");

export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  const body = await req.json();
  const parsed = preferencesUpdateSchema.parse(body);

  // Remove undefined keys so Prisma only updates provided fields
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== undefined) data[key] = value;
  }

  const prefs = await prisma.userPreferences.upsert({
    where: { userId: user.id },
    update: data,
    create: {
      userId: user.id,
      ...data,
    },
  });

  return NextResponse.json(prefs);
}, "dash");
