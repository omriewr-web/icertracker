import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { parseARAgingExcel } from "@/lib/parsers/ar-aging.parser";
import { importARAgingData } from "@/lib/services/ar-import.service";
import { startImportLog, completeImportLog } from "@/lib/utils/import-log";

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

  // Parse the Excel file
  const { rows, errors: parseErrors } = parseARAgingExcel(buffer);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No valid rows found", parseErrors },
      { status: 422 }
    );
  }

  // Row count limit: 5000
  if (rows.length > 5000) {
    return NextResponse.json({ error: "Too many rows (max 5000)" }, { status: 413 });
  }

  // Verify all building references belong to user's org
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const orgId = user.organizationId ?? null;

  const allPropertyCodes = [...new Set(rows.map((r) => r.propertyCode).filter(Boolean))];
  if (allPropertyCodes.length > 0 && !isAdmin) {
    if (!orgId) {
      return NextResponse.json({ error: "No organization assigned" }, { status: 403 });
    }
    const orgBuildings = await prisma.building.findMany({
      where: { organizationId: orgId, yardiId: { in: allPropertyCodes } },
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

  // Import into database
  const logId = await startImportLog({ userId: user.id, organizationId: user.organizationId, importType: "ar-aging", fileName: file instanceof File ? file.name : undefined });

  try {
    const result = await importARAgingData(rows, orgId);
    await completeImportLog(logId, result.unmatchedRows?.length ? "COMPLETED_WITH_ERRORS" : "COMPLETED", { rowsInserted: result.created ?? 0, rowsUpdated: result.updated ?? 0, rowsFailed: result.unmatched ?? 0 });

    return NextResponse.json({
      ...result,
      parseErrors,
    });
  } catch (err) {
    await completeImportLog(logId, "FAILED", { rowErrors: [err instanceof Error ? err.message : "Unknown error"] });
    throw err;
  }
}, "upload");
