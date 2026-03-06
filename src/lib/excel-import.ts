import * as XLSX from "xlsx";

export interface ChargeRow {
  chargeCode: string;
  amount: number;
}

export interface ParsedTenant {
  property: string;
  unit: string;
  unitType?: string;
  residentId?: string;
  name: string;
  marketRent: number;
  chargeCode?: string;
  chargeAmount: number;
  charges: ChargeRow[];
  deposit: number;
  balance: number;
  moveIn?: string;
  leaseExpiration?: string;
  moveOut?: string;
  isVacant: boolean;
}

export interface ParseResult {
  tenants: ParsedTenant[];
  propertyName: string;
  errors: string[];
  format: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function col(row: any, ...keys: string[]): any {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return undefined;
}

function num(v: any): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "string" ? parseFloat(v.replace(/[$,]/g, "")) : Number(v);
  return isNaN(n) ? 0 : n;
}

function dateStr(v: any): string | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v.toISOString().split("T")[0];
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const parsed = new Date(v);
  return isNaN(parsed.getTime()) ? undefined : parsed.toISOString().split("T")[0];
}

/** Normalize a header string for comparison */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

type Format = "yardi-rentroll" | "icer-aging" | "yardi-aging" | "generic";

function detectFormat(
  wb: XLSX.WorkBook,
  sheet: XLSX.WorkSheet,
  rawRows: any[][],
): Format {
  // Check sheet names
  const sheetNames = wb.SheetNames.map((s) => s.toLowerCase());
  if (sheetNames.includes("ar aging")) return "icer-aging";

  // Check first cell for Yardi report signatures
  const a1 = String(rawRows[0]?.[0] ?? "").toLowerCase();
  if (a1.includes("rent roll with lease charges")) return "yardi-rentroll";
  if (a1.includes("aged receivables")) return "yardi-aging";

  // Check for Yardi rent roll without title row (headers in first few rows)
  for (let i = 0; i < Math.min(3, rawRows.length); i++) {
    const vals = rawRows[i]?.map((v: any) => String(v ?? "").trim().toLowerCase()) ?? [];
    if (
      vals[0] === "unit" &&
      (vals.includes("name") || vals.includes("resident")) &&
      (vals.includes("market") || vals.includes("balance") || vals.includes("amount"))
    ) {
      return "yardi-rentroll";
    }
  }

  // Check if first row has clean column headers
  const firstRowKeys = rawRows[0] ?? [];
  const headerStr = firstRowKeys.map((v: any) => norm(String(v))).join(",");
  if (headerStr.includes("property") && headerStr.includes("tenant"))
    return "icer-aging";
  if (headerStr.includes("property") && headerStr.includes("unit"))
    return "generic";

  return "generic";
}

// ---------------------------------------------------------------------------
// Yardi Rent Roll parser
// ---------------------------------------------------------------------------
// Layout:
//   Row 0: "Rent Roll with Lease Charges" (merged)
//   Row 1-3: subtitle rows
//   Row 4: header1  [Unit, Unit Type, Unit, Resident, Name, Market, Charge, Amount, Resident, Other, Move In, Lease, Move Out, Balance]
//   Row 5: header2  ['',   '',        'Sq Ft','',     '',   'Rent', 'Code', '',     'Deposit','Deposit','',    'Expiration','','']
//   Row 6: section label "Current/Notice/Vacant Residents"
//   Row 7+: data rows (unit rows have col[4]=Name, charge rows have col[6]=chargeCode, Total rows)
//   Between properties: Total row with property name at col[4]

