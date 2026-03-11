import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { vendorCreateSchema } from "@/lib/validations";

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const buildingId = searchParams.get("buildingId");

  // Vendor model has no buildingId — filter by vendors with work orders in that building
  const where = buildingId
    ? { workOrders: { some: { buildingId } } }
    : {};
  const vendors = await prisma.vendor.findMany({ where, orderBy: { name: "asc" } });
  return NextResponse.json(
    vendors.map((v) => ({
      ...v,
      hourlyRate: v.hourlyRate ? Number(v.hourlyRate) : null,
    }))
  );
}, "maintenance");

export const POST = withAuth(async (req) => {
  const data = await parseBody(req, vendorCreateSchema);
  const vendor = await prisma.vendor.create({ data: data as any });
  return NextResponse.json(vendor, { status: 201 });
}, "maintenance");
