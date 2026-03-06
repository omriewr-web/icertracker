import { parseImportFile } from "./parseFile";
import { analyzeStructure } from "./analyzeStructure";
import { normalizeHeader, combineHeaderRows } from "./normalizeHeader";
import { mapHeadersWithAliases } from "./mapHeadersWithAliases";
import { fuzzyMapHeaders } from "./fuzzyMapHeaders";
import { buildFingerprint } from "./buildFingerprint";
import { matchImportProfile } from "./matchImportProfile";
import { createAnthropicAnalyzer } from "./aiAnalyzeImport";
import { transformRows } from "./validateImportRows";
import type {
  ImportAnalysisResult,
  SuggestedMapping,
  AIImportPayload,
  ImportFileType,
  CONFIDENCE_THRESHOLDS,
} from "./types";

const AI_CONFIDENCE_TRIGGER = 0.60;

/**
 * Determine import type from file type guess.
 */
function guessImportCategory(fileType: ImportFileType): "tenant" | "building" {
  if (fileType === "building_list") return "building";
  return "tenant";
}

/**
 * Main orchestrator: parse → structure → normalize → alias → fuzzy → profile → AI → result.
 */
export async function analyzeImport(
  buffer: Buffer,
  fileName: string,
  opts?: { importType?: string; organizationId?: string },
): Promise<ImportAnalysisResult> {
  // 1. Parse file
  const parsed = parseImportFile(buffer, fileName);
  const sheet = parsed.sheets[0];
  if (!sheet || sheet.rowCount === 0) {
    return emptyResult(fileName, sheet?.sheetName ?? "Sheet1");
  }

  // 2. Analyze structure
  const structure = analyzeStructure(sheet);

  // 3. Normalize & combine headers
  let rawHeaders: string[];
  if (structure.headerRows.length >= 2) {
    const row1 = sheet.rows[structure.headerRows[0]] ?? [];
    const row2 = sheet.rows[structure.headerRows[1]] ?? [];
    rawHeaders = combineHeaderRows(row1, row2);
  } else if (structure.headerRows.length === 1) {
    rawHeaders = (sheet.rows[structure.headerRows[0]] ?? []).map((c) => String(c ?? ""));
  } else {
    rawHeaders = Array.from({ length: sheet.columnCount }, (_, i) => `Column ${i + 1}`);
  }

  const importCategory = opts?.importType === "building"
    ? "building"
    : guessImportCategory(structure.fileTypeGuess);

  // 4. Alias mapping
  let mappings = mapHeadersWithAliases(rawHeaders, importCategory);

  // 5. Fuzzy mapping for remaining unmapped
  mappings = fuzzyMapHeaders(mappings, importCategory);

  // 6. Build fingerprint
  const fingerprint = buildFingerprint(sheet, structure);

  // 7. Profile matching
  let matchedProfile = null;
  try {
    matchedProfile = await matchImportProfile(
      fingerprint,
      opts?.importType ?? structure.fileTypeGuess,
      opts?.organizationId ?? "default",
    );
  } catch {
    // Profile matching is optional — DB might not have the table yet
  }

  // If profile has high confidence, use its mappings for unmapped columns
  if (matchedProfile && matchedProfile.confidence >= 0.95) {
    mappings = mergeProfileMappings(mappings, matchedProfile.mapping);
  }

  // 8. Determine if AI is needed
  const unmappedCount = mappings.filter((m) => !m.mappedField && m.normalizedHeader).length;
  const avgConfidence = mappings.length > 0
    ? mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length
    : 0;
  let aiUsed = false;
  const assumptions: string[] = [];
  const warnings = [...structure.warnings];

  if (avgConfidence < AI_CONFIDENCE_TRIGGER || unmappedCount > mappings.length * 0.4) {
    const analyzer = createAnthropicAnalyzer();
    if (analyzer) {
      try {
        const aiPayload = buildAIPayload(parsed.fileName, sheet, structure, mappings);
        const aiResult = await analyzer.analyze(aiPayload);
        aiUsed = true;

        // Merge AI results into mappings for still-unmapped columns
        for (const aiCol of aiResult.columns) {
          const existing = mappings[aiCol.columnIndex];
          if (existing && !existing.mappedField && aiCol.mappedField) {
            mappings[aiCol.columnIndex] = {
              ...existing,
              mappedField: aiCol.mappedField,
              confidence: aiCol.confidence,
              reason: aiCol.reason,
              method: "ai",
            };
          }
        }

        if (aiResult.warnings) warnings.push(...aiResult.warnings);
        if (aiResult.assumptions) assumptions.push(...aiResult.assumptions);

        // AI may improve structure detection
        if (aiResult.confidence > structure.fileTypeConfidence) {
          structure.fileTypeGuess = aiResult.fileType;
          structure.fileTypeConfidence = aiResult.confidence;
        }
      } catch (err: any) {
        warnings.push(`AI analysis failed: ${err.message}. Using rule-based mapping only.`);
      }
    } else {
      warnings.push("AI analysis unavailable (no API key). Using rule-based mapping only.");
    }
  }

  // 9. Build preview rows
  const ignoredSet = new Set(structure.ignoredRowIndices);
  const previewRows = transformRows(
    sheet.rows,
    mappings,
    structure.dataStartRow,
    ignoredSet,
  ).slice(0, 10);

  return {
    fileName,
    selectedSheetName: sheet.sheetName,
    fileTypeGuess: structure.fileTypeGuess,
    fileTypeConfidence: structure.fileTypeConfidence,
    headerRows: structure.headerRows,
    dataStartRow: structure.dataStartRow,
    ignoredRowIndices: structure.ignoredRowIndices,
    suggestedMappings: mappings,
    previewRows,
    warnings,
    assumptions,
    matchedProfile,
    aiUsed,
  };
}

