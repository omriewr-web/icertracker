"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload, FileSpreadsheet, X, Loader2, AlertTriangle, AlertCircle,
  CheckCircle, ChevronDown, ChevronRight, Eye, Sparkles, Zap,
} from "lucide-react";
import Button from "@/components/ui/button";
import {
  useAnalyzeImport, useConfirmImport, useImportExcel,
  type AiAnalysis, type ColumnMapping, type ConfirmResult, type MatchedProfile,
} from "@/hooks/use-import";
import { cn } from "@/lib/utils";

const TENANT_FIELDS = [
  "", "unit", "tenant_code", "full_name", "first_name", "last_name", "phone", "email",
  "occupancy_status", "move_in_date", "move_out_date", "lease_start_date",
  "lease_end_date", "monthly_rent", "market_rent", "current_balance",
  "security_deposit", "subsidy_amount", "subsidy_type", "arrears_status",
  "notes", "building_id",
];

const BUILDING_FIELDS = [
  "", "building_id", "address", "zip", "borough", "block", "lot", "bin", "units",
  "portfolio", "entity", "owner_name", "property_manager", "year_built",
  "floors", "elevator", "sprinkler_system", "fire_alarm_system", "oil_tank",
  "boiler_type", "hpd_registration_id",
];

const METHOD_LABELS: Record<string, { label: string; color: string }> = {
  alias:   { label: "Alias",   color: "text-green-400 bg-green-400/10" },
  fuzzy:   { label: "Fuzzy",   color: "text-blue-400 bg-blue-400/10" },
  profile: { label: "Profile", color: "text-purple-400 bg-purple-400/10" },
  ai:      { label: "AI",      color: "text-amber-400 bg-amber-400/10" },
  unmapped:{ label: "None",    color: "text-text-dim bg-transparent" },
};

type Step = "idle" | "analyzing" | "mapping" | "preview" | "importing" | "done";

