// NYC Open Data (Socrata) integration for violation fetching

const SOCRATA_BASE = "https://data.cityofnewyork.us/resource";

export const ENDPOINTS: Record<string, string> = {
  HPD: "wvxf-dwi5",
  DOB: "3h2n-5cm9",
  ECB: "6bgk-3dad",
  HPD_COMPLAINTS: "ygpa-z7cr",
};

export const BORO_MAP: Record<string, string> = {
  MANHATTAN: "1",
  "NEW YORK": "1",
  BRONX: "2",
  BROOKLYN: "3",
  QUEENS: "4",
  "STATEN ISLAND": "5",
};

const ZIP_BORO: Record<string, string> = {
  // Manhattan
  "100": "1", "101": "1", "102": "1",
  // Bronx
  "104": "2",
  // Brooklyn
  "112": "3",
  // Queens
  "110": "4", "111": "4", "113": "4", "114": "4", "116": "4",
  // Staten Island
  "103": "5",
};

export function detectBoroId(address: string, zip?: string | null): string | null {
  const upper = address.toUpperCase();
  for (const [name, id] of Object.entries(BORO_MAP)) {
    if (upper.includes(name)) return id;
  }
  if (zip) {
    const prefix = zip.substring(0, 3);
    if (ZIP_BORO[prefix]) return ZIP_BORO[prefix];
  }
  return null;
}

// Pad block to 5 digits, lot to 4 digits (NYC standard)
function padBlock(block: string): string {
  return block.replace(/^0+/, "").padStart(5, "0");
}
function padLot(lot: string): string {
  return lot.replace(/^0+/, "").padStart(4, "0");
}

export interface FetchResult {
  rows: any[];
  url: string;
  status: number;
  error?: string;
}

async function socrataFetch(
  endpoint: string,
  params: Record<string, string>,
  limit = 200
): Promise<FetchResult> {
  const url = new URL(`${SOCRATA_BASE}/${endpoint}.json`);
  for (const [key, val] of Object.entries(params)) {
    url.searchParams.set(key, val);
  }
  url.searchParams.set("$limit", String(limit));

  const finalUrl = url.toString();
  console.log(`[NYC Open Data] Fetching: ${finalUrl}`);

  const headers: Record<string, string> = { Accept: "application/json" };
  const appToken = process.env.NYC_OPEN_DATA_APP_TOKEN;
  if (appToken) headers["X-App-Token"] = appToken;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(finalUrl, { headers, cache: "no-store", signal: controller.signal });
    console.log(`[NYC Open Data] Response: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const body = await res.text();
      console.error(`[NYC Open Data] Error body: ${body.substring(0, 500)}`);
      return { rows: [], url: finalUrl, status: res.status, error: `${res.status} ${res.statusText}` };
    }

    const data = await res.json();
    console.log(`[NYC Open Data] Got ${data.length} rows from ${endpoint}`);
    return { rows: data, url: finalUrl, status: res.status };
  } catch (err: any) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[NYC Open Data] Request timed out after 15s: ${finalUrl}`);
      return { rows: [], url: finalUrl, status: 0, error: `NYC Open Data request timed out after 15s: ${finalUrl}` };
    }
    console.error(`[NYC Open Data] Network error:`, err.message);
    return { rows: [], url: finalUrl, status: 0, error: err.message };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchHpdViolations(block: string, lot: string, boroId: string): Promise<FetchResult> {
  return socrataFetch(ENDPOINTS.HPD, {
    boroid: boroId,
    block: padBlock(block),
    lot: padLot(lot),
  });
}

export async function fetchDobViolations(block: string, lot: string, boroId: string): Promise<FetchResult> {
  // DOB uses "boro" not "boroid"
  return socrataFetch(ENDPOINTS.DOB, {
    boro: boroId,
    block: padBlock(block),
    lot: padLot(lot),
  });
}

export async function fetchEcbViolations(block: string, lot: string, boroId: string): Promise<FetchResult> {
  return socrataFetch(ENDPOINTS.ECB, {
    block: padBlock(block),
    lot: padLot(lot),
    boro: boroId,
  });
}

export async function fetchHpdComplaints(block: string, lot: string, boroId: string): Promise<FetchResult> {
  return socrataFetch(ENDPOINTS.HPD_COMPLAINTS, {
    boroid: boroId,
    block: padBlock(block),
    lot: padLot(lot),
  });
}

// ── Debug: raw fetch for a single source to diagnose issues ──

export interface DebugFetchResult {
  source: string;
  url: string;
  httpStatus: number;
  rowCount: number;
  sampleRow: any | null;
  error?: string;
  buildingInfo: {
    block: string;
    lot: string;
    paddedBlock: string;
    paddedLot: string;
    boroId: string;
  };
}

export async function debugFetchSource(
  source: string,
  block: string,
  lot: string,
  boroId: string
): Promise<DebugFetchResult> {
  const paddedBlock = padBlock(block);
  const paddedLot = padLot(lot);
  const buildingInfo = { block, lot, paddedBlock, paddedLot, boroId };

  let result: FetchResult;
  switch (source) {
    case "HPD":
      result = await fetchHpdViolations(block, lot, boroId);
      break;
    case "DOB":
      result = await fetchDobViolations(block, lot, boroId);
      break;
    case "ECB":
      result = await fetchEcbViolations(block, lot, boroId);
      break;
    case "HPD_COMPLAINTS":
      result = await fetchHpdComplaints(block, lot, boroId);
      break;
    default:
      return { source, url: "", httpStatus: 0, rowCount: 0, sampleRow: null, error: `Unknown source: ${source}`, buildingInfo };
  }

  return {
    source,
    url: result.url,
    httpStatus: result.status,
    rowCount: result.rows.length,
    sampleRow: result.rows[0] || null,
    error: result.error,
    buildingInfo,
  };
}

