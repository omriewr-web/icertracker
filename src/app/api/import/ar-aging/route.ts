import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { parseARAgingExcel } from "@/lib/parsers/ar-aging.parser";
import { importARAgingData } from "@/lib/services/ar-import.service";

export const POST = withAuth(async (req: NextRequest) => {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
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

  // Import into database
  const result = await importARAgingData(rows);

  return NextResponse.json({
    ...result,
    parseErrors,
  });
}, "upload");
