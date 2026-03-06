import type { ParsedSheet } from "./types";

export type ValueType =
  | "unit_like"
  | "person_name_like"
  | "currency_like"
  | "date_like"
  | "phone_like"
  | "email_like"
  | "address_like"
  | "status_like"
  | "id_like"
  | "building_name_like"
  | "unknown";

export interface ColumnValueClassification {
  columnIndex: number;
  sampleSize: number;
  detectedTypes: { type: ValueType; confidence: number; reason: string }[];
  topType: ValueType;
  topConfidence: number;
}

// ── Pattern detectors ──
// Each returns a score 0-1 for how well a single string matches the type.

const RE_UNIT = /^(?:apt\.?\s*)?(?:\d{1,4}[A-Za-z]?|PH\d?|BSMT|STE\s*\d+|\d{1,4}-[A-Za-z]|\d[A-Za-z]-?\d?)$/i;
function isUnitLike(s: string): boolean {
  return RE_UNIT.test(s) && s.length <= 8;
}

const RE_CURRENCY = /^[($]?-?\$?\d[\d,]*\.?\d{0,2}\)?$/;
function isCurrencyLike(s: string): boolean {
  const clean = s.replace(/\s/g, "");
  return RE_CURRENCY.test(clean) && clean.length <= 15;
}

const RE_DATE = /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})$/;
function isDateLike(s: string): boolean {
  return RE_DATE.test(s.trim());
}

