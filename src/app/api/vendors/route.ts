import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { vendorCreateSchema } from "@/lib/validations";
import { getOrgScope } from "@/lib/data-scope";
import { toNumber } from "@/lib/utils/decimal";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const { searchParams } = new URL(req.url);
  const buildingId = searchParams.get("buildingId");
  const orgScope = getOrgScope(user);

  const where: any = { ...orgScope };
  if (buildingId) {
    where.workOrders = { some: { buildingId } };
  }

  const vendors = await prisma.vendor.findMany({ where, orderBy: { name: "asc" }, take: 200 });
  return NextResponse.json(
    vendors.map((v) => ({
      ...v,
      hourlyRate: v.hourlyRate ? toNumber(v.hourlyRate) : null,
    }))
  );
}, "maintenance");

export const POST = withAuth(async (req, { user }) => {
  const data = await parseBody(req, vendorCreateSchema);
  const createData: Prisma.VendorUncheckedCreateInput = {
    name: data.name,
    company: data.company ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    specialty: data.specialty ?? null,
    hourlyRate: data.hourlyRate ?? null,
    notes: data.notes ?? null,
    organizationId: user.organizationId ?? null,
  };
  const vendor = await prisma.vendor.create({ data: createData });
  return NextResponse.json(vendor, { status: 201 });
}, "maintenance");
