"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileSpreadsheet, X, Loader2, AlertTriangle, AlertCircle, CheckCircle, ChevronDown } from "lucide-react";
import Button from "@/components/ui/button";
import { useAnalyzeImport, useMappedImport, useImportExcel, type AiAnalysis, type ColumnMapping } from "@/hooks/use-import";
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

type Step = "idle" | "analyzing" | "mapping" | "importing" | "done";

export default function UploadZone() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [sampleRows, setSampleRows] = useState<string[][]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const analyzeMutation = useAnalyzeImport();
  const mappedImport = useMappedImport();
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
    setMappings([]);

    analyzeMutation.mutate(f, {
      onSuccess: (data) => {
        setAnalysis(data.analysis);
        setSampleRows(data.sampleRows);
        setRowCount(data.rowCount);
        // Build initial mappings from AI analysis
        const initial: ColumnMapping[] = data.analysis.columns.map((col) => ({
          columnIndex: col.columnIndex,
          sourceHeader: col.sourceHeader,
          mappedField: col.mappedField,
          confidence: col.confidence,
        }));
        setMappings(initial);
        setStep("mapping");
      },
      onError: () => {
        // Fall back to legacy import on AI failure
        setStep("idle");
      },
    });
  }

  function updateMapping(colIndex: number, field: string) {
    setMappings((prev) =>
      prev.map((m) =>
        m.columnIndex === colIndex
          ? { ...m, mappedField: field || null, confidence: field ? 1.0 : 0 }
          : m,
      ),
    );
  }

  function handleConfirmImport() {
    if (!file || !analysis) return;
    setStep("importing");
    mappedImport.mutate(
      {
        file,
        columnMapping: mappings.filter((m) => m.mappedField),
        dataStartRow: analysis.dataStartRow,
        headerRows: analysis.headerRows,
      },
      {
        onSuccess: () => setStep("done"),
        onError: () => setStep("mapping"),
      },
    );
  }

  function handleLegacyImport() {
    if (!file) return;
    setStep("importing");
    legacyImport.mutate(file, {
      onSuccess: () => setStep("done"),
      onError: () => setStep("idle"),
    });
  }

  function handleReset() {
    setFile(null);
    setStep("idle");
    setAnalysis(null);
    setSampleRows([]);
    setMappings([]);
    analyzeMutation.reset();
    mappedImport.reset();
    legacyImport.reset();
  }

  const availableFields =
    analysis?.fileType === "building_list"
      ? BUILDING_FIELDS
      : TENANT_FIELDS;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {(step === "idle" || step === "done") && (
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

      {/* Step 1: Analyzing spinner */}
      {step === "analyzing" && file && (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <Loader2 className="w-8 h-8 text-accent mx-auto mb-3 animate-spin" />
          <p className="text-sm font-medium text-text-primary">Analyzing file with AI...</p>
          <p className="text-xs text-text-dim mt-1">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
        </div>
      )}

      {/* Step 2: Mapping preview */}
      {step === "mapping" && analysis && file && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">AI Analysis Complete</h3>
              <p className="text-xs text-text-dim mt-0.5">
                Detected: <span className="text-accent font-medium">{analysis.fileType.replace(/_/g, " ")}</span>
                {" "}({(analysis.confidence * 100).toFixed(0)}% confidence) — {rowCount} rows, data starts row {analysis.dataStartRow}
              </p>
            </div>
            <button onClick={handleReset} className="text-xs text-text-dim hover:text-text-muted">Cancel</button>
          </div>

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
          {analysis.requiredFieldsStatus.missingRequiredFields.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-medium text-red-400">Missing Required Fields</span>
              </div>
              <p className="text-xs text-red-400/80">
                {analysis.requiredFieldsStatus.missingRequiredFields.join(", ")}
              </p>
            </div>
          )}

          {/* Mapping table */}
          <div className="bg-bg border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Your Column</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Sample</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Mapped To</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim w-20">Confidence</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Override</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => {
                  const aiCol = analysis.columns.find((c) => c.columnIndex === m.columnIndex);
                  // Get sample value from first data row
                  const sampleVal = sampleRows[Math.min(analysis.dataStartRow - 1, sampleRows.length - 1)]?.[m.columnIndex] ?? "";
                  const conf = m.confidence;
                  const confColor = conf >= 0.8 ? "text-green-400" : conf >= 0.5 ? "text-amber-400" : "text-red-400";

                  return (
                    <tr key={m.columnIndex} className="border-b border-border/30">
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
                        <span className={cn("text-xs font-medium", confColor)}>
                          {(conf * 100).toFixed(0)}%
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

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleLegacyImport}
              className="text-xs text-text-dim hover:text-text-muted underline"
            >
              Skip AI — use auto-detect parser
            </button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset}>Cancel</Button>
              <Button onClick={handleConfirmImport}>
                Confirm & Import
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Importing */}
      {step === "importing" && (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <Loader2 className="w-8 h-8 text-accent mx-auto mb-3 animate-spin" />
          <p className="text-sm font-medium text-text-primary">Importing data...</p>
        </div>
      )}

      {/* Step 4: Results */}
      {step === "done" && (mappedImport.data || legacyImport.data) && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-sm text-green-400">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="font-medium">Import Complete</span>
          </div>
          {(() => {
            const data = mappedImport.data || legacyImport.data;
            return (
              <>
                <p className="text-xs text-green-400/80">
                  Imported {data.imported} records
                  {data.skipped > 0 && `, ${data.skipped} skipped`}
                </p>
                {data.errors?.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-green-400/70">
                      {data.errors.length} warnings
                    </summary>
                    <ul className="mt-1 text-xs text-text-dim list-disc list-inside">
                      {data.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                    </ul>
                  </details>
                )}
              </>
            );
          })()}
          <button onClick={handleReset} className="mt-2 text-xs text-accent underline">Import another file</button>
        </div>
      )}

      {/* Error state */}
      {(mappedImport.isError || analyzeMutation.isError) && step !== "analyzing" && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{mappedImport.error?.message || analyzeMutation.error?.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
