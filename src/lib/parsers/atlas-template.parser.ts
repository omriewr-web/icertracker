import * as XLSX from "xlsx";
import type { ParseResult, ParseError } from "./types";
import {
  buildingRowSchema, unitRowSchema, tenantRowSchema, workOrderRowSchema,
  legalCaseRowSchema, vendorRowSchema, arBalanceRowSchema, utilityRowSchema,
} from "./types";

// Column header signatures for each template type
const TEMPLATE_SIGNATURES: Record<string, { required: string[]; schema: any; parserName: string }> = {
  buildings: {
    required: ["address", "borough"],
    schema: buildingRowSchema,
    parserName: "atlas-buildings",
  },
  units: {
    required: ["building address", "unit number", "bedrooms"],
    schema: unitRowSchema,
    parserName: "atlas-units",
  },
  tenants: {
    required: ["building address", "unit number", "first name", "last name"],
    schema: tenantRowSchema,
    parserName: "atlas-tenants",
  },
  workorders: {
    required: ["building address", "title", "priority"],
    schema: workOrderRowSchema,
    parserName: "atlas-work-orders",
  },
  legal: {
    required: ["building address", "unit number", "tenant name", "legal stage"],
    schema: legalCaseRowSchema,
    parserName: "atlas-legal-cases",
  },
  vendors: {
    required: ["company name", "trade"],
    schema: vendorRowSchema,
    parserName: "atlas-vendors",
  },
  arbalance: {
    required: ["building address", "unit number", "tenant name", "total balance"],
    schema: arBalanceRowSchema,
    parserName: "atlas-ar-balance",
  },
  utilities: {
    required: ["building address", "provider"],
    schema: utilityRowSchema,
    parserName: "atlas-utilities",
  },
};

function normalizeHeader(h: string): string {
  return String(h).toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
}

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "string" ? parseFloat(v.replace(/[$,]/g, "")) : Number(v);
  return isNaN(n) ? undefined : n;
}

function str(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  return String(v).trim();
}

function dateStr(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return String(v).trim();
}

function boolVal(v: unknown): boolean | undefined {
  if (v == null || v === "") return undefined;
  const s = String(v).toLowerCase().trim();
  if (s === "yes" || s === "true" || s === "1" || s === "y") return true;
  if (s === "no" || s === "false" || s === "0" || s === "n") return false;
  return undefined;
}

