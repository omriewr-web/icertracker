import * as XLSX from "xlsx";

export interface ParsedRentRollRow {
  propertyCode: string;
  propertyEntity: string;
  unit: string;
  unitType: string;
  unitCategory: string;
  isResidential: boolean;
  residentId: string;
  tenantName: string;
  marketRent: number;
  chargeAmount: number;
  moveInDate: Date | null;
  leaseExpiration: Date | null;
  moveOutDate: Date | null;
  currentBalance: number;
}

export interface ParsedVacantRow {
  propertyCode: string;
  propertyEntity: string;
  unit: string;
  unitType: string;
  unitCategory: string;
  isResidential: boolean;
  marketRent: number;
}

function num(v: any): number {
  if (v == null || v === "" || v === "NaN") return 0;
  const n = typeof v === "string" ? parseFloat(v.replace(/[$,]/g, "")) : Number(v);
  return isNaN(n) ? 0 : n;
}

function parseDate(v: any): Date | null {
  if (v == null || v === "" || String(v).toLowerCase() === "nan") return null;
  // XLSX may return a serial number for dates
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(d.y, d.m - 1, d.d);
    return null;
  }
  const s = String(v).trim();
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const TENANT_ID_RE = /^t\d+$/i;

/** Unit type classification map: unitType code → { category, isResidential } */
const UNIT_TYPE_MAP: Record<string, { category: string; isResidential: boolean }> = {};

// Commercial
for (const code of ["comm"]) {
  UNIT_TYPE_MAP[code] = { category: "commercial", isResidential: false };
}

// Parking
for (const code of ["6d", "parking7"]) {
  UNIT_TYPE_MAP[code] = { category: "parking", isResidential: false };
}

// Laundry
for (const code of ["laundry"]) {
  UNIT_TYPE_MAP[code] = { category: "laundry", isResidential: false };
}

// Super
for (const code of ["super"]) {
  UNIT_TYPE_MAP[code] = { category: "super", isResidential: false };
}

/**
 * Classify a unit type code into category and isResidential.
 * Known residential prefixes: rs-, fm-, rc-stu, rsstu, rssec8, rsscrie, rs2s8, rss3, fms8-, condo, 211-4b2b, tower
 * Known non-residential: comm, 6d, parking7, laundry, super
 * Default: residential
 */
export function classifyUnitType(unitType: string | null | undefined): { category: string; isResidential: boolean } {
  if (!unitType) return { category: "residential", isResidential: true };
  const lower = unitType.toLowerCase().trim();

  // Check exact match first
  const exact = UNIT_TYPE_MAP[lower];
  if (exact) return exact;

  // All other types default to residential
  return { category: "residential", isResidential: true };
}

export function isResidentialUnitType(unitType: string | null | undefined): boolean {
  return classifyUnitType(unitType).isResidential;
}

/**
 * Extract Yardi property code from a Total row's entity name.
 * col[4] contains e.g. "Icer of 10 West 132nd Street LLC(10w132)"
 * Returns the parenthesized code, or null.
 */
function extractCodeFromTotalRow(col4: string): string | null {
  const m = col4.match(/\(([A-Za-z0-9]{2,20})\)/);
  return m ? m[1].trim() : null;
}

/**
 * Extract clean entity name from Total row col[4], stripping the parenthesized code.
 * e.g. "Icer of 10 West 132nd Street LLC(10w132)" → "Icer of 10 West 132nd Street LLC"
 */
function extractEntityFromTotalRow(col4: string): string {
  return col4.replace(/\([^)]+\)$/, "").trim();
}

/**
 * Detect building section Total rows and map each data row to its property code.
 *
 * Yardi RentRollwithLeaseCharges groups tenants by building:
 *   [tenant rows for building A]
 *   Total row  →  col[3]="Total", col[4]="Entity Name(yardiCode)"
 *   [tenant rows for building B]
 *   Total row  →  col[3]="Total", col[4]="Entity Name(yardiCode)"
 *
 * Strategy: two-pass.
 *  1. Find all Total rows and their line positions + codes.
 *  2. For each tenant row, the next Total row after it determines its building.
 */
