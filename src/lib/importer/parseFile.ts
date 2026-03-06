import * as XLSX from "xlsx";
import type { ParsedImportFile, FileType, MergedCellInfo } from "./types";

export function parseImportFile(buffer: Buffer, fileName: string): ParsedImportFile {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const fileType: FileType = ext === "csv" ? "csv" : ext === "xls" ? "xls" : "xlsx";

  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });

  const sheets = wb.SheetNames.map((sheetName) => {
    const sheet = wb.Sheets[sheetName];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // Extract merged cells
    const mergedCells: MergedCellInfo[] = [];
    if (sheet["!merges"]) {
      for (const merge of sheet["!merges"]) {
        const cellAddr = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
        const cellVal = sheet[cellAddr]?.v;
        mergedCells.push({
          startRow: merge.s.r,
          endRow: merge.e.r,
          startCol: merge.s.c,
          endCol: merge.e.c,
          value: cellVal != null ? String(cellVal) : null,
        });
      }
    }

    // Normalize row values to string | number | null
    const rows = rawRows.map((row) =>
      row.map((cell: any) => {
        if (cell === null || cell === undefined) return null;
        if (cell instanceof Date) return cell.toISOString().split("T")[0];
        if (typeof cell === "number") return cell;
        const s = String(cell).trim();
        return s === "" ? null : s;
      }),
    );

    // Find actual column count (ignoring trailing nulls)
    let columnCount = 0;
    for (const row of rows) {
      const lastNonNull = row.findLastIndex((c) => c !== null);
      if (lastNonNull + 1 > columnCount) columnCount = lastNonNull + 1;
    }

    return {
      sheetName,
      rows,
      mergedCells,
      rowCount: rows.length,
      columnCount,
    };
  });

  return { fileName, fileType, sheets };
}