function parseYardiRentRoll(
  sheet: XLSX.WorkSheet,
  rawRows: any[][],
): ParseResult {
  const errors: string[] = [];
  const tenants: ParsedTenant[] = [];
  let propertyName = "";
  let currentProperty = "";

  // ── Step 1: Find header row (contains "Unit" and "Name"/"Resident") ──
  let headerStart = -1;
  for (let i = 0; i < Math.min(10, rawRows.length); i++) {
    const vals = rawRows[i]?.map((v: any) => String(v ?? "").trim().toLowerCase()) ?? [];
    if (
      vals.includes("unit") &&
      (vals.includes("name") || vals.includes("resident") || vals.includes("market"))
    ) {
      headerStart = i;
      break;
    }
  }

  if (headerStart === -1) {
    return { tenants, propertyName, errors: ["Could not find Yardi rent roll header row"], format: "yardi-rentroll" };
  }

  // ── Step 2: Combine split headers if next row is a continuation ──
  const row1 = rawRows[headerStart].map((v: any) => String(v ?? "").trim());
  let combined = [...row1];
  let dataStart = headerStart + 1;

  if (headerStart + 1 < rawRows.length) {
    const row2 = rawRows[headerStart + 1]?.map((v: any) => String(v ?? "").trim()) ?? [];
    const continuationWords = ["rent", "deposit", "code", "expiration", "sq ft", "sqft"];
    const hasContinuation = row2.some(
      (v: string) => v && continuationWords.some((w) => v.toLowerCase().includes(w)),
    );
    if (hasContinuation) {
      combined = row1.map((h, i) => {
        const h2 = (row2[i] || "").trim();
        if (!h && !h2) return "";
        if (!h2) return h;
        if (!h) return h2;
        return `${h} ${h2}`;
      });
      dataStart = headerStart + 2;
    }
  }

  // ── Step 3: Build column index map from combined headers ──
  const HEADER_ALIASES: Record<string, string> = {
    "unit": "unit",
    "unit type": "unitType",
    "unit sq ft": "_skip",
    "unit sqft": "_skip",
    "resident": "residentId",
    "resident id": "residentId",
    "name": "name",
    "market rent": "marketRent",
    "market": "marketRent",
    "charge code": "chargeCode",
    "amount": "amount",
    "resident deposit": "deposit",
    "other deposit": "otherDeposit",
    "deposit": "deposit",
    "move in": "moveIn",
    "lease expiration": "leaseExp",
    "lease exp": "leaseExp",
    "move out": "moveOut",
    "balance": "balance",
  };

  const COL: Record<string, number> = {};
  for (let i = 0; i < combined.length; i++) {
    const normalized = combined[i].toLowerCase().trim();
    const field = HEADER_ALIASES[normalized];
    if (field && field !== "_skip" && COL[field] === undefined) {
      COL[field] = i;
    }
  }

  if (COL.unit === undefined || COL.name === undefined) {
    return {
      tenants, propertyName,
      errors: [`Missing required columns: Unit and Name. Found headers: ${combined.filter(Boolean).join(", ")}`],
      format: "yardi-rentroll",
    };
  }

  // ── Step 4: Parse data rows ──
  const SECTION_HEADERS = new Set([
    "current/notice/vacant residents",
    "future residents/applicants",
    "past residents",
    "summary groups",
    "summary of charges by charge code",
    "unit",
  ]);

  let currentTenant: ParsedTenant | null = null;
  const getCol = (r: any[], field: string): any =>
    COL[field] !== undefined ? r[COL[field]] : undefined;

  for (let i = dataStart; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.every((v: any) => v === "" || v === 0 || v == null)) continue;

    const unitVal = String(getCol(r, "unit") ?? "").trim();
    const nameVal = String(getCol(r, "name") ?? "").trim();

    // Skip section headers
    if (SECTION_HEADERS.has(unitVal.toLowerCase())) continue;

    // ── Total row: residentId = "Total", name = building name ──
    const resIdVal = String(getCol(r, "residentId") ?? "").trim();
    if (resIdVal === "Total" && nameVal.length > 3) {
      if (currentTenant) tenants.push(currentTenant);
      currentTenant = null;
      currentProperty = nameVal;

      // Backfill property for tenants without one
      for (let j = tenants.length - 1; j >= 0; j--) {
        if (!tenants[j].property) tenants[j].property = currentProperty;
        else break;
      }
      if (!propertyName) propertyName = currentProperty;
      continue;
    }

    // Skip per-unit total rows (chargeCode column = "Total")
    const chargeCodeVal = String(getCol(r, "chargeCode") ?? "").trim();
    if (chargeCodeVal === "Total" || chargeCodeVal === "Totals:") continue;

    // ── New tenant row: has unit and name ──
    if (unitVal && nameVal && nameVal !== "Total") {
      if (currentTenant) tenants.push(currentTenant);

      const isVacant = !nameVal || nameVal.toLowerCase().includes("vacant");
      const firstCharge: ChargeRow[] =
        COL.chargeCode !== undefined && chargeCodeVal
          ? [{ chargeCode: chargeCodeVal, amount: num(getCol(r, "amount")) }]
          : [];

      currentTenant = {
        property: "",
        unit: unitVal,
        unitType: String(getCol(r, "unitType") ?? "").trim() || undefined,
        residentId: String(getCol(r, "residentId") ?? "").trim() || undefined,
        name: isVacant ? "VACANT" : nameVal,
        marketRent: num(getCol(r, "marketRent")),
        chargeCode: chargeCodeVal || undefined,
        chargeAmount: num(getCol(r, "amount")),
        charges: firstCharge,
        deposit: num(getCol(r, "deposit")),
        balance: num(getCol(r, "balance")),
        moveIn: dateStr(getCol(r, "moveIn")),
        leaseExpiration: dateStr(getCol(r, "leaseExp")),
        moveOut: dateStr(getCol(r, "moveOut")) || undefined,
        isVacant,
      };
      continue;
    }

    // ── Charge-code row (14-col format with chargeCode column) ──
    if (
      currentTenant &&
      !unitVal &&
      COL.chargeCode !== undefined &&
      chargeCodeVal &&
      chargeCodeVal !== "Total"
    ) {
      currentTenant.charges.push({ chargeCode: chargeCodeVal, amount: num(getCol(r, "amount")) });
      currentTenant.chargeAmount += num(getCol(r, "amount"));
      continue;
    }

    // ── Charge-only row (12-col format, no chargeCode column): skip ──
    // Rows with blank unit and only an amount value are charge detail rows
  }

  // Push last tenant
  if (currentTenant) tenants.push(currentTenant);

  // Assign property for any remaining tenants without one
  if (currentProperty) {
    for (const t of tenants) {
      if (!t.property) t.property = currentProperty;
    }
  }

  return { tenants, propertyName, errors, format: "yardi-rentroll" };
}

