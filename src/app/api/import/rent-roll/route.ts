import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { parseRentRollExcel } from "@/lib/parsers/rent-roll.parser";
import { importRentRollData } from "@/lib/services/rent-roll-import.service";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // File size limit: 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const { rows, vacantRows, errors: parseErrors, propertyCodes } = parseRentRollExcel(buffer);

  if (rows.length === 0 && vacantRows.length === 0) {
    return NextResponse.json(
      { error: "No valid tenant or vacant rows found", parseErrors },
      { status: 422 }
    );
  }

  // Row count limit: 5000
  const totalRows = rows.length + vacantRows.length;
  if (totalRows > 5000) {
    return NextResponse.json({ error: "Too many rows (max 5000)" }, { status: 413 });
  }

  // Verify all building references belong to user's org
  const allPropertyCodes = [...new Set([...rows, ...vacantRows].map((r) => r.propertyCode).filter(Boolean))];
  if (allPropertyCodes.length > 0 && user.role !== "SUPER_ADMIN") {
    const orgBuildings = await prisma.building.findMany({
      where: { organizationId: user.organizationId, yardiId: { in: allPropertyCodes } },
      select: { yardiId: true },
    });
    const orgYardiIds = new Set(orgBuildings.map((b) => b.yardiId));
    const unauthorized = allPropertyCodes.filter((code) => !orgYardiIds.has(code));
    if (unauthorized.length > 0) {
      return NextResponse.json(
        { error: `Buildings not accessible: ${unauthorized.join(", ")}` },
        { status: 403 }
      );
    }
  }

  const result = await importRentRollData(rows, vacantRows, user.organizationId ?? undefined);

  return NextResponse.json({
    ...result,
    parseErrors,
    propertyCodes,
  });
}, "upload");