function emptyResult(fileName: string, sheetName: string): ImportAnalysisResult {
  return {
    fileName,
    selectedSheetName: sheetName,
    fileTypeGuess: "unknown",
    fileTypeConfidence: 0,
    headerRows: [],
    dataStartRow: 0,
    ignoredRowIndices: [],
    suggestedMappings: [],
    previewRows: [],
    warnings: ["File appears to be empty"],
    assumptions: [],
    matchedProfile: null,
    aiUsed: false,
  };
}

function mergeProfileMappings(
  current: SuggestedMapping[],
  profile: SuggestedMapping[],
): SuggestedMapping[] {
  const profileByIndex = new Map(profile.map((m) => [m.columnIndex, m]));
  return current.map((m) => {
    if (m.mappedField) return m; // keep existing alias/fuzzy match
    const fromProfile = profileByIndex.get(m.columnIndex);
    if (fromProfile?.mappedField) return fromProfile;
    return m;
  });
}

function buildAIPayload(
  fileName: string,
  sheet: { sheetName: string; rows: (string | number | null)[][]; rowCount: number; columnCount: number },
  structure: { headerRows: number[]; dataStartRow: number; fileTypeGuess: string; hasMergedHeaders: boolean; ignoredRowIndices: number[] },
  mappings: SuggestedMapping[],
): AIImportPayload {
  const sampleEnd = Math.min(structure.dataStartRow + 15, sheet.rowCount);
  const sampleRows = [];
  for (let i = 0; i < sampleEnd; i++) {
    sampleRows.push({
      rowIndex: i,
      cells: (sheet.rows[i] ?? []).map((c) => String(c ?? "")),
    });
  }

  const maxCols = sheet.columnCount;
  const columnSamples = [];
  for (let c = 0; c < maxCols; c++) {
    const values: string[] = [];
    for (let r = structure.dataStartRow; r < sampleEnd; r++) {
      const v = sheet.rows[r]?.[c];
      if (v !== null && v !== undefined && v !== "") values.push(String(v));
    }
    columnSamples.push({ index: c, values });
  }

  return {
    fileName,
    sheetName: sheet.sheetName,
    rowCount: sheet.rowCount,
    headerRows: structure.headerRows.map((i) => ({
      rowIndex: i,
      cells: (sheet.rows[i] ?? []).map((c) => String(c ?? "")),
    })),
    sampleRows,
    columnSamples,
    structureSummary: {
      fileTypeGuess: structure.fileTypeGuess,
      headerRowIndices: structure.headerRows,
      dataStartRow: structure.dataStartRow,
      hasMergedHeaders: structure.hasMergedHeaders,
      ignoredRowCount: structure.ignoredRowIndices.length,
    },
    candidateMappings: mappings.map((m) => ({
      columnIndex: m.columnIndex,
      sourceHeader: m.sourceHeader,
      bestGuess: m.mappedField,
      confidence: m.confidence,
    })),
  };
}