// ---------------------------------------------------------------------------
// ICER AR Aging parser
// ---------------------------------------------------------------------------
// Clean headers: Property, Unit, Tenant, Resident ID, Market Rent, Legal Rent,
// Pref Rent, Actual Rent, Stabilized, Balance, Aging Bucket, Days Delinquent,
// Months Owed, Lease Status, Legal, Collection Score, Last Note

function parseICERAging(rows: any[]): ParseResult {
  const errors: string[] = [];
  const tenants: ParsedTenant[] = [];
  let propertyName = "";

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const unit = String(
      col(r, "Unit", "unit", "UNIT") ?? "",
    ).trim();
    const name = String(
      col(r, "Tenant", "tenant", "Name", "name") ?? "",
    ).trim();

    if (!unit && !name) continue;
    if (!unit) {
      errors.push(`Row ${i + 2}: missing unit number`);
      continue;
    }

    if (!propertyName) {
      propertyName = String(
        col(r, "Property", "property") ?? "Property",
      ).trim();
    }

    const isVacant =
      !name ||
      name.toLowerCase() === "vacant" ||
      String(col(r, "Status", "status", "Vacant") ?? "")
        .toLowerCase()
        .includes("vacant");

    tenants.push({
      property: String(col(r, "Property", "property") ?? "").trim(),
      unit,
      residentId:
        String(col(r, "Resident ID", "ResidentID", "Resident Id") ?? "").trim() || undefined,
      name: isVacant ? "VACANT" : name,
      marketRent: num(col(r, "Market Rent", "MarketRent", "market_rent")),
      chargeCode: undefined,
      chargeAmount: num(
        col(r, "Actual Rent", "ActualRent", "Charge Amount", "Amount"),
      ),
      charges: [],
      deposit: num(col(r, "Deposit", "deposit", "Security Deposit")),
      balance: num(
        col(r, "Balance", "balance", "BALANCE", "Total Balance"),
      ),
      moveIn: dateStr(col(r, "Move In", "MoveIn", "move_in")),
      leaseExpiration: dateStr(
        col(r, "Lease Expiration", "LeaseExpiration", "Lease Exp", "Lease End"),
      ),
      moveOut: dateStr(col(r, "Move Out", "MoveOut", "move_out")),
      isVacant,
    });
  }

  return { tenants, propertyName, errors, format: "icer-aging" };
}

