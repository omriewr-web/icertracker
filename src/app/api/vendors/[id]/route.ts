import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { vendorUpdateSchema } from "@/lib/validations";
import { getOrgScope } from "@/lib/data-scope";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export const PATCH = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const orgScope = getOrgScope(user);

  // Verify vendor belongs to user's org before updating
  const vendor = await prisma.vendor.findFirst({ where: { id, ...orgScope } });
  if (!vendor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = await parseBody(req, vendorUpdateSchema);
  const updateData: Prisma.VendorUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.company !== undefined) updateData.company = data.company;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.specialty !== undefined) updateData.specialty = data.specialty;
  if (data.hourlyRate !== undefined) updateData.hourlyRate = data.hourlyRate;
  if (data.notes !== undefined) updateData.notes = data.notes;
  const updated = await prisma.vendor.update({ where: { id }, data: updateData });
  return NextResponse.json(updated);
}, "maintenance");

export const DELETE = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const orgScope = getOrgScope(user);

  // Verify vendor belongs to user's org before deleting
  const vendor = await prisma.vendor.findFirst({ where: { id, ...orgScope } });
  if (!vendor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.vendor.delete({ where: { id } });
  return NextResponse.json({ success: true });
}, "maintenance");
