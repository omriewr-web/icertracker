// Permission: "legal" — legal case history
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { assertTenantAccess } from "@/lib/data-scope";

// GET — all legal cases for a tenant (history), newest first
export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertTenantAccess(user, id);
  if (denied) return denied;

  const cases = await prisma.legalCase.findMany({
    where: { tenantId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      stage: true,
      caseNumber: true,
      attorney: true,
      filedDate: true,
      courtDate: true,
      arrearsBalance: true,
      status: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      assignedUser: { select: { name: true } },
      attorneyContact: { select: { name: true, company: true } },
    },
  });

  return NextResponse.json({ cases });
}, "legal");