export default function UploadZone() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [sampleRows, setSampleRows] = useState<string[][]>([]);
  const [rawSampleRows, setRawSampleRows] = useState<Record<string, unknown>[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [matchedProfile, setMatchedProfile] = useState<MatchedProfile | null>(null);
  const [aiUsed, setAiUsed] = useState(false);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const analyzeMutation = useAnalyzeImport();
  const confirmImport = useConfirmImport();
  const legacyImport = useImportExcel();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv"))) {
      selectFile(f);
    }
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) selectFile(f);
  }

  function selectFile(f: File) {
    setFile(f);
    setStep("analyzing");
    setAnalysis(null);
    setSampleRows([]);
    setRawSampleRows([]);
    setMappings([]);
    setMatchedProfile(null);
    setAiUsed(false);
    setConfirmResult(null);

    analyzeMutation.mutate(f, {
      onSuccess: (data) => {
        setAnalysis(data.analysis);
        setSampleRows(data.sampleRows);
        setRawSampleRows(data.rawSampleRows ?? []);
        setRowCount(data.rowCount);
        setMatchedProfile(data.matchedProfile);
        setAiUsed(data.aiUsed);
        const initial: ColumnMapping[] = data.analysis.columns.map((col) => ({
          columnIndex: col.columnIndex,
          sourceHeader: col.sourceHeader,
          mappedField: col.mappedField,
          confidence: col.confidence,
          method: col.method ?? "unmapped",
        }));
        setMappings(initial);
        setStep("mapping");
      },
      onError: () => {
        setStep("idle");
      },
    });
  }

  function updateMapping(colIndex: number, field: string) {
    setMappings((prev) =>
      prev.map((m) =>
        m.columnIndex === colIndex
          ? { ...m, mappedField: field || null, confidence: field ? 1.0 : 0, method: field ? "alias" : "unmapped" }
          : m,
      ),
    );
  }

  function handleConfirmImport() {
    if (!file || !analysis) return;
    setStep("importing");
    confirmImport.mutate(
      {
        file,
        columnMapping: mappings.filter((m) => m.mappedField),
        dataStartRow: analysis.dataStartRow,
        headerRows: analysis.headerRows,
        fileType: analysis.fileType,
        matchedProfileId: matchedProfile?.id,
        aiUsed,
      },
      {
        onSuccess: (data) => {
          setConfirmResult(data);
          setStep("done");
        },
        onError: () => setStep("preview"),
      },
    );
  }

  function handleLegacyImport() {
    if (!file) return;
    setStep("importing");
    legacyImport.mutate(file, {
      onSuccess: (data) => {
        setConfirmResult({ imported: data.imported, skipped: data.skipped, errors: data.errors ?? [], total: data.total ?? data.imported, format: data.format ?? "legacy", batchId: data.batchId ?? "", profileSaved: false });
        setStep("done");
      },
      onError: () => setStep("idle"),
    });
  }

  function handleReset() {
    setFile(null);
    setStep("idle");
    setAnalysis(null);
    setSampleRows([]);
    setRawSampleRows([]);
    setMappings([]);
    setMatchedProfile(null);
    setAiUsed(false);
    setConfirmResult(null);
    analyzeMutation.reset();
    confirmImport.reset();
    legacyImport.reset();
  }

  const availableFields =
    analysis?.fileType === "building_list" ? BUILDING_FIELDS : TENANT_FIELDS;

  const activeMappings = mappings.filter((m) => m.mappedField);
  const missingRequired = analysis?.requiredFieldsStatus.missingRequiredFields ?? [];

  // ── Step indicator ──
  const steps = [
    { key: "analyzing", label: "Analyze" },
    { key: "mapping", label: "Map Columns" },
    { key: "preview", label: "Preview" },
    { key: "importing", label: "Import" },
    { key: "done", label: "Done" },
  ] as const;

  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="space-y-4">
      {/* ── Drop zone (Step 0) ── */}
      {(step === "idle" || step === "done") && !confirmResult && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
            dragOver ? "border-accent bg-accent/5" : "border-border hover:border-border-light",
          )}
        >
          <Upload className="w-8 h-8 text-text-dim mx-auto mb-3" />
          <p className="text-sm text-text-muted">
            Drag & drop an Excel file here, or <span className="text-accent">browse</span>
          </p>
          <p className="text-xs text-text-dim mt-1">.xlsx, .xls, or .csv — AI will auto-detect the format</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* ── Step progress bar ── */}
      {step !== "idle" && (
        <div className="flex items-center gap-1 px-1">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3 text-text-dim/40" />}
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full transition-colors",
                i < stepIndex ? "text-green-400 bg-green-400/10" :
                i === stepIndex ? "text-accent bg-accent/10 font-medium" :
                "text-text-dim bg-transparent",
              )}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Step 1: Analyzing spinner ── */}
      {step === "analyzing" && file && (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <Loader2 className="w-8 h-8 text-accent mx-auto mb-3 animate-spin" />
          <p className="text-sm font-medium text-text-primary">Analyzing file...</p>
          <p className="text-xs text-text-dim mt-1">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
        </div>
      )}

      {/* ── Step 2: Detection summary + mapping ── */}
      {step === "mapping" && analysis && file && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          {/* Detection summary */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                {aiUsed ? <Sparkles className="w-3.5 h-3.5 text-amber-400" /> : <Zap className="w-3.5 h-3.5 text-green-400" />}
                Analysis Complete
              </h3>
              <p className="text-xs text-text-dim mt-0.5">
                Detected: <span className="text-accent font-medium">{analysis.fileType.replace(/_/g, " ")}</span>
                {" "}({(analysis.confidence * 100).toFixed(0)}% confidence)
                {" "} — {rowCount > 0 ? `${rowCount} rows` : "rows detected"}, data starts row {analysis.dataStartRow}
              </p>
            </div>
            <button onClick={handleReset} className="text-xs text-text-dim hover:text-text-muted">Cancel</button>
          </div>

          {/* Matched profile badge */}
          {matchedProfile && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-medium text-purple-400">
                  Matched profile: &quot;{matchedProfile.name}&quot; ({(matchedProfile.confidence * 100).toFixed(0)}% match)
                </span>
              </div>
            </div>
          )}

          {/* Warnings */}
          {analysis.warnings.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-medium text-amber-400">Warnings</span>
              </div>
              <ul className="text-xs text-amber-400/80 space-y-0.5">
                {analysis.warnings.map((w, i) => <li key={i}>- {w}</li>)}
              </ul>
            </div>
          )}

          {/* Missing required fields */}
          {missingRequired.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-medium text-red-400">Missing Required Fields</span>
              </div>
              <p className="text-xs text-red-400/80">{missingRequired.join(", ")}</p>
            </div>
          )}

          {/* ── Step 3: Mapping review table ── */}
          <div className="bg-bg border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Source Column</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Sample Value</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Mapped To</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim w-16">Conf.</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim w-16">Method</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Override</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => {
                  const sampleVal = sampleRows[Math.min(analysis.dataStartRow - 1, sampleRows.length - 1)]?.[m.columnIndex] ?? "";
                  const conf = m.confidence;
                  const isLow = conf > 0 && conf < 0.8;
                  const isMissing = !m.mappedField && m.sourceHeader;
                  const methodInfo = METHOD_LABELS[m.method ?? "unmapped"] ?? METHOD_LABELS.unmapped;

                  return (
                    <tr
                      key={m.columnIndex}
                      className={cn(
                        "border-b border-border/30",
                        isLow && "bg-amber-500/5",
                        isMissing && "bg-red-500/5",
                      )}
                    >
                      <td className="px-3 py-1.5">
                        <span className="text-xs text-text-primary font-medium">{m.sourceHeader || `Col ${m.columnIndex + 1}`}</span>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-text-dim max-w-[120px] truncate">
                        {sampleVal}
                      </td>
                      <td className="px-3 py-1.5">
                        {m.mappedField ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{m.mappedField}</span>
                        ) : (
                          <span className="text-xs text-text-dim italic">unmapped</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={cn(
                          "text-xs font-medium",
                          conf >= 0.8 ? "text-green-400" : conf >= 0.5 ? "text-amber-400" : "text-red-400",
                        )}>
                          {(conf * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", methodInfo.color)}>
                          {methodInfo.label}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="relative">
                          <select
                            value={m.mappedField || ""}
                            onChange={(e) => updateMapping(m.columnIndex, e.target.value)}
                            className="w-full text-xs bg-card border border-border rounded px-2 py-1 text-text-primary appearance-none pr-6 focus:border-accent focus:outline-none"
                          >
                            {availableFields.map((f) => (
                              <option key={f} value={f}>{f || "— skip —"}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 text-text-dim absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Assumptions */}
          {analysis.assumptions.length > 0 && (
            <details className="text-xs text-text-dim">
              <summary className="cursor-pointer hover:text-text-muted">AI Assumptions ({analysis.assumptions.length})</summary>
              <ul className="mt-1 space-y-0.5 pl-4">
                {analysis.assumptions.map((a, i) => <li key={i}>- {a}</li>)}
              </ul>
            </details>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button onClick={handleLegacyImport} className="text-xs text-text-dim hover:text-text-muted underline">
              Skip AI — use auto-detect
            </button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset}>Cancel</Button>
              <Button onClick={() => setStep("preview")} disabled={activeMappings.length === 0}>
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                Preview Data
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Preview first 5 rows ── */}
      {step === "preview" && analysis && file && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Preview Import Data</h3>
              <p className="text-xs text-text-dim mt-0.5">
                Showing first {Math.min(rawSampleRows.length, 5)} rows with mappings applied
                {" "} — {activeMappings.length} columns mapped
              </p>
            </div>
            <button onClick={() => setStep("mapping")} className="text-xs text-accent hover:text-accent/80">
              Back to mapping
            </button>
          </div>

          {/* Preview table */}
          <div className="bg-bg border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-card">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim w-8">#</th>
                  {activeMappings.map((m) => (
                    <th key={m.columnIndex} className="px-3 py-2 text-left text-xs font-medium text-accent whitespace-nowrap">
                      {m.mappedField}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawSampleRows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="px-3 py-1.5 text-xs text-text-dim">{i + 1}</td>
                    {activeMappings.map((m) => (
                      <td key={m.columnIndex} className="px-3 py-1.5 text-xs text-text-primary max-w-[150px] truncate">
                        {String(row[m.mappedField!] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
                {rawSampleRows.length === 0 && (
                  <tr>
                    <td colSpan={activeMappings.length + 1} className="px-3 py-4 text-xs text-text-dim text-center">
                      No preview data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Missing required fields warning */}
          {missingRequired.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-medium text-red-400">
                  Missing required fields: {missingRequired.join(", ")}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button onClick={handleLegacyImport} className="text-xs text-text-dim hover:text-text-muted underline">
              Skip AI — use auto-detect
            </button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("mapping")}>Back</Button>
              <Button onClick={handleConfirmImport}>
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                Confirm & Import
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 5a: Importing spinner ── */}
      {step === "importing" && (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <Loader2 className="w-8 h-8 text-accent mx-auto mb-3 animate-spin" />
          <p className="text-sm font-medium text-text-primary">Importing data...</p>
        </div>
      )}

      {/* ── Step 5b: Results ── */}
      {step === "done" && confirmResult && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-sm text-green-400">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="font-medium">Import Complete</span>
            </div>
            <div className="text-xs text-green-400/80 space-y-0.5">
              <p>Imported: {confirmResult.imported} rows</p>
              {confirmResult.skipped > 0 && <p>Skipped: {confirmResult.skipped} rows</p>}
              {confirmResult.profileSaved && (
                <p className="text-purple-400/80">Import profile saved for future use</p>
              )}
            </div>
          </div>

          {/* Import warnings/errors */}
          {confirmResult.errors.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-amber-400 hover:text-amber-300">
                {confirmResult.errors.length} warning{confirmResult.errors.length !== 1 ? "s" : ""}
              </summary>
              <ul className="mt-1 text-xs text-text-dim list-disc list-inside max-h-32 overflow-y-auto">
                {confirmResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}

          <button onClick={handleReset} className="text-xs text-accent underline">Import another file</button>
        </div>
      )}

      {/* ── Error state ── */}
      {(confirmImport.isError || analyzeMutation.isError) && step !== "analyzing" && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{confirmImport.error?.message || analyzeMutation.error?.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
