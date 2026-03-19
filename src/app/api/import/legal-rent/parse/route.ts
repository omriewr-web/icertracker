import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getBuildingIdScope, EMPTY_SCOPE } from "@/lib/data-scope";
import { checkRowLimit } from "@/lib/importer/validateUpload";

export const dynamic = "force-dynamic";

interface ParsedRow {
  rowIndex: number;
  buildingAddress: string | null;
  block: string | null;
  lot: string | null;
  unitNumber: string;
  legalRent: number | null;
  prefRent: number | null;
  isStabilized: boolean | null;
  dhcrId: string | null;
  // Match results
  matchedBuildingId: string | null;
  matchedBuildingAddress: string | null;
  matchedUnitId: string | null;
  matchStatus: "matched" | "building_only" | "no_match";
}

function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\bplace\b/g, "pl")
    .replace(/\broad\b/g, "rd")
    .replace(/\bcourt\b/g, "ct")
    .replace(/\blane\b/g, "ln")
    .replace(/[.,#]/g, "");
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const scope = getBuildingIdScope(user);
  if (scope === EMPTY_SCOPE)
    return NextResponse.json({
      rows: [],
      counts: { matched: 0, buildingOnly: 0, noMatch: 0 },
    });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file)
    return NextResponse.json({ error: "No file provided" }, { status: 400 });

  // File size limit: 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
  }

  // Validate file type
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
    return NextResponse.json(
      { error: "File must be .xlsx or .csv" },
      { status: 400 }
    );
  }

  // Parse file
  const XLSX = await import("xlsx");
  const buffer = Buffer.from(await file.arrayBuffer());
  let wb;
  try {
    wb = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return NextResponse.json({ error: "Failed to parse file. Ensure it is a valid Excel or CSV file." }, { status: 400 });
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws)
    return NextResponse.json({ error: "Empty spreadsheet" }, { status: 400 });

  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (rawRows.length < 2)
    return NextResponse.json(
      { error: "No data rows found" },
      { status: 400 }
    );

  const rowLimitError = checkRowLimit(rawRows.length - 1);
  if (rowLimitError) return rowLimitError;

  // Find header row
  const headers = (rawRows[0] as string[]).map((h) =>
    String(h ?? "")
      .toLowerCase()
      .trim()
  );
  const colMap = {
    address: headers.findIndex(
      (h) => h.includes("address") || h.includes("building")
    ),
    block: headers.findIndex((h) => h === "block"),
    lot: headers.findIndex((h) => h === "lot"),
    unit: headers.findIndex((h) => h.includes("unit")),
    legalRent: headers.findIndex(
      (h) => h.includes("legal") && h.includes("rent")
    ),
    prefRent: headers.findIndex(
      (h) =>
        (h.includes("pref") || h.includes("preferential")) &&
        h.includes("rent")
    ),
    stabilized: headers.findIndex(
      (h) => h.includes("stabilized") || h.includes("regulated")
    ),
    dhcrId: headers.findIndex(
      (h) => h.includes("dhcr") || h.includes("registration")
    ),
  };

  if (colMap.unit === -1)
    return NextResponse.json(
      { error: "Missing required column: Unit Number" },
      { status: 400 }
    );
  if (colMap.legalRent === -1)
    return NextResponse.json(
      { error: "Missing required column: Legal Rent" },
      { status: 400 }
    );

  // Fetch all buildings in scope
  const buildings = await prisma.building.findMany({
    where: scope as object,
    select: {
      id: true,
      address: true,
      altAddress: true,
      block: true,
      lot: true,
    },
  });

  // Build lookup maps
  const buildingsByNormAddr = new Map<string, (typeof buildings)[number]>();
  const buildingsByBlockLot = new Map<string, (typeof buildings)[number]>();
  for (const b of buildings) {
    if (b.address) buildingsByNormAddr.set(normalizeAddress(b.address), b);
    if (b.altAddress)
      buildingsByNormAddr.set(normalizeAddress(b.altAddress), b);
    if (b.block && b.lot) buildingsByBlockLot.set(`${b.block}-${b.lot}`, b);
  }

  // Fetch all units for matched buildings
  const buildingIds = buildings.map((b) => b.id);
  const units = await prisma.unit.findMany({
    where: { buildingId: { in: buildingIds } },
    select: { id: true, buildingId: true, unitNumber: true },
  });
  const unitsByBuilding = new Map<string, Map<string, string>>();
  for (const u of units) {
    if (!unitsByBuilding.has(u.buildingId))
      unitsByBuilding.set(u.buildingId, new Map());
    unitsByBuilding
      .get(u.buildingId)!
      .set(u.unitNumber.toLowerCase().trim(), u.id);
  }

  // Parse data rows
  const rows: ParsedRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];
    if (!row || row.every((c) => c == null || String(c).trim() === ""))
      continue;

    const address =
      colMap.address >= 0 ? String(row[colMap.address] ?? "").trim() : null;
    const block =
      colMap.block >= 0 ? String(row[colMap.block] ?? "").trim() : null;
    const lot = colMap.lot >= 0 ? String(row[colMap.lot] ?? "").trim() : null;
    const unitNumber = String(row[colMap.unit] ?? "").trim();
    const legalRentRaw =
      colMap.legalRent >= 0 ? row[colMap.legalRent] : null;
    const prefRentRaw = colMap.prefRent >= 0 ? row[colMap.prefRent] : null;
    const stabilizedRaw =
      colMap.stabilized >= 0
        ? String(row[colMap.stabilized] ?? "")
            .toLowerCase()
            .trim()
        : null;
    const dhcrId =
      colMap.dhcrId >= 0
        ? String(row[colMap.dhcrId] ?? "").trim() || null
        : null;

    if (!unitNumber) continue;

    const legalRent =
      legalRentRaw != null
        ? parseFloat(String(legalRentRaw).replace(/[$,]/g, ""))
        : null;
    const prefRent =
      prefRentRaw != null
        ? parseFloat(String(prefRentRaw).replace(/[$,]/g, ""))
        : null;
    const isStabilized = stabilizedRaw
      ? ["yes", "true", "y", "1"].includes(stabilizedRaw)
      : null;

    // Match building
    let matchedBuilding: (typeof buildings)[number] | null = null;
    if (address) {
      matchedBuilding =
        buildingsByNormAddr.get(normalizeAddress(address)) ?? null;
    }
    if (!matchedBuilding && block && lot) {
      matchedBuilding = buildingsByBlockLot.get(`${block}-${lot}`) ?? null;
    }

    // Match unit
    let matchedUnitId: string | null = null;
    if (matchedBuilding) {
      const buildingUnits = unitsByBuilding.get(matchedBuilding.id);
      if (buildingUnits) {
        matchedUnitId = buildingUnits.get(unitNumber.toLowerCase()) ?? null;
      }
    }

    const matchStatus =
      matchedBuilding && matchedUnitId
        ? "matched"
        : matchedBuilding
          ? "building_only"
          : "no_match";

    rows.push({
      rowIndex: i,
      buildingAddress: address,
      block,
      lot,
      unitNumber,
      legalRent: isNaN(legalRent ?? NaN) ? null : legalRent,
      prefRent: isNaN(prefRent ?? NaN) ? null : prefRent,
      isStabilized,
      dhcrId,
      matchedBuildingId: matchedBuilding?.id ?? null,
      matchedBuildingAddress: matchedBuilding?.address ?? null,
      matchedUnitId,
      matchStatus,
    });
  }

  const counts = {
    matched: rows.filter((r) => r.matchStatus === "matched").length,
    buildingOnly: rows.filter((r) => r.matchStatus === "building_only").length,
    noMatch: rows.filter((r) => r.matchStatus === "no_match").length,
  };

  return NextResponse.json({ rows, counts });
}, "upload");
