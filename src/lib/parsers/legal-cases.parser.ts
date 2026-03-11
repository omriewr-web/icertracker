import * as XLSX from "xlsx";

export interface ParsedLegalCaseRow {
  address: string;
  unit: string;
  tenantName: string;
  caseNumber: string;
  amountOwed: number;
  landlord: string;
  statusNotes: string;
  stage: string;
  datesMentioned: string;
  sourceReport: string;
}

function num(v: any): number {
  if (v == null || v === "" || v === "NaN") return 0;
  const n = typeof v === "string" ? parseFloat(v.replace(/[$,]/g, "")) : Number(v);
  return isNaN(n) ? 0 : n;
}

function normalizeUnit(raw: string): string {
  // "2-B" → "2B", trim whitespace
  return raw.replace(/-/g, "").trim();
}

function firstTenantName(raw: string): string {
  if (!raw) return "";
  // Take first name before comma
  const first = raw.split(",")[0].trim();
  return first;
}

type LegalStageValue =
  | "WARRANT"
  | "STIPULATION"
  | "NONPAYMENT"
  | "EVICTION"
  | "SETTLED"
  | "COURT_DATE"
  | "NOTICE_SENT";

function mapStage(statusNotes: string): LegalStageValue {
  const lower = statusNotes.toLowerCase();
  if (lower.includes("warrant")) return "WARRANT";
  if (lower.includes("stipulation")) return "STIPULATION";
  if (lower.includes("petition")) return "NONPAYMENT";
  if (lower.includes("eviction")) return "EVICTION";
  if (lower.includes("settled") || lower.includes("erap")) return "SETTLED";
  if (
    lower.includes("adjourned") ||
    lower.includes("court date") ||
    lower.includes("court appearance")
  )
    return "COURT_DATE";
  return "NOTICE_SENT";
}

export function parseLegalCasesExcel(buffer: Buffer): {
  rows: ParsedLegalCaseRow[];
  errors: string[];
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  // Try "Cases by Address" sheet, fall back to first sheet
  const sheetName =
    wb.SheetNames.find((n) => n.toLowerCase().includes("cases by address")) ??
    wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  });

  const errors: string[] = [];
  const rows: ParsedLegalCaseRow[] = [];

  if (rawRows.length < 2) {
    errors.push("File has fewer than 2 rows — expected header + data");
    return { rows, errors };
  }

  // Row 0 is header, data starts at row 1
  let lastAddress = "";

  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.every((v: any) => v === "" || v == null)) continue;

    // Address: carry forward if blank
    const rawAddress = String(r[0] ?? "").trim();
    if (rawAddress) lastAddress = rawAddress;
    const address = lastAddress;

    if (!address) {
      errors.push(`Row ${i + 1}: No address available — skipped`);
      continue;
    }

    const unit = normalizeUnit(String(r[1] ?? "").trim());
    const tenantName = firstTenantName(String(r[2] ?? "").trim());
    const caseNumber = String(r[3] ?? "").trim();
    const amountOwed = num(r[4]);
    const landlord = String(r[5] ?? "").trim();
    const statusNotes = String(r[6] ?? "").trim();
    const datesMentioned = String(r[7] ?? "").trim();
    const sourceReport = String(r[8] ?? "").trim();

    if (!caseNumber) {
      errors.push(
        `Row ${i + 1}: Missing case number for "${tenantName}" at "${address}" — skipped`
      );
      continue;
    }

    rows.push({
      address,
      unit,
      tenantName,
      caseNumber,
      amountOwed,
      landlord,
      statusNotes,
      stage: mapStage(statusNotes),
      datesMentioned,
      sourceReport,
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push("No valid legal case rows found");
  }

  return { rows, errors };
}
