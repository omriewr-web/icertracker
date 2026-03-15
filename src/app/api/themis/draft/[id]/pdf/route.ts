import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { assertBuildingAccess } from "@/lib/data-scope";
import { generateThemisPDF } from "@/lib/themis-pdf";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  if (!["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN", "PM", "APM"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const draft = await prisma.workOrderDraft.findUnique({
    where: { id },
    include: {
      building: { select: { address: true } },
      verifiedBy: { select: { name: true } },
    },
  });

  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  const forbidden = await assertBuildingAccess(user, draft.buildingId);
  if (forbidden) return forbidden;

  const pdfBuffer = await generateThemisPDF(draft);

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="WO-${id}.pdf"`,
    },
  });
}, "maintenance");
