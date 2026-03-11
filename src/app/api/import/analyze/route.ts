import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { analyzeImport } from "@/lib/importer/analyzeImport";
import { REQUIRED_FIELDS } from "@/lib/importer/headerAliases";

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const importType = formData.get("importType") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await analyzeImport(buffer, file.name, {
      importType: importType ?? undefined,
      organizationId: user.organizationId,
    });

    // Determine required fields for this import type
    const fileType = result.fileTypeGuess;
    const requiredKey = fileType === "building_list" ? "building"
      : fileType === "yardi_rent_roll" ? "yardi_rent_roll"
      : fileType === "arrears_report" ? "arrears_report"
      : "tenant";
    const required = REQUIRED_FIELDS[requiredKey] ?? REQUIRED_FIELDS.tenant;

    // Compute real required field status from mappings
    const mappedFields = new Set(
      result.suggestedMappings.filter((m) => m.mappedField).map((m) => m.mappedField!)
    );
    const presentRequiredFields = required.filter((f) => mappedFields.has(f));
    const missingRequiredFields = required.filter((f) => !mappedFields.has(f));

    // Compute real row count from preview rows (transformed data rows)
    const rowCount = result.previewRows.length > 0
      ? result.previewRows.length
      : 0;

    // Build sampleRows as raw column-indexed arrays (one per preview row)
    // This matches what upload-zone.tsx expects: sampleRows[rowIdx][colIndex]
    const { rawSampleRows, rawColumnRows } = buildSampleData(result);

    return NextResponse.json({
      analysis: {
        fileType: result.fileTypeGuess,
        confidence: result.fileTypeConfidence,
        headerRows: result.headerRows,
        dataStartRow: result.dataStartRow,
        ignoredRowTypes: [],
        ignoredRowIndices: result.ignoredRowIndices,
        columns: result.suggestedMappings.map((m) => ({
          columnIndex: m.columnIndex,
          sourceHeader: m.sourceHeader,
          normalizedHeader: m.normalizedHeader,
          mappedField: m.mappedField,
          confidence: m.confidence,
          reason: m.reason,
          method: m.method,
        })),
        requiredFieldsStatus: {
          missingRequiredFields,
          presentRequiredFields,
        },
        warnings: result.warnings,
        assumptions: result.assumptions,
      },
      sampleRows: rawColumnRows,
      rawSampleRows,
      rowCount,
      sheetName: result.selectedSheetName,
      matchedProfile: result.matchedProfile,
      aiUsed: result.aiUsed,
    });
  } catch (err: any) {
    console.error("Import analysis error:", err);
    return NextResponse.json(
      { error: err.message || "Analysis failed" },
      { status: 500 },
    );
  }
}, "upload");

/**
 * Build both raw column-indexed sample rows (for mapping table)
 * and mapped key-value rows (for preview table).
 */
function buildSampleData(result: {
  previewRows: Record<string, unknown>[];
  suggestedMappings: { columnIndex: number; mappedField: string | null }[];
}) {
  // rawSampleRows: key-value objects keyed by mappedField (for preview table)
  const rawSampleRows = result.previewRows.slice(0, 5);

  // rawColumnRows: arrays indexed by column position (for mapping table sample values)
  // Invert the mapped preview rows back to column-indexed arrays
  const rawColumnRows: string[][] = rawSampleRows.map((row) => {
    const arr: string[] = [];
    for (const m of result.suggestedMappings) {
      const val = m.mappedField ? row[m.mappedField] : undefined;
      arr[m.columnIndex] = String(val ?? "");
    }
    return arr;
  });

  return { rawSampleRows, rawColumnRows };
}
