import { NextRequest, NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createCollectionNote } from "@/lib/services/collections.service";
import { canAccessBuilding } from "@/lib/data-scope";
import { collectionNoteCreateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  const { tenantId } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { unit: { select: { buildingId: true } } },
  });
  if (!tenant) return NextResponse.json([], { status: 200 });
  if (!(await canAccessBuilding(user, tenant.unit.buildingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const notes = await prisma.tenantNote.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });

  return NextResponse.json(notes);
}, "collections");

export const POST = withAuth(async (req, { user, params }) => {
  const { tenantId } = await params;
  const { content, actionType, followUpDate } = await parseBody(req, collectionNoteCreateSchema);

  const note = await createCollectionNote(user, tenantId, {
    content,
    actionType: actionType as any,
    followUpDate: followUpDate ? new Date(followUpDate) : undefined,
  });

  return NextResponse.json(note, { status: 201 });
}, "collections");