function buildSectionMap(
  rawRows: any[][],
  dataStart: number
): { totalRows: { row: number; code: string; entity: string }[]; propertyCodes: string[] } {
  const totalRows: { row: number; code: string; entity: string }[] = [];

  for (let i = dataStart; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r) continue;
    const col3 = String(r[3] ?? "").trim();
    if (col3.toLowerCase() !== "total") continue;

    const col4 = String(r[4] ?? "").trim();
    const code = extractCodeFromTotalRow(col4);
    if (code) {
      const entity = extractEntityFromTotalRow(col4);
      totalRows.push({ row: i, code, entity });
    }
  }

  return {
    totalRows,
    propertyCodes: totalRows.map((t) => t.code),
  };
}

function getSectionForRow(
  rowIndex: number,
  totalRows: { row: number; code: string; entity: string }[]
): { code: string; entity: string } {
  // Yardi places the Total row AFTER the tenant rows for each building section.
  // Find the NEXT Total row after this tenant row — that's the building it belongs to.
  const section = totalRows.find((t) => t.row > rowIndex);
  return section
    ? { code: section.code, entity: section.entity }
    : { code: totalRows[totalRows.length - 1]?.code ?? "", entity: totalRows[totalRows.length - 1]?.entity ?? "" };
}

export function parseRentRollExcel(buffer: Buffer): {
  rows: ParsedRentRollRow[];
  vacantRows: ParsedVacantRow[];
  errors: string[];
  propertyCodes: string[];
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  // Prefer "Report1" sheet, fall back to first sheet
  const sheetName =
    wb.SheetNames.find((n) => n.toLowerCase() === "report1") ??
    wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  });

  const errors: string[] = [];
  const rows: ParsedRentRollRow[] = [];
  const vacantRows: ParsedVacantRow[] = [];

  const DATA_START = 7;

  if (rawRows.length <= DATA_START) {
    errors.push(
      `File has only ${rawRows.length} rows — expected data starting at row ${DATA_START + 1}`
    );
    return { rows, vacantRows, errors, propertyCodes: [] };
  }

  // Detect building sections via Total rows
  const { totalRows, propertyCodes } = buildSectionMap(rawRows, DATA_START);

  if (totalRows.length === 0) {
    errors.push(
      "No building section Total rows found — property codes will be empty"
    );
  }

  for (let i = DATA_START; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.every((v: any) => v === "" || v == null)) continue;

    const col3 = String(r[3] ?? "").trim();
    const col4 = String(r[4] ?? "").trim();

    // ── VACANT row: col[3] === "VACANT" AND col[4] === "VACANT" ──
    if (col3.toUpperCase() === "VACANT" && col4.toUpperCase() === "VACANT") {
      const vacantUnit = String(r[0] ?? "").trim();
      if (!vacantUnit) continue;
      const section = getSectionForRow(i, totalRows);
      const vUnitType = String(r[1] ?? "").trim();
      const { category, isResidential } = classifyUnitType(vUnitType);
      vacantRows.push({
        propertyCode: section.code,
        propertyEntity: section.entity,
        unit: vacantUnit,
        unitType: vUnitType,
        unitCategory: category,
        isResidential,
        marketRent: num(r[5]),
      });
      continue;
    }

    // col[3] = residentId — must start with 't' + digits
    if (!col3 || !TENANT_ID_RE.test(col3)) continue;

    const unit = String(r[0] ?? "").trim();

    if (!unit) {
      errors.push(`Row ${i + 1}: Tenant ${col3} has no unit number — skipped`);
      continue;
    }

    const section = getSectionForRow(i, totalRows);
    const tUnitType = String(r[1] ?? "").trim();
    const { category, isResidential } = classifyUnitType(tUnitType);
    rows.push({
      propertyCode: section.code,
      propertyEntity: section.entity,
      unit,
      unitType: tUnitType,
      unitCategory: category,
      isResidential,
      residentId: col3,
      tenantName: col4,
      marketRent: num(r[5]),
      chargeAmount: num(r[7]),
      moveInDate: parseDate(r[10]),
      leaseExpiration: parseDate(r[11]),
      moveOutDate: parseDate(r[12]),
      currentBalance: num(r[13]),
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push(
      "No tenant rows found (expected resident IDs starting with 't' in column D)"
    );
  }

  return { rows, vacantRows, errors, propertyCodes };
}