// ── Mappers ──

function parseDate(val: string | undefined | null): Date | undefined {
  if (!val) return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
}

function parseDecimal(val: string | number | undefined | null): number {
  if (val == null) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

function mapHpdClass(cls: string | undefined): "A" | "B" | "C" | null {
  if (!cls) return null;
  const upper = cls.toUpperCase();
  if (upper === "A" || upper === "B" || upper === "C") return upper;
  return null;
}

function hpdSeverity(cls: string | undefined): "IMMEDIATELY_HAZARDOUS" | "HAZARDOUS" | "NON_HAZARDOUS" | null {
  if (!cls) return null;
  const upper = cls.toUpperCase();
  if (upper === "C") return "IMMEDIATELY_HAZARDOUS";
  if (upper === "B") return "HAZARDOUS";
  if (upper === "A") return "NON_HAZARDOUS";
  return null;
}

export function mapHpdViolation(row: any, buildingId: string) {
  return {
    where: { source_externalId: { source: "HPD" as const, externalId: String(row.violationid || row.violation_id || "") } },
    create: {
      buildingId,
      source: "HPD" as const,
      externalId: String(row.violationid || row.violation_id || ""),
      class: mapHpdClass(row.class),
      severity: hpdSeverity(row.class),
      description: row.novdescription || row.violationstatus || "HPD Violation",
      inspectionDate: parseDate(row.inspectiondate),
      issuedDate: parseDate(row.novissueddate),
      currentStatus: row.violationstatus || row.currentstatus || null,
      penaltyAmount: parseDecimal(row.penalityamount),
      respondByDate: parseDate(row.currentstatusdate),
      certifiedDismissDate: parseDate(row.certifieddate),
      correctionDate: parseDate(row.approveddate),
      unitNumber: row.apartment || null,
      novDescription: row.novdescription || null,
    },
    update: {
      class: mapHpdClass(row.class),
      severity: hpdSeverity(row.class),
      description: row.novdescription || row.violationstatus || "HPD Violation",
      unitNumber: row.apartment || null,
      respondByDate: parseDate(row.currentstatusdate),
      currentStatus: row.violationstatus || row.currentstatus || null,
      penaltyAmount: parseDecimal(row.penalityamount),
      certifiedDismissDate: parseDate(row.certifieddate),
      correctionDate: parseDate(row.approveddate),
    },
  };
}

export function mapDobViolation(row: any, buildingId: string) {
  // DOB issue_date is YYYYMMDD format
  const issueDt = row.issue_date ? parseDate(
    `${row.issue_date.substring(0, 4)}-${row.issue_date.substring(4, 6)}-${row.issue_date.substring(6, 8)}`
  ) : undefined;

  return {
    where: { source_externalId: { source: "DOB" as const, externalId: String(row.isn_dob_bis_viol || row.violation_number || "") } },
    create: {
      buildingId,
      source: "DOB" as const,
      externalId: String(row.isn_dob_bis_viol || row.violation_number || ""),
      class: null,
      severity: null,
      description: row.description || row.violation_type || "DOB Violation",
      issuedDate: issueDt,
      currentStatus: row.violation_category || row.disposition_comments || null,
      penaltyAmount: 0,
      unitNumber: null,
      novDescription: row.description || null,
    },
    update: {
      currentStatus: row.violation_category || row.disposition_comments || null,
    },
  };
}

export function mapEcbViolation(row: any, buildingId: string) {
  // ECB hearing_date is YYYYMMDD format, not ISO
  const hearingDt = row.hearing_date ? parseDate(
    `${row.hearing_date.substring(0, 4)}-${row.hearing_date.substring(4, 6)}-${row.hearing_date.substring(6, 8)}`
  ) : undefined;

  return {
    where: { source_externalId: { source: "ECB" as const, externalId: String(row.isn_dob_bis_extract || row.ecb_violation_number || "") } },
    create: {
      buildingId,
      source: "ECB" as const,
      externalId: String(row.isn_dob_bis_extract || row.ecb_violation_number || ""),
      class: null,
      severity: null,
      description: row.violation_description || row.violation_type || "ECB Violation",
      issuedDate: parseDate(row.issue_date),
      currentStatus: row.ecb_violation_status || null,
      penaltyAmount: parseDecimal(row.balance_due || row.penality_imposed || row.amount_paid),
      respondByDate: hearingDt,
      hearingDate: hearingDt,
      hearingStatus: row.hearing_status || null,
      unitNumber: null,
      novDescription: row.violation_description || null,
    },
    update: {
      currentStatus: row.ecb_violation_status || null,
      penaltyAmount: parseDecimal(row.balance_due || row.penality_imposed || row.amount_paid),
      hearingDate: hearingDt,
      hearingStatus: row.hearing_status || null,
    },
  };
}

export function mapHpdComplaint(row: any, buildingId: string) {
  return {
    where: { source_externalId: { source: "HPD_COMPLAINTS" as const, externalId: String(row.complaint_id || row.complaintid || "") } },
    create: {
      buildingId,
      source: "HPD_COMPLAINTS" as const,
      externalId: String(row.complaint_id || row.complaintid || ""),
      class: null,
      severity: null,
      description: row.major_category || row.status_description || "HPD Complaint",
      inspectionDate: parseDate(row.complaint_status_date || row.received_date),
      issuedDate: parseDate(row.received_date),
      currentStatus: row.complaint_status || null,
      penaltyAmount: 0,
      unitNumber: row.apartment || null,
      novDescription: row.status_description || row.minor_category || null,
    },
    update: {
      currentStatus: row.complaint_status || null,
    },
  };
}