// ---------------------------------------------------------------------------
// Yardi Aging Summary parser
// ---------------------------------------------------------------------------
// Title rows at top, actual headers in row 3:
// Property, Unit, Resident, Name, Total, 0-30, 31-60, 61-90, Over 90, Prepays, Balance

function parseYardiAging(
  sheet: XLSX.WorkSheet,
  rawRows: any[][],
): ParseResult {
  const errors: string[] = [];
  const tenants: ParsedTenant[] = [];
  let propertyName = "";

  // Find the header row by looking for "Property" and "Unit" in the same row
  let headerIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(20, rawRows.length); i++) {
    const row = rawRows[i];
    if (!row) continue;
    const vals = row.map((v: any) => String(v ?? "").trim().toLowerCase());
    if (vals.includes("property") && vals.includes("unit")) {
      headerIdx = i;
      headers = row.map((v: any) => String(v ?? "").trim());
      break;
    }
  }

  if (headerIdx < 0) {
    return { tenants, propertyName, errors: ["Could not find header row in aging summary"], format: "yardi-aging" };
  }

  // Build column index map
  const colIdx: Record<string, number> = {};
  headers.forEach((h, idx) => {
    colIdx[h.toLowerCase()] = idx;
  });

  const get = (row: any[], key: string): any => {
    const idx = colIdx[key];
    return idx !== undefined ? row[idx] : undefined;
  };

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r) continue;

    const unit = String(get(r, "unit") ?? "").trim();
    const name = String(
      (get(r, "name") ?? get(r, "resident") ?? ""),
    ).trim();

    if (!unit && !name) continue;
    if (!unit) continue;

    const prop = String(get(r, "property") ?? "").trim();
    if (prop && !propertyName) propertyName = prop;

    const isVacant =
      !name ||
      name.toLowerCase() === "vacant";

    tenants.push({
      property: prop,
      unit,
      residentId:
        String(get(r, "resident") ?? "").trim() || undefined,
      name: isVacant ? "VACANT" : name,
      marketRent: 0,
      chargeCode: undefined,
      chargeAmount: 0,
      charges: [],
      deposit: 0,
      balance: num(get(r, "balance") ?? get(r, "total") ?? 0),
      isVacant,
    });
  }

  return { tenants, propertyName, errors, format: "yardi-aging" };
}

// ---------------------------------------------------------------------------
// Generic auto-mapping parser
// ---------------------------------------------------------------------------
// Tries to find a header row and auto-map common column names.

const COLUMN_ALIASES: Record<string, string[]> = {
  property: ["property", "building", "propertycode", "prop", "address", "buildingname", "propertyname", "complex"],
  unit: ["unit", "unitnumber", "unitno", "apt", "apartment", "suite", "space", "unitid"],
  name: ["name", "tenant", "tenantname", "residentname", "resident", "lessee", "occupant", "fullname", "lastname"],
  residentId: ["residentid", "tenantid", "id", "code", "tenantcode", "accountnumber", "account"],
  marketRent: ["marketrent", "rent", "monthlyrent", "currentrent", "contractrent", "scheduledrent", "baserent", "legalrent"],
  chargeAmount: ["chargeamount", "amount", "actualrent", "totalcharges", "charges", "totalrent"],
  deposit: ["deposit", "securitydeposit", "secdep"],
  balance: ["balance", "totalbalance", "amountdue", "due", "owes", "owed", "outstanding", "delinquent", "total", "arbalance", "amountowed"],
  moveIn: ["movein", "moveindate", "movedin", "startdate", "leasestart"],
  leaseExpiration: ["leaseexpiration", "leaseexp", "leaseend", "expirationdate", "leaseenddate", "expiration", "expiry"],
  moveOut: ["moveout", "moveoutdate", "movedout", "enddate"],
  unitType: ["unittype", "type", "style", "bedrooms", "floorplan"],
};

