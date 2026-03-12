import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { assertUnitAccess } from "@/lib/data-scope";
import { unitUpdateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const PATCH = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertUnitAccess(user, id);
  if (denied) return denied;
  const body = await parseBody(req, unitUpdateSchema);
  const unit = await prisma.unit.update({
    where: { id },
    data: {
      ...(body.unitNumber !== undefined && { unitNumber: body.unitNumber }),
      ...(body.unitType !== undefined && { unitType: body.unitType || null }),
      ...(body.isVacant !== undefined && { isVacant: body.isVacant }),
      ...(body.askingRent !== undefined && { askingRent: body.askingRent }),
    },
  });
  return NextResponse.json(unit);
}, "edit");

export const DELETE = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertUnitAccess(user, id);
  if (denied) return denied;

  await prisma.unit.delete({ where: { id } });
  return NextResponse.json({ success: true });
}, "edit");
