import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: NextRequest, { user }) => {
  const logs = await prisma.importLog.findMany({
    where: {
      organizationId: user.organizationId,
    },
    orderBy: { startedAt: "desc" },
    take: 50,
    select: {
      id: true,
      importType: true,
      fileName: true,
      parserUsed: true,
      totalRows: true,
      rowsInserted: true,
      rowsUpdated: true,
      rowsSkipped: true,
      rowsFailed: true,
      status: true,
      startedAt: true,
    },
  });

  return NextResponse.json(logs);
}, "upload");
