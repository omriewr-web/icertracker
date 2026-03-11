import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { parseLegalCasesExcel } from "@/lib/parsers/legal-cases.parser";
import { importLegalCases } from "@/lib/services/legal-import.service";

export const POST = withAuth(async (req: NextRequest) => {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const { rows, errors: parseErrors } = parseLegalCasesExcel(buffer);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No valid legal case rows found", parseErrors },
      { status: 422 }
    );
  }

  const result = await importLegalCases(rows);

  return NextResponse.json({
    ...result,
    parseErrors,
  });
}, "upload");
