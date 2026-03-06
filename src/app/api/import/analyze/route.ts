import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { analyzeImport } from "@/lib/importer/analyzeImport";

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
      organizationId: "default",
    });

    // Map to the response shape the UI expects (backward compatible with existing AnalyzeResult)
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
          missingRequiredFields: [] as string[],
          presentRequiredFields: result.suggestedMappings
            .filter((m) => m.mappedField)
            .map((m) => m.mappedField!),
        },
        warnings: result.warnings,
        assumptions: result.assumptions,
      },
      sampleRows: result.previewRows.slice(0, 5).map((row) =>
        result.suggestedMappings.map((m) => String(row[m.mappedField ?? ""] ?? "")),
      ),
      rawSampleRows: result.previewRows.slice(0, 5),
      rowCount: 0, // will be filled from parsed file
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