export function parseAtlasTemplate(buffer: Buffer): ParseResult | null {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return null;

  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rawRows.length < 2) return null;

  const headers = (rawRows[0] as string[]).map(normalizeHeader);

  // Detect which template this is
  let matchedType: string | null = null;
  let bestMatch = 0;

  for (const [type, sig] of Object.entries(TEMPLATE_SIGNATURES)) {
    const matched = sig.required.filter((r) => headers.some((h) => h.includes(r))).length;
    const score = matched / sig.required.length;
    if (score > bestMatch) {
      bestMatch = score;
      matchedType = type;
    }
  }

  if (!matchedType || bestMatch < 0.8) return null;

  const sig = TEMPLATE_SIGNATURES[matchedType];
  const errors: ParseError[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown>[] = [];

  // Map headers to column indices
  const colMap = new Map<string, number>();
  headers.forEach((h, i) => { colMap.set(h, i); });

  function get(row: unknown[], ...candidates: string[]): unknown {
    for (const c of candidates) {
      for (const [h, i] of colMap.entries()) {
        if (h.includes(c)) return row[i];
      }
    }
    return undefined;
  }

  // Parse data rows (skip header, skip example row if it looks like example data)
  const startRow = rawRows.length > 2 && String(rawRows[1]?.[0] || "").includes("123 Main") ? 2 : 1;

  for (let i = startRow; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];
    if (!row || row.every((c) => c == null || c === "")) continue; // skip blank rows

    try {
      let parsed: Record<string, unknown>;

      switch (matchedType) {
        case "buildings":
          parsed = {
            address: str(get(row, "address")),
            borough: str(get(row, "borough")),
            block: str(get(row, "block")),
            lot: str(get(row, "lot")),
            totalUnits: num(get(row, "total units")),
            buildingType: str(get(row, "building type")),
            portfolio: str(get(row, "portfolio")),
            yearBuilt: num(get(row, "year built")),
            hpdRegistration: str(get(row, "hpd")),
          };
          break;
        case "units":
          parsed = {
            buildingAddress: str(get(row, "building address")),
            unitNumber: str(get(row, "unit number")),
            bedrooms: num(get(row, "bedroom")),
            bathrooms: num(get(row, "bathroom")),
            sqFt: num(get(row, "sq ft")),
            legalRent: num(get(row, "legal rent")),
            marketRent: num(get(row, "market rent")),
            prefRent: num(get(row, "preferential")),
            status: str(get(row, "status")),
            rentStabilized: boolVal(get(row, "stabilized")),
          };
          break;
        case "tenants":
          parsed = {
            buildingAddress: str(get(row, "building address")),
            unitNumber: str(get(row, "unit number")),
            firstName: str(get(row, "first name")),
            lastName: str(get(row, "last name")),
            email: str(get(row, "email")),
            phone: str(get(row, "phone")),
            leaseStart: dateStr(get(row, "lease start")),
            leaseEnd: dateStr(get(row, "lease end")),
            monthlyRent: num(get(row, "monthly rent")),
            securityDeposit: num(get(row, "security deposit")),
            balance: num(get(row, "balance")),
            moveInDate: dateStr(get(row, "move in")),
          };
          break;
        case "workorders":
          parsed = {
            buildingAddress: str(get(row, "building address")),
            unitNumber: str(get(row, "unit number")),
            title: str(get(row, "title")),
            description: str(get(row, "description")),
            priority: str(get(row, "priority")),
            category: str(get(row, "category")),
            status: str(get(row, "status")),
            assignedTo: str(get(row, "assigned")),
            createdDate: dateStr(get(row, "created")),
            completedDate: dateStr(get(row, "completed")),
            cost: num(get(row, "cost")),
          };
          break;
        case "legal":
          parsed = {
            buildingAddress: str(get(row, "building address")),
            unitNumber: str(get(row, "unit number")),
            tenantName: str(get(row, "tenant name")),
            balance: num(get(row, "balance")),
            legalStage: str(get(row, "legal stage", "stage")),
            attorneyName: str(get(row, "attorney")),
            filedDate: dateStr(get(row, "filed")),
            nextCourtDate: dateStr(get(row, "court date")),
            indexNumber: str(get(row, "index")),
            notes: str(get(row, "notes")),
          };
          break;
        case "vendors":
          parsed = {
            companyName: str(get(row, "company name")),
            contactName: str(get(row, "contact name")),
            phone: str(get(row, "phone")),
            email: str(get(row, "email")),
            trade: str(get(row, "trade")),
            licenseNumber: str(get(row, "license")),
            insuranceExpiry: dateStr(get(row, "insurance")),
            notes: str(get(row, "notes")),
          };
          break;
        case "arbalance":
          parsed = {
            buildingAddress: str(get(row, "building address")),
            unitNumber: str(get(row, "unit number")),
            tenantName: str(get(row, "tenant name")),
            days0_30: num(get(row, "0-30", "030")),
            days30_60: num(get(row, "30-60", "3060")),
            days60_90: num(get(row, "60-90", "6090")),
            days90_120: num(get(row, "90-120", "90120")),
            days120Plus: num(get(row, "120")),
            totalBalance: num(get(row, "total balance")),
            lastPaymentDate: dateStr(get(row, "last payment date")),
            lastPaymentAmount: num(get(row, "last payment amount")),
          };
          break;
        case "utilities":
          parsed = {
            buildingAddress: str(get(row, "building address")),
            provider: str(get(row, "provider")),
            accountNumber: str(get(row, "account")),
            meterNumber: str(get(row, "meter")),
            serviceAddress: str(get(row, "service address")),
            notes: str(get(row, "notes")),
          };
          break;
        default:
          continue;
      }

      const result = sig.schema.safeParse(parsed);
      if (result.success) {
        data.push(result.data);
      } else {
        for (const issue of result.error.issues) {
          errors.push({
            row: i + 1,
            field: issue.path.join("."),
            reason: issue.message,
          });
        }
      }
    } catch {
      errors.push({ row: i + 1, field: "row", reason: "Failed to parse row" });
    }
  }

  return {
    success: errors.length === 0 || data.length > 0,
    parserUsed: sig.parserName,
    confidence: bestMatch >= 1.0 ? 99 : 85,
    data,
    errors,
    warnings,
  };
}