const RE_PHONE = /^[(\d][\d\s().-]{7,17}$/;
function isPhoneLike(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  return RE_PHONE.test(s) && digits.length >= 7 && digits.length <= 15;
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isEmailLike(s: string): boolean {
  return RE_EMAIL.test(s);
}

// Address: starts with number, has at least one word, contains street-like suffix
const RE_ADDR = /^\d+\s+[A-Za-z]/;
const STREET_WORDS = new Set(["st", "street", "ave", "avenue", "blvd", "boulevard", "rd", "road", "dr", "drive", "pl", "place", "ct", "court", "ln", "lane", "way", "pkwy", "parkway"]);
function isAddressLike(s: string): boolean {
  if (!RE_ADDR.test(s)) return false;
  const words = s.toLowerCase().split(/\s+/);
  return words.length >= 2 && (words.some((w) => STREET_WORDS.has(w.replace(/[.,]/g, ""))) || words.length >= 3);
}

// Person name: 2-3 capitalized words, no digits, not address-like
function isPersonNameLike(s: string): boolean {
  // Reject if it looks like an address
  if (/^\d/.test(s)) return false;
  // Reject if it contains LLC, Inc, Corp, etc. (building/entity name)
  if (/\b(LLC|Inc|Corp|LP|Assoc|Holdings?|Properties|Realty|Ltd)\b/i.test(s)) return false;
  // Reject if it contains common building words
  if (/\b(Portfolio|Building|Tower|Plaza|House|Court|Manor|Estate|Gardens?|Apts?)\b/i.test(s)) return false;

  const words = s.trim().split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  // Each word should start with uppercase and be alpha
  return words.every((w) => /^[A-Z][a-z]+$/.test(w) || /^[A-Z]{1,3}\.?$/.test(w) || /^(de|la|van|von|el|al|del|di|da|le)$/i.test(w));
}

// Building name: contains address-like or entity keywords, or capitalized multi-word
function isBuildingNameLike(s: string): boolean {
  if (/\b(LLC|Inc|Corp|LP|Portfolio|Assoc)\b/i.test(s)) return true;
  if (/\b(Building|Tower|Plaza|House|Court|Manor|Estate|Gardens?|Apts?|Apartments?)\b/i.test(s)) return true;
  // "The Ashton" style - starts with "The" + capitalized word
  if (/^The\s+[A-Z]/.test(s)) return true;
  // Numbered building: "957 Woodycrest" but not an address with street suffix
  if (/^\d+\s+[A-Z][a-z]+$/.test(s)) return true;
  return false;
}

const STATUS_WORDS = new Set([
  "current", "past due", "active", "vacant", "occupied", "evicted",
  "notice", "delinquent", "legal", "expired", "month to month",
  "pending", "terminated", "renewed", "settled",
]);
function isStatusLike(s: string): boolean {
  return STATUS_WORDS.has(s.toLowerCase().trim());
}

// ID-like: alphanumeric codes with consistent format, NOT pure numbers that look like currency
const RE_ID = /^[A-Za-z]{1,5}[-.]?\d{2,10}$|^\d{5,15}$/;
function isIdLike(s: string): boolean {
  // Reject if it looks like currency (has decimal point with 2 digits or $ sign)
  if (/\.\d{2}$/.test(s) || s.includes("$") || s.includes(",")) return false;
  // Reject if it looks like a unit
  if (isUnitLike(s)) return false;
  return RE_ID.test(s.trim());
}

// ── Main classifier ──

/**
 * Classify a single column's sample values.
 */
export function classifyColumn(
  values: (string | number | null)[],
  columnIndex: number,
): ColumnValueClassification {
  const nonEmpty = values
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
    .map((v) => String(v).trim());

  const sampleSize = nonEmpty.length;
  if (sampleSize === 0) {
    return { columnIndex, sampleSize: 0, detectedTypes: [], topType: "unknown", topConfidence: 0 };
  }

  const checks: { type: ValueType; fn: (s: string) => boolean }[] = [
    { type: "email_like", fn: isEmailLike },
    { type: "phone_like", fn: isPhoneLike },
    { type: "date_like", fn: isDateLike },
    { type: "address_like", fn: isAddressLike },
    { type: "status_like", fn: isStatusLike },
    { type: "unit_like", fn: isUnitLike },
    { type: "currency_like", fn: isCurrencyLike },
    { type: "building_name_like", fn: isBuildingNameLike },
    { type: "person_name_like", fn: isPersonNameLike },
    { type: "id_like", fn: isIdLike },
  ];

  const detectedTypes: ColumnValueClassification["detectedTypes"] = [];

  for (const { type, fn } of checks) {
    const matchCount = nonEmpty.filter(fn).length;
    const confidence = matchCount / sampleSize;
    if (confidence > 0.3) {
      detectedTypes.push({
        type,
        confidence,
        reason: `${matchCount}/${sampleSize} values match ${type} pattern`,
      });
    }
  }

  // Sort by confidence desc
  detectedTypes.sort((a, b) => b.confidence - a.confidence);

  // Resolve conflicts: if both person_name_like and building_name_like match, prefer the higher one
  // If currency_like and id_like conflict, prefer currency if confidence is close
  const topType = detectedTypes[0]?.type ?? "unknown";
  const topConfidence = detectedTypes[0]?.confidence ?? 0;

  // Reduce confidence for mixed columns (top 2 types both above 0.4)
  let adjustedConfidence = topConfidence;
  if (detectedTypes.length >= 2 && detectedTypes[1].confidence > 0.4) {
    adjustedConfidence *= 0.8; // penalize mixed patterns
  }

  return {
    columnIndex,
    sampleSize,
    detectedTypes,
    topType,
    topConfidence: adjustedConfidence,
  };
}

/**
 * Classify all columns in a sheet based on sample data rows.
 */
export function classifyAllColumns(
  sheet: ParsedSheet,
  dataStartRow: number,
  ignoredRowIndices: Set<number>,
  maxSamples: number = 25,
): ColumnValueClassification[] {
  const results: ColumnValueClassification[] = [];
  const { rows, columnCount } = sheet;

  for (let c = 0; c < columnCount; c++) {
    const values: (string | number | null)[] = [];
    let collected = 0;
    for (let r = dataStartRow; r < rows.length && collected < maxSamples; r++) {
      if (ignoredRowIndices.has(r)) continue;
      values.push(rows[r]?.[c] ?? null);
      collected++;
    }
    results.push(classifyColumn(values, c));
  }

  return results;
}

/**
 * Given a value classification, suggest which schema field it most likely represents.
 * Returns null if no strong suggestion.
 */
export function suggestFieldFromClassification(
  classification: ColumnValueClassification,
): { field: string; confidence: number } | null {
  if (classification.topConfidence < 0.5) return null;

  const TYPE_TO_FIELD: Partial<Record<ValueType, string>> = {
    unit_like: "unit",
    person_name_like: "full_name",
    email_like: "email",
    phone_like: "phone",
    address_like: "address",
    status_like: "occupancy_status",
    building_name_like: "building_id",
  };

  const field = TYPE_TO_FIELD[classification.topType];
  if (!field) return null;

  return { field, confidence: classification.topConfidence * 0.7 }; // lower weight than header-based
}
