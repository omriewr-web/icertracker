import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { vendorCreateSchema } from "@/lib/validations";
import { getOrgScope } from "@/lib/data-scope";
import { toNumber } from "@/lib/utils/decimal";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const { searchParams } = new URL(req.url);
  const buildingId = searchParams.get("buildingId");
  const orgScope = getOrgScope(user);

  const where: any = { ...orgScope };
  if (buildingId) {
    where.workOrders = { some: { buildingId } };
  }

  const vendors = await prisma.vendor.findMany({ where, orderBy: { name: "asc" } });
  return NextResponse.json(
    vendors.map((v) => ({
      ...v,
      hourlyRate: v.hourlyRate ? toNumber(v.hourlyRate) : null,
    }))
  );
}, "maintenance");

export const POST = withAuth(async (req, { user }) => {
  const data = await parseBody(req, vendorCreateSchema);
  const vendor = await prisma.vendor.create({
    data: { ...(data as any), organizationId: user.organizationId },
  });
  return NextResponse.json(vendor, { status: 201 });
}, "maintenance");
