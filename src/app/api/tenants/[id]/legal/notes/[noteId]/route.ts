// Permission: "legal" — legal note deletion
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { assertTenantAccess } from "@/lib/data-scope";

export const DELETE = withAuth(async (req, { user, params }) => {
  const { id, noteId } = await params;
  const denied = await assertTenantAccess(user, id);
  if (denied) return denied;

  const note = await prisma.legalNote.findUnique({ where: { id: noteId } });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.legalNote.delete({ where: { id: noteId } });
  return NextResponse.json({ success: true });
}, "legal");
