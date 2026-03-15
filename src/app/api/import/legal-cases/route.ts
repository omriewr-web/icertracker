// Permission: "legal" — legal case import is a legal action
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { parseLegalCasesExcel } from "@/lib/parsers/legal-cases.parser";
import { importLegalCases } from "@/lib/services/legal-import.service";

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

  const result = await importLegalCases(rows, user.organizationId!);

  return NextResponse.json({
    ...result,
    parseErrors,
  });
}, "legal");
