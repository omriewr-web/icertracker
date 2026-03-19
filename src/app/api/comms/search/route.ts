import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const messages = await prisma.message.findMany({
    where: {
      deletedAt: null,
      body: { contains: q, mode: "insensitive" },
      conversation: {
        orgId: user.organizationId!,
        members: { some: { userId: user.id, leftAt: null } },
      },
    },
    include: {
      conversation: {
        select: {
          id: true,
          title: true,
          type: true,
          relatedEntityType: true,
          relatedEntityId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ results: messages });
}, "dash");
