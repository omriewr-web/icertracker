import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { noteUpdateSchema } from "@/lib/validations";

export const PATCH = withAuth(async (req, { params }) => {
  const { noteId } = await params;
  const data = await parseBody(req, noteUpdateSchema);
  const note = await prisma.tenantNote.update({
    where: { id: noteId },
    data,
    include: { author: { select: { name: true } } },
  });
  return NextResponse.json(note);
}, "notes");

export const DELETE = withAuth(async (req, { params }) => {
  const { noteId } = await params;
  await prisma.tenantNote.delete({ where: { id: noteId } });
  return NextResponse.json({ success: true });
}, "notes");
