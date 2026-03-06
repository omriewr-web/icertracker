// ── Self-Learning Importer — Shared Types ──

export type FileType = "csv" | "xlsx" | "xls";

export type ImportFileType =
  | "atlas_template"
  | "yardi_rent_roll"
  | "tenant_list"
  | "arrears_report"
  | "building_list"
  | "violations_report"
  | "generic_property_data"
  | "unknown";

export type MappingMethod = "alias" | "fuzzy" | "profile" | "ai" | "unmapped";

export type IgnoredRowType =
  | "blank"
  | "total"
  | "subtotal"
  | "separator"
  | "detail"
  | "repeated_header"
  | "section_header"
  | "charge_row";

// ── File parsing ──

export interface MergedCellInfo {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  value?: string | null;
}

export interface ParsedSheet {
  sheetName: string;
  rows: (string | number | null)[][];
  mergedCells: MergedCellInfo[];
  rowCount: number;
  columnCount: number;
}

export interface ParsedImportFile {
  fileName: string;
  fileType: FileType;
  sheets: ParsedSheet[];
}

// ── Structure analysis ──

export interface IgnoredRowInfo {
  rowIndex: number;
  type: IgnoredRowType;
  label?: string;
}

export interface StructureAnalysis {
  fileTypeGuess: ImportFileType;
  fileTypeConfidence: number;
  headerRows: number[];
  dataStartRow: number;
  ignoredRowIndices: number[];
  ignoredRowTypes: IgnoredRowInfo[];
  hasMergedHeaders: boolean;
  warnings: string[];
}

// ── Column mapping ──

export interface SuggestedMapping {
  columnIndex: number;
  sourceHeader: string;
  normalizedHeader: string;
  mappedField: string | null;
  confidence: number;
  reason: string;
  method: MappingMethod;
}

// ── Fingerprinting ──

export interface ImportFingerprint {
  normalizedSheetName?: string;
  headerRowCount: number;
  normalizedHeaders: string[];
  columnCount: number;
  hasMergedHeaders: boolean;
  keywordFlags: {
    hasTotalRows: boolean;
    hasChargeRows: boolean;
    hasUnitColumn: boolean;
    hasBalanceColumn: boolean;
    hasTenantLikeColumn: boolean;
  };
  columnTypeHints: string[];
}

// ── Profile matching ──

export interface ProfileMatch {
  id: string;
  name: string;
  confidence: number;
  mapping: SuggestedMapping[];
}

// ── AI analyzer ──

export interface AIImportPayload {
  fileName: string;
  importType?: string;
  sheetName: string;
  rowCount: number;
  headerRows: { rowIndex: number; cells: string[] }[];
  sampleRows: { rowIndex: number; cells: string[] }[];
  columnSamples: { index: number; values: string[] }[];
  structureSummary: {
    fileTypeGuess: string;
    headerRowIndices: number[];
    dataStartRow: number;
    hasMergedHeaders: boolean;
    ignoredRowCount: number;
  };
  candidateMappings: {
    columnIndex: number;
    sourceHeader: string;
    bestGuess: string | null;
    confidence: number;
  }[];
}

export interface AIImportResult {
  fileType: ImportFileType;
  confidence: number;
  headerRows: number[];
  dataStartRow: number;
  ignoredRowTypes: string[];
  ignoredRowIndices: number[];
  columns: {
    columnIndex: number;
    sourceHeader: string;
    normalizedHeader: string;
    mappedField: string | null;
    confidence: number;
    reason: string;
  }[];
  requiredFieldsStatus: {
    missingRequiredFields: string[];
    presentRequiredFields: string[];
  };
  warnings: string[];
  assumptions: string[];
}

export type AIImportAnalyzer = {
  analyze(payload: AIImportPayload): Promise<AIImportResult>;
};

// ── Orchestrator result ──

export interface ImportAnalysisResult {
  fileName: string;
  selectedSheetName: string;
  fileTypeGuess: ImportFileType;
  fileTypeConfidence: number;
  headerRows: number[];
  dataStartRow: number;
  ignoredRowIndices: number[];
  suggestedMappings: SuggestedMapping[];
  previewRows: Record<string, unknown>[];
  warnings: string[];
  assumptions: string[];
  matchedProfile: ProfileMatch | null;
  aiUsed: boolean;
}

// ── Validation ──

export interface ValidationResult {
  validRows: Record<string, unknown>[];
  invalidRows: { rowIndex: number; row: Record<string, unknown>; errors: string[] }[];
  missingRequiredFields: string[];
  summary: { total: number; valid: number; invalid: number };
}

// ── Config ──

export const CONFIDENCE_THRESHOLDS = {
  ALIAS_HIGH: 1.0,
  FUZZY_HIGH: 0.92,
  FUZZY_MEDIUM: 0.80,
  FUZZY_REJECT: 0.80,
  PROFILE_AUTO_APPLY: 0.95,
  PROFILE_SUGGEST: 0.80,
  AI_TRIGGER: 0.60,
} as const;
