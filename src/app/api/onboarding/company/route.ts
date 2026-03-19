import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const companySchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
});

export const PATCH = withAuth(async (req, { user }) => {
  // Guard: prevent re-running onboarding after completion
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { onboardingComplete: true } });
  if (dbUser?.onboardingComplete) {
    return NextResponse.json({ error: "Onboarding already completed" }, { status: 403 });
  }

  const data = await parseBody(req, companySchema);

  if (!user.organizationId) {
    // Create an organization for the user if none exists
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);

    const org = await prisma.organization.create({
      data: {
        name: data.name,
        slug: `${slug}-${Date.now().toString(36)}`,
        phone: data.phone || null,
        website: data.website || null,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { organizationId: org.id },
    });

    return NextResponse.json(org);
  }

  // Update existing organization
  const org = await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      name: data.name,
      phone: data.phone || null,
      website: data.website || null,
    },
  });

  return NextResponse.json(org);
});
