import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { getOrgScope } from "@/lib/data-scope";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  complete: boolean;
  optional: boolean;
  actionHref: string;
  actionLabel: string;
}

export interface OnboardingStatusResponse {
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  requiredComplete: boolean;
  percentComplete: number;
}

export const GET = withAuth(async (_req, { user }) => {
  const orgId = user.organizationId;

  // Parallel count queries scoped to org
  const [org, buildingCount, unitCount, tenantCount, violationCount, userCount] =
    await Promise.all([
      orgId
        ? prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } })
        : null,
      orgId
        ? prisma.building.count({ where: { organizationId: orgId } })
        : 0,
      orgId
        ? prisma.unit.count({ where: { building: { organizationId: orgId } } })
        : 0,
      orgId
        ? prisma.tenant.count({ where: { unit: { building: { organizationId: orgId } } } })
        : 0,
      orgId
        ? prisma.violation.count({ where: { building: { organizationId: orgId } } })
        : 0,
      orgId
        ? prisma.user.count({ where: { organizationId: orgId } })
        : 0,
    ]);

  const steps: OnboardingStep[] = [
    {
      id: "org-setup",
      title: "Organization Setup",
      description: "Set up your organization name and details to get started.",
      complete: !!(org && org.name && org.name.trim().length > 0),
      optional: false,
      actionHref: "/data",
      actionLabel: "Go to Settings",
    },
    {
      id: "add-building",
      title: "Add First Building",
      description: "Add at least one building to your portfolio.",
      complete: buildingCount >= 1,
      optional: false,
      actionHref: "/data",
      actionLabel: "Import Building",
    },
    {
      id: "import-units",
      title: "Import Units",
      description: "Import or create units for your buildings.",
      complete: unitCount >= 1,
      optional: false,
      actionHref: "/data",
      actionLabel: "Import Units",
    },
    {
      id: "add-tenant",
      title: "Add First Tenant",
      description: "Add at least one tenant to track rent and collections.",
      complete: tenantCount >= 1,
      optional: false,
      actionHref: "/data",
      actionLabel: "Import Tenants",
    },
    {
      id: "import-violations",
      title: "Import Violations",
      description: "Sync HPD/DOB violations to track compliance.",
      complete: violationCount >= 1,
      optional: true,
      actionHref: "/compliance",
      actionLabel: "Sync Violations",
    },
    {
      id: "invite-team",
      title: "Invite Team Member",
      description: "Add another user to collaborate on property management.",
      complete: userCount >= 2,
      optional: true,
      actionHref: "/users",
      actionLabel: "Invite User",
    },
  ];

  const completedCount = steps.filter((s) => s.complete).length;
  const totalCount = steps.length;
  const requiredSteps = steps.filter((s) => !s.optional);
  const requiredComplete = requiredSteps.every((s) => s.complete);
  const percentComplete = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const response: OnboardingStatusResponse = {
    steps,
    completedCount,
    totalCount,
    requiredComplete,
    percentComplete,
  };

  return NextResponse.json(response);
}, "dash");
