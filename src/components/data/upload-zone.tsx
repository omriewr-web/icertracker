"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload, FileSpreadsheet, X, Loader2, AlertCircle,
  CheckCircle, Sparkles, Users, DollarSign, Scale, HelpCircle,
} from "lucide-react";
import Button from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

interface DetectResult {
  detected: boolean;
  fileType: "rent_roll" | "ar_aging" | "legal_cases" | "unknown";
  label: string;
  description: string;
  rowCount: number;
  buildingCount: number;
  parseErrors: string[];
}

interface ImportResult {
  // Rent roll fields
  total?: number;
  matched?: number;
  unmatched?: number;
  updated?: number;
  unmatchedRows?: Array<{ reason: string; tenantName?: string; unit?: string; propertyCode?: string; caseNumber?: string; address?: string }>;
  propertyCodes?: string[];
  // AR aging fields
  created?: number;
  // Legal cases fields
  imported?: number;
  skipped?: number;
  errors?: string[];
  // Common
  parseErrors?: string[];
}

const TYPE_ICON: Record<string, typeof Users> = {
  rent_roll: Users,
  ar_aging: DollarSign,
  legal_cases: Scale,
  unknown: HelpCircle,
};

const TYPE_ENDPOINT: Record<string, string> = {
  rent_roll: "/api/import/rent-roll",
  ar_aging: "/api/import/ar-aging",
  legal_cases: "/api/import/legal-cases",
};

const IMPORT_INVALIDATION_KEYS = [
  "tenants", "buildings", "units", "metrics",
  "vacancies", "legalCases", "violations",
  "workOrders", "collectionCases",
] as const;

type Step = "idle" | "detecting" | "detected" | "importing" | "done";

