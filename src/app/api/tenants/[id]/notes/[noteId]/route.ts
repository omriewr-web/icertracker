import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { noteUpdateSchema } from "@/lib/validations";
import { assertTenantAccess } from "@/lib/data-scope";

export const PATCH = withAuth(async (req, { user, params }) => {
  const { id, noteId } = await params;
  const denied = await assertTenantAccess(user, id);
  if (denied) return denied;

  const data = await parseBody(req, noteUpdateSchema);
  const note = await prisma.tenantNote.update({
    where: { id: noteId },
    data,
    include: { author: { select: { name: true } } },
  });
  return NextResponse.json(note);
}, "notes");

export const DELETE = withAuth(async (req, { user, params }) => {
  const { id, noteId } = await params;
  const denied = await assertTenantAccess(user, id);
  if (denied) return denied;

  const note = await prisma.tenantNote.findUnique({ where: { id: noteId } });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.tenantNote.delete({ where: { id: noteId } });
  return NextResponse.json({ success: true });
}, "notes");
