import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { parseRentRollExcel } from "@/lib/parsers/rent-roll.parser";
import { importRentRollData } from "@/lib/services/rent-roll-import.service";

export const POST = withAuth(async (req: NextRequest) => {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const { rows, vacantRows, errors: parseErrors, propertyCodes } = parseRentRollExcel(buffer);

  if (rows.length === 0 && vacantRows.length === 0) {
    return NextResponse.json(
      { error: "No valid tenant or vacant rows found", parseErrors },
      { status: 422 }
    );
  }

  const result = await importRentRollData(rows, vacantRows);

  return NextResponse.json({
    ...result,
    parseErrors,
    propertyCodes,
  });
}, "upload");
