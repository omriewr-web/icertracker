/**
 * W4-B: Import workflow tests
 *
 * Tests import parsers, validateUpload, file size/type/row limits,
 * and edge cases (empty files, malformed headers).
 */
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseImportFile } from "@/lib/importer/parseFile";
import { validateUpload, checkRowLimit, MAX_FILE_SIZE, MAX_ROWS, ALLOWED_EXTENSIONS } from "@/lib/importer/validateUpload";

// ── Helper: create an in-memory xlsx buffer ────────────────────────────

function createXlsxBuffer(rows: (string | number | null)[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

function createCsvBuffer(csvText: string): Buffer {
  return Buffer.from(csvText, "utf-8");
}

// ── parseImportFile tests ──────────────────────────────────────────────

describe("parseImportFile", () => {
  it("parses valid xlsx with data rows", () => {
    const buf = createXlsxBuffer([
      ["Unit", "Name", "Balance"],
      ["1A", "John Doe", 500],
      ["2B", "Jane Smith", 0],
    ]);
    const result = parseImportFile(buf, "test.xlsx");
    expect(result.fileName).toBe("test.xlsx");
    expect(result.fileType).toBe("xlsx");
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0].rowCount).toBe(3); // header + 2 data rows
    expect(result.sheets[0].columnCount).toBe(3);
  });

  it("parses csv file", () => {
    const csv = "Unit,Name,Balance\n1A,John Doe,500\n2B,Jane Smith,0\n";
    const buf = createCsvBuffer(csv);
    const result = parseImportFile(buf, "test.csv");
    expect(result.fileType).toBe("csv");
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0].rowCount).toBeGreaterThanOrEqual(2);
  });

  it("handles empty xlsx without crashing", () => {
    const buf = createXlsxBuffer([]);
    const result = parseImportFile(buf, "empty.xlsx");
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0].rowCount).toBe(0);
  });

  it("normalizes null/empty cells to null", () => {
    const buf = createXlsxBuffer([
      ["A", null, "C"],
      [1, null, 3],
    ]);
    const result = parseImportFile(buf, "test.xlsx");
    const rows = result.sheets[0].rows;
    expect(rows[0][1]).toBeNull();
    expect(rows[1][1]).toBeNull();
  });

  it("handles corrupt buffer gracefully (either throws or returns empty)", () => {
    const corrupt = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    try {
      const result = parseImportFile(corrupt, "bad.xlsx");
      // If it doesn't throw, should at least return a valid structure
      expect(result.sheets).toBeDefined();
    } catch (e: any) {
      // If it throws, that's also acceptable behavior
      expect(e.message).toBeDefined();
    }
  });

  it("detects xls file type from extension", () => {
    const buf = createXlsxBuffer([["A"]]);
    const result = parseImportFile(buf, "legacy.xls");
    expect(result.fileType).toBe("xls");
  });
});

// ── checkRowLimit tests ────────────────────────────────────────────────

describe("checkRowLimit", () => {
  it("returns null for row count under limit", () => {
    expect(checkRowLimit(100)).toBeNull();
    expect(checkRowLimit(4999)).toBeNull();
    expect(checkRowLimit(5000)).toBeNull();
  });

  it("returns error response for row count over limit", () => {
    const response = checkRowLimit(5001);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(400);
  });

  it("uses custom limit when provided", () => {
    expect(checkRowLimit(101, 100)).not.toBeNull();
    expect(checkRowLimit(100, 100)).toBeNull();
  });

  it("error response contains descriptive message", async () => {
    const response = checkRowLimit(6000);
    const body = await response!.json();
    expect(body.error).toContain("6000");
    expect(body.error).toContain("5000");
    expect(body.code).toBe("TOO_MANY_ROWS");
  });
});

// ── validateUpload tests (via FormData simulation) ─────────────────────

describe("validateUpload", () => {

  function makeFormData(name: string, content: Buffer, type: string): FormData {
    const file = new File([new Uint8Array(content)], name, { type });
    const fd = new FormData();
    fd.set("file", file);
    return fd;
  }

  it("accepts valid xlsx upload", async () => {
    const buf = createXlsxBuffer([["A", "B"], [1, 2]]);
    const fd = makeFormData("test.xlsx", buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const result = await validateUpload(fd);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.fileName).toBe("test.xlsx");
      expect(result.extension).toBe("xlsx");
    }
  });

  it("accepts csv upload", async () => {
    const buf = createCsvBuffer("a,b\n1,2\n");
    const fd = makeFormData("data.csv", buf, "text/csv");
    const result = await validateUpload(fd);
    expect(result.valid).toBe(true);
  });

  it("rejects missing file", async () => {
    const fd = new FormData();
    const result = await validateUpload(fd);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe("MISSING_FILE");
    }
  });

  it("rejects invalid extension", async () => {
    const buf = Buffer.from("data");
    const fd = makeFormData("test.pdf", buf, "application/pdf");
    const result = await validateUpload(fd);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe("INVALID_FILE_TYPE");
      expect(result.error).toContain(".pdf");
    }
  });

  it("rejects file over 10MB", async () => {
    // Create a buffer just over 10MB
    const bigBuf = Buffer.alloc(MAX_FILE_SIZE + 1, 0);
    const fd = makeFormData("huge.xlsx", bigBuf, "application/octet-stream");
    const result = await validateUpload(fd);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe("FILE_TOO_LARGE");
      expect(result.status).toBe(413);
    }
  });

  it("accepts application/octet-stream as valid MIME (browser fallback)", async () => {
    const buf = createXlsxBuffer([["test"]]);
    const fd = makeFormData("data.xlsx", buf, "application/octet-stream");
    const result = await validateUpload(fd);
    expect(result.valid).toBe(true);
  });
});

// ── Constants validation ───────────────────────────────────────────────

describe("Import constants", () => {
  it("MAX_FILE_SIZE is 10MB", () => {
    expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
  });

  it("MAX_ROWS is 5000", () => {
    expect(MAX_ROWS).toBe(5000);
  });

  it("allowed extensions include xlsx, xls, csv", () => {
    expect(ALLOWED_EXTENSIONS).toContain("xlsx");
    expect(ALLOWED_EXTENSIONS).toContain("xls");
    expect(ALLOWED_EXTENSIONS).toContain("csv");
  });

  it("does not allow pdf, txt, json", () => {
    expect(ALLOWED_EXTENSIONS).not.toContain("pdf");
    expect(ALLOWED_EXTENSIONS).not.toContain("txt");
    expect(ALLOWED_EXTENSIONS).not.toContain("json");
  });
});

// ── Excel import format detection tests ────────────────────────────────

describe("Excel import module", () => {
  it("exports parsing functions", async () => {
    const mod = await import("@/lib/excel-import");
    // Should export at least one of the known parsers
    const exportedFns = Object.keys(mod).filter((k) => typeof (mod as any)[k] === "function");
    expect(exportedFns.length).toBeGreaterThan(0);
  });
});
