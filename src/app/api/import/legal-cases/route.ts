// Permission: "legal" — legal case import is a legal action
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { parseLegalCasesExcel } from "@/lib/parsers/legal-cases.parser";
import { importLegalCases } from "@/lib/services/legal-import.service";
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

  const { rows, errors: parseErrors } = parseLegalCasesExcel(buffer);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No valid legal case rows found", parseErrors },
      { status: 422 }
    );
  }

  // Row count limit: 5000
  if (rows.length > 5000) {
    return NextResponse.json({ error: "Too many rows (max 5000)" }, { status: 413 });
  }

  const logId = await startImportLog({ userId: user.id, organizationId: user.organizationId, importType: "legal-cases-v2", fileName: file instanceof File ? file.name : undefined });

  try {
    if (!user.organizationId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 });
    }
    const result = await importLegalCases(rows, user.organizationId);
    await completeImportLog(logId, result.errors?.length ? "COMPLETED_WITH_ERRORS" : "COMPLETED", { rowsInserted: result.imported ?? 0, rowsFailed: result.errors?.length ?? 0, rowErrors: result.errors });

    return NextResponse.json({
      ...result,
      parseErrors,
    });
  } catch (err) {
    await completeImportLog(logId, "FAILED", { rowErrors: [err instanceof Error ? err.message : "Unknown error"] });
    throw err;
  }
}, "legal");
