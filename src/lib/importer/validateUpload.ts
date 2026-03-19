import { NextResponse } from "next/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 5000;
const ALLOWED_EXTENSIONS = ["xlsx", "xls", "csv"];
const ALLOWED_MIMES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "application/octet-stream", // common fallback for xlsx uploads
];

type UploadValidation = {
  valid: true;
  buffer: Buffer;
  fileName: string;
  extension: string;
} | {
  valid: false;
  error: string;
  code: string;
  status: number;
};

/**
 * Validate an uploaded file from FormData.
 * Checks size, extension, and MIME type.
 * Returns the buffer + metadata on success, or an error on failure.
 */
export async function validateUpload(formData: FormData): Promise<UploadValidation> {
  const file = formData.get("file") as File | null;
  if (!file) {
    return { valid: false, error: "No file provided", code: "MISSING_FILE", status: 400 };
  }

  const fileName = file.name || "upload";
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  // Extension check
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file type ".${extension}". Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
      code: "INVALID_FILE_TYPE",
      status: 400,
    };
  }

  // MIME check (lenient — browsers are inconsistent)
  if (file.type && !ALLOWED_MIMES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid MIME type "${file.type}". Upload an .xlsx, .xls, or .csv file.`,
      code: "INVALID_MIME_TYPE",
      status: 400,
    };
  }

  // Size check
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 10MB.`,
      code: "FILE_TOO_LARGE",
      status: 413,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return { valid: true, buffer, fileName, extension };
}

/**
 * Check if a parsed sheet exceeds the max row limit.
 * Returns a NextResponse error if exceeded, null if OK.
 */
export function checkRowLimit(rowCount: number, limit: number = MAX_ROWS): NextResponse | null {
  if (rowCount > limit) {
    return NextResponse.json(
      { error: `File has ${rowCount} rows, exceeding the ${limit}-row limit. Please split into smaller files.`, code: "TOO_MANY_ROWS" },
      { status: 400 },
    );
  }
  return null;
}

/**
 * Safe wrapper around XLSX.read — catches parse errors and returns a consistent error shape.
 */
export function safeParseXlsx(buffer: Buffer, opts?: Record<string, unknown>): { workbook: any; error?: never } | { workbook?: never; error: string } {
  try {
    // Dynamic import avoided — caller passes XLSX
    const XLSX = require("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, ...opts });
    return { workbook };
  } catch (err: any) {
    return { error: err.message || "Failed to parse file. Ensure it is a valid Excel or CSV file." };
  }
}

export { MAX_FILE_SIZE, MAX_ROWS, ALLOWED_EXTENSIONS };
