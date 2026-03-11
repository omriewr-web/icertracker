import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { parseRentRollExcel } from "@/lib/parsers/rent-roll.parser";
import { parseARAgingExcel } from "@/lib/parsers/ar-aging.parser";
import { parseLegalCasesExcel } from "@/lib/parsers/legal-cases.parser";

export interface DetectResult {
  detected: boolean;
  fileType: "rent_roll" | "ar_aging" | "legal_cases" | "unknown";
  label: string;
  description: string;
  rowCount: number;
  buildingCount: number;
  parseErrors: string[];
}

/**
 * Tries each specialized parser to detect the file type.
 * Returns metadata about the detected format without importing anything.
 */
export const POST = withAuth(async (req: NextRequest) => {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Try rent roll first (most common)
  try {
    const rr = parseRentRollExcel(buffer);
    if (rr.rows.length > 0 || rr.vacantRows.length > 0) {
      const allRows = [...rr.rows, ...rr.vacantRows];
      const buildings = new Set(allRows.map((r) => r.propertyCode).filter(Boolean));
      const vacantCount = rr.vacantRows.length;
      const desc = vacantCount > 0
        ? `${rr.rows.length} tenant rows + ${vacantCount} vacant units across ${buildings.size} building${buildings.size !== 1 ? "s" : ""}`
        : `${rr.rows.length} tenant rows across ${buildings.size} building${buildings.size !== 1 ? "s" : ""}`;
      return NextResponse.json({
        detected: true,
        fileType: "rent_roll",
        label: "Yardi Rent Roll",
        description: desc,
        rowCount: rr.rows.length + vacantCount,
        buildingCount: buildings.size,
        parseErrors: rr.errors,
      } satisfies DetectResult);
    }
  } catch {
    // Not a rent roll — try next
  }

  // Try AR aging
  try {
    const ar = parseARAgingExcel(buffer);
    if (ar.rows.length > 0) {
      const buildings = new Set(ar.rows.map((r) => r.propertyCode).filter(Boolean));
      return NextResponse.json({
        detected: true,
        fileType: "ar_aging",
        label: "Yardi AR Aging Report",
        description: `${ar.rows.length} tenant rows across ${buildings.size} building${buildings.size !== 1 ? "s" : ""}`,
        rowCount: ar.rows.length,
        buildingCount: buildings.size,
        parseErrors: ar.errors,
      } satisfies DetectResult);
    }
  } catch {
    // Not AR aging — try next
  }

  // Try legal cases
  try {
    const lc = parseLegalCasesExcel(buffer);
    if (lc.rows.length > 0) {
      const addresses = new Set(lc.rows.map((r) => r.address).filter(Boolean));
      return NextResponse.json({
        detected: true,
        fileType: "legal_cases",
        label: "Legal Cases Report",
        description: `${lc.rows.length} legal cases across ${addresses.size} building${addresses.size !== 1 ? "s" : ""}`,
        rowCount: lc.rows.length,
        buildingCount: addresses.size,
        parseErrors: lc.errors,
      } satisfies DetectResult);
    }
  } catch {
    // Not legal cases
  }

  return NextResponse.json({
    detected: false,
    fileType: "unknown",
    label: "Unrecognized Format",
    description: "Could not detect the file type",
    rowCount: 0,
    buildingCount: 0,
    parseErrors: [
      "File format not recognized. Supported formats: Yardi Rent Roll (RentRollwithLeaseCharges), Yardi AR Aging (AgingSummary), Legal Cases (Cases by Address).",
    ],
  } satisfies DetectResult);
}, "upload");