export default function UploadZone() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [detection, setDetection] = useState<DetectResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

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

  async function selectFile(f: File) {
    setFile(f);
    setStep("detecting");
    setDetection(null);
    setImportResult(null);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/import/detect", { method: "POST", body: form });
      const data: DetectResult = await res.json();
      if (!res.ok) throw new Error((data as any).error || "Detection failed");
      setDetection(data);
      setStep("detected");
    } catch (err: any) {
      console.error("[Import] Detection error:", err);
      setError(err?.message || "Failed to analyze file");
      setStep("idle");
    }
  }

  async function handleImport() {
    if (!file || !detection || !detection.detected) return;
    const endpoint = TYPE_ENDPOINT[detection.fileType];
    if (!endpoint) return;

    setStep("importing");
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: form });
      const data: ImportResult = await res.json();
      if (!res.ok) throw new Error((data as any).error || "Import failed");
      setImportResult(data);
      setStep("done");
      for (const key of IMPORT_INVALIDATION_KEYS) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      toast.success("Import complete");
    } catch (err: any) {
      console.error("[Import] Upload error:", err);
      setError(err?.message || "Import failed — check your connection and try again.");
      setStep("detected");
    }
  }

  function handleReset() {
    setFile(null);
    setStep("idle");
    setDetection(null);
    setImportResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const Icon = detection ? TYPE_ICON[detection.fileType] ?? HelpCircle : HelpCircle;

  return (
    <div className="space-y-4">
      {/* ── Drop zone ── */}
      {(step === "idle") && (
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
            Drag & drop any import file here, or <span className="text-accent">browse</span>
          </p>
          <p className="text-xs text-text-dim mt-1">
            Supports Yardi Rent Roll, AR Aging, and Legal Cases (.xlsx)
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* ── Detecting spinner ── */}
      {step === "detecting" && file && (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <Loader2 className="w-8 h-8 text-accent mx-auto mb-3 animate-spin" />
          <p className="text-sm font-medium text-text-primary">Analyzing file...</p>
          <p className="text-xs text-text-dim mt-1">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
        </div>
      )}

      {/* ── Detection result ── */}
      {step === "detected" && detection && file && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          {detection.detected ? (
            <>
              {/* Summary card */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <h3 className="text-sm font-semibold text-text-primary">
                      Detected: {detection.label}
                    </h3>
                  </div>
                  <p className="text-xs text-text-dim mt-1">
                    {detection.description}
                  </p>
                  <p className="text-xs text-text-dim mt-0.5">
                    File: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                </div>
                <button onClick={handleReset} className="text-text-dim hover:text-text-muted flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-bg border border-border rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-text-primary font-display">{detection.rowCount.toLocaleString()}</p>
                  <p className="text-xs text-text-dim">
                    {detection.fileType === "legal_cases" ? "Legal Cases" : "Tenant Rows"}
                  </p>
                </div>
                <div className="bg-bg border border-border rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-text-primary font-display">{detection.buildingCount}</p>
                  <p className="text-xs text-text-dim">Buildings</p>
                </div>
              </div>

              {/* Parse warnings */}
              {detection.parseErrors.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-medium text-amber-400">
                      {detection.parseErrors.length} warning{detection.parseErrors.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <ul className="text-xs text-amber-400/80 space-y-0.5">
                    {detection.parseErrors.slice(0, 5).map((e, i) => <li key={i}>- {e}</li>)}
                    {detection.parseErrors.length > 5 && (
                      <li>... and {detection.parseErrors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="outline" onClick={handleReset}>Cancel</Button>
                <Button onClick={handleImport}>
                  <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                  Import {detection.rowCount.toLocaleString()} Rows
                </Button>
              </div>
            </>
          ) : (
            /* Unrecognized file */
            <>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Unrecognized File Format
                  </h3>
                  <p className="text-xs text-text-dim mt-1">
                    Could not detect the file type for <span className="text-text-muted">{file.name}</span>
                  </p>
                </div>
                <button onClick={handleReset} className="text-text-dim hover:text-text-muted flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-bg border border-border rounded-lg px-4 py-3">
                <p className="text-xs font-medium text-text-muted mb-2">Supported formats:</p>
                <ul className="text-xs text-text-dim space-y-1">
                  <li className="flex items-center gap-2">
                    <Users className="w-3 h-3 text-accent" />
                    <span><span className="text-text-muted">Yardi Rent Roll</span> — RentRollwithLeaseCharges export with tenant IDs starting with &apos;t&apos;</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <DollarSign className="w-3 h-3 text-accent" />
                    <span><span className="text-text-muted">Yardi AR Aging</span> — AgingSummary export with &quot;Aged Receivables&quot; title</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Scale className="w-3 h-3 text-accent" />
                    <span><span className="text-text-muted">Legal Cases</span> — Cases by address with case numbers and amounts</span>
                  </li>
                </ul>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={handleReset}>Try Another File</Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Importing spinner ── */}
      {step === "importing" && (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <Loader2 className="w-8 h-8 text-accent mx-auto mb-3 animate-spin" />
          <p className="text-sm font-medium text-text-primary">Importing data...</p>
          <p className="text-xs text-text-dim mt-1">
            {detection?.label} — {detection?.rowCount.toLocaleString()} rows
          </p>
        </div>
      )}

      {/* ── Import results ── */}
      {step === "done" && importResult && detection && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-semibold text-green-400">{detection.label} Import Complete</h3>
            </div>
            <button onClick={handleReset} className="text-xs text-accent underline">Import another</button>
          </div>

          {/* Result stats — adapt grid based on file type */}
          {detection.fileType === "rent_roll" && (
            <div className="grid grid-cols-4 gap-3">
              <ResultStat value={importResult.total ?? 0} label="Total Rows" />
              <ResultStat value={importResult.matched ?? 0} label="Matched" color="green" />
              <ResultStat value={importResult.updated ?? 0} label="Updated" color="blue" />
              <ResultStat value={importResult.unmatched ?? 0} label="Unmatched" color={importResult.unmatched ? "amber" : undefined} />
            </div>
          )}
          {detection.fileType === "ar_aging" && (
            <div className="grid grid-cols-4 gap-3">
              <ResultStat value={importResult.total ?? 0} label="Total Rows" />
              <ResultStat value={importResult.matched ?? 0} label="Matched" color="green" />
              <ResultStat value={importResult.created ?? 0} label="Created" color="blue" />
              <ResultStat value={importResult.updated ?? 0} label="Updated" color="blue" />
            </div>
          )}
          {detection.fileType === "legal_cases" && (
            <div className="grid grid-cols-3 gap-3">
              <ResultStat value={importResult.total ?? 0} label="Total Cases" />
              <ResultStat value={importResult.imported ?? 0} label="Imported" color="green" />
              <ResultStat value={importResult.skipped ?? 0} label="Skipped" color={importResult.skipped ? "amber" : undefined} />
            </div>
          )}

          {/* Unmatched rows detail */}
          {(importResult.unmatchedRows?.length ?? 0) > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-amber-400 hover:text-amber-300">
                {importResult.unmatchedRows!.length} unmatched row{importResult.unmatchedRows!.length !== 1 ? "s" : ""} — click to expand
              </summary>
              <ul className="mt-2 text-xs text-text-dim list-disc list-inside max-h-40 overflow-y-auto space-y-0.5">
                {importResult.unmatchedRows!.map((r, i) => (
                  <li key={i}>
                    {r.reason}
                    {r.tenantName && ` (${r.tenantName}`}
                    {r.unit && `, Unit: ${r.unit}`}
                    {r.tenantName && ")"}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Import errors */}
          {(importResult.errors?.length ?? 0) > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-amber-400 hover:text-amber-300">
                {importResult.errors!.length} error{importResult.errors!.length !== 1 ? "s" : ""}
              </summary>
              <ul className="mt-2 text-xs text-text-dim list-disc list-inside max-h-32 overflow-y-auto">
                {importResult.errors!.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}

          {/* Parse warnings */}
          {(importResult.parseErrors?.length ?? 0) > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-amber-400/70 hover:text-amber-300">
                {importResult.parseErrors!.length} parse warning{importResult.parseErrors!.length !== 1 ? "s" : ""}
              </summary>
              <ul className="mt-2 text-xs text-text-dim list-disc list-inside max-h-32 overflow-y-auto">
                {importResult.parseErrors!.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* ── Error state ── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={handleReset} className="text-xs underline flex-shrink-0">Try again</button>
        </div>
      )}
    </div>
  );
}

function ResultStat({ value, label, color }: { value: number; label: string; color?: "green" | "blue" | "amber" }) {
  const colorClass = color === "green" ? "text-green-400 border-green-500/30"
    : color === "blue" ? "text-blue-400 border-blue-500/30"
    : color === "amber" ? "text-amber-400 border-amber-500/30"
    : "text-text-primary border-border";

  return (
    <div className={cn("bg-bg border rounded-lg p-3 text-center", colorClass)}>
      <p className={cn("text-2xl font-bold font-display", color ? undefined : "text-text-primary")}>{value.toLocaleString()}</p>
      <p className="text-xs text-text-dim">{label}</p>
    </div>
  );
}
