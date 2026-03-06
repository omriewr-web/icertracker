import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { noteCreateSchema } from "@/lib/validations";
import { assertTenantAccess } from "@/lib/data-scope";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertTenantAccess(user, id);
  if (denied) return denied;

  const notes = await prisma.tenantNote.findMany({
    where: { tenantId: id },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(notes);
});

export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertTenantAccess(user, id);
  if (denied) return denied;

  const data = await parseBody(req, noteCreateSchema);
  const note = await prisma.tenantNote.create({
    data: { tenantId: id, authorId: user.id, text: data.text, category: data.category },
    include: { author: { select: { name: true } } },
  });
  return NextResponse.json(note, { status: 201 });
}, "notes");
