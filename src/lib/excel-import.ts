import * as XLSX from "xlsx";

export interface ParsedTenant {
  property: string;
  unit: string;
  unitType?: string;
  residentId?: string;
  name: string;
  marketRent: number;
  chargeCode?: string;
  chargeAmount: number;
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

  // Column indices based on the known Yardi Rent Roll layout
  const COL = {
    unit: 0,
    unitType: 1,
    residentId: 3,
    name: 4,
    marketRent: 5,
    chargeCode: 6,
    amount: 7,
    deposit: 8,
    otherDeposit: 9,
    moveIn: 10,
    leaseExp: 11,
    moveOut: 12,
    balance: 13,
  };

  let currentTenant: ParsedTenant | null = null;

  for (let i = 6; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.every((v: any) => v === "" || v === 0 || v == null)) continue;

    const col0 = String(r[COL.unit] ?? "").trim();
    const col4 = String(r[COL.name] ?? "").trim();
    const col6 = String(r[COL.chargeCode] ?? "").trim();

    // Skip section headers
    if (
      col0 === "Current/Notice/Vacant Residents" ||
      col0 === "Future Residents/Applicants" ||
      col0 === "Past Residents" ||
      col0 === "Summary Groups" ||
      col0 === "Summary of Charges by Charge Code" ||
      col0 === "Unit" // repeated header
    )
      continue;

    // Property total row: col[3]="Total", col[4]=property name
    const col3 = String(r[3] ?? "").trim();
    if (col3 === "Total" && col4 && col4.length > 3) {
      currentProperty = col4;
      // Update all tenants that don't have a property set yet
      for (let j = tenants.length - 1; j >= 0; j--) {
        if (!tenants[j].property) tenants[j].property = currentProperty;
        else break;
      }
      if (!propertyName) propertyName = currentProperty;
      continue;
    }

    // Per-unit total row: col6 = "Total" (skip)
    if (col6 === "Total" || col6 === "Totals:") continue;

    // New tenant row: has unit number in col0 and name in col4
    if (col0 && col4 && col4 !== "Total") {
      // Save previous tenant
      if (currentTenant) tenants.push(currentTenant);

      const isVacant =
        !col4 ||
        col4.toLowerCase() === "vacant" ||
        col4.toLowerCase().includes("vacant");

      currentTenant = {
        property: "", // filled in when we hit the property Total row
        unit: col0,
        unitType: String(r[COL.unitType] ?? "").trim() || undefined,
        residentId:
          String(r[COL.residentId] ?? "").trim() || undefined,
        name: isVacant ? "VACANT" : col4,
        marketRent: num(r[COL.marketRent]),
        chargeCode: col6 || undefined,
        chargeAmount: num(r[COL.amount]),
        deposit: num(r[COL.deposit]),
        balance: num(r[COL.balance]),
        moveIn: dateStr(r[COL.moveIn]),
        leaseExpiration: dateStr(r[COL.leaseExp]),
        moveOut: dateStr(r[COL.moveOut]) || undefined,
        isVacant,
      };
      continue;
    }

    // Additional charge-code row for the current tenant (same tenant, different charge)
    if (
      currentTenant &&
      !col0 &&
      col6 &&
      col6 !== "Total"
    ) {
      // Add charge amount to running total
      currentTenant.chargeAmount += num(r[COL.amount]);
      continue;
    }
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