function findHeaderRow(rawRows: any[][]): { headerIdx: number; headers: string[] } {
  // Look for a row that has at least 3 non-empty cells and contains unit/name-like headers
  for (let i = 0; i < Math.min(20, rawRows.length); i++) {
    const row = rawRows[i];
    if (!row) continue;
    const cells = row.map((v: any) => String(v ?? "").trim()).filter(Boolean);
    if (cells.length < 3) continue;

    const normed = cells.map(norm);
    // Must have something that looks like a unit column and a name column
    const hasUnit = normed.some((n) => COLUMN_ALIASES.unit.includes(n));
    const hasName = normed.some((n) =>
      COLUMN_ALIASES.name.includes(n) || COLUMN_ALIASES.property.includes(n),
    );
    if (hasUnit || hasName) {
      return { headerIdx: i, headers: row.map((v: any) => String(v ?? "").trim()) };
    }
  }
  return { headerIdx: -1, headers: [] };
}

function buildColumnMap(
  headers: string[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (let i = 0; i < headers.length; i++) {
      const h = norm(headers[i]);
      if (aliases.includes(h)) {
        map[field] = i;
        break;
      }
    }
  }
  return map;
}

function parseGeneric(rawRows: any[][]): ParseResult {
  const errors: string[] = [];
  const tenants: ParsedTenant[] = [];
  let propertyName = "";

  const { headerIdx, headers } = findHeaderRow(rawRows);
  if (headerIdx < 0) {
    return {
      tenants,
      propertyName,
      errors: ["Could not find a recognizable header row. Expected columns like Unit, Name, Rent, Balance."],
      format: "generic",
    };
  }

  const colMap = buildColumnMap(headers);
  const get = (row: any[], field: string): any => {
    const idx = colMap[field];
    return idx !== undefined ? row[idx] : undefined;
  };

  if (colMap.unit === undefined && colMap.name === undefined) {
    return {
      tenants,
      propertyName,
      errors: ["No 'Unit' or 'Name' column found. Cannot parse tenant records."],
      format: "generic",
    };
  }

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r) continue;

    const unit = String(get(r, "unit") ?? "").trim();
    const name = String(get(r, "name") ?? "").trim();

    if (!unit && !name) continue;
    if (!unit) {
      errors.push(`Row ${i + 1}: missing unit number`);
      continue;
    }

    const prop = String(get(r, "property") ?? "").trim();
    if (prop && !propertyName) propertyName = prop;

    const isVacant =
      !name ||
      name.toLowerCase() === "vacant" ||
      name.toLowerCase().includes("vacant");

    tenants.push({
      property: prop,
      unit,
      unitType: String(get(r, "unitType") ?? "").trim() || undefined,
      residentId: String(get(r, "residentId") ?? "").trim() || undefined,
      name: isVacant ? "VACANT" : name,
      marketRent: num(get(r, "marketRent")),
      chargeCode: undefined,
      chargeAmount: num(get(r, "chargeAmount")),
      charges: [],
      deposit: num(get(r, "deposit")),
      balance: num(get(r, "balance")),
      moveIn: dateStr(get(r, "moveIn")),
      leaseExpiration: dateStr(get(r, "leaseExpiration")),
      moveOut: dateStr(get(r, "moveOut")),
      isVacant,
    });
  }

  return {
    tenants,
    propertyName,
    errors,
    format: "generic (mapped: " + Object.keys(colMap).join(", ") + ")",
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function parseRentRollExcel(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    header: 1,
  });

  const format = detectFormat(wb, sheet, rawRows);

  switch (format) {
    case "yardi-rentroll":
      return parseYardiRentRoll(sheet, rawRows);
    case "icer-aging": {
      // ICER aging has clean headers in row 1, so re-parse with default header mode
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      return parseICERAging(rows);
    }
    case "yardi-aging":
      return parseYardiAging(sheet, rawRows);
    case "generic":
    default:
      return parseGeneric(rawRows);
  }
}
