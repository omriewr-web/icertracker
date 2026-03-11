"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload, Loader2, CheckCircle, AlertCircle, AlertTriangle,
  ChevronRight, Shield, Eye, UserCheck, UserX,
} from "lucide-react";
import Button from "@/components/ui/button";
import {
  useLegalImportPreview, useLegalImportConfirm,
  type LegalMatchRow, type LegalPreviewResult, type LegalImportResult,
} from "@/hooks/use-legal-import";
import { cn } from "@/lib/utils";

const MATCH_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  exact:        { label: "Exact Match",   color: "text-green-400",  bg: "bg-green-400/10" },
  likely:       { label: "Likely Match",  color: "text-blue-400",   bg: "bg-blue-400/10" },
  needs_review: { label: "Needs Review",  color: "text-amber-400",  bg: "bg-amber-400/10" },
  no_match:     { label: "No Match",      color: "text-red-400",    bg: "bg-red-400/10" },
};

const ACTION_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  new_case:     { label: "New case",                        color: "text-green-400",  bg: "bg-green-400/10" },
  will_update:  { label: "Will update existing case",       color: "text-blue-400",   bg: "bg-blue-400/10" },
  duplicate:    { label: "Duplicate — active case exists",  color: "text-red-400",    bg: "bg-red-400/10" },
  needs_review: { label: "Needs review",                    color: "text-amber-400",  bg: "bg-amber-400/10" },
};

type Step = "idle" | "uploading" | "preview" | "importing" | "done";

interface Props {
  onDone?: () => void;
}

export default function LegalImportWizard({ onDone }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [preview, setPreview] = useState<LegalPreviewResult | null>(null);
  const [result, setResult] = useState<LegalImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewMutation = useLegalImportPreview();
  const confirmMutation = useLegalImportConfirm();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv"))) {
      startPreview(f);
    }
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) startPreview(f);
  }

  function startPreview(f: File) {
    setFile(f);
    setStep("uploading");
    setPreview(null);
    setResult(null);

    previewMutation.mutate(f, {
      onSuccess: (data) => {
        setPreview(data);
        setStep("preview");
      },
      onError: () => setStep("idle"),
    });
  }

  function handleConfirmImport() {
    if (!file) return;
    setStep("importing");
    confirmMutation.mutate(file, {
      onSuccess: (data) => {
        setResult(data);
        setStep("done");
      },
      onError: () => setStep("preview"),
    });
  }

  function handleReset() {
    setFile(null);
    setStep("idle");
    setPreview(null);
    setResult(null);
    previewMutation.reset();
    confirmMutation.reset();
  }

  const steps = [
    { key: "uploading", label: "Upload" },
    { key: "preview", label: "Preview Matches" },
    { key: "importing", label: "Import" },
    { key: "done", label: "Done" },
  ] as const;
  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="space-y-4">
      {/* Step progress */}
      {step !== "idle" && (
        <div className="flex items-center gap-1 px-1">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3 text-text-dim/40" />}
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                i < stepIndex ? "text-green-400 bg-green-400/10" :
                i === stepIndex ? "text-accent bg-accent/10 font-medium" :
                "text-text-dim",
              )}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      {step === "idle" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
            dragOver ? "border-purple-500 bg-purple-500/5" : "border-border hover:border-border-light",
          )}
        >
          <Shield className="w-8 h-8 text-purple-400 mx-auto mb-3" />
          <p className="text-sm text-text-muted">
            Drop legal cases file here, or <span className="text-purple-400">browse</span>
          </p>
          <p className="text-xs text-text-dim mt-1">.xlsx, .xls, or .csv — cases will be matched to existing tenants</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="hidden" />
        </div>
      )}

      {/* Uploading */}
      {step === "uploading" && (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <Loader2 className="w-8 h-8 text-purple-400 mx-auto mb-3 animate-spin" />
          <p className="text-sm font-medium text-text-primary">Matching cases to tenants...</p>
          <p className="text-xs text-text-dim mt-1">{file?.name}</p>
        </div>
      )}

      {/* Preview */}
      {step === "preview" && preview && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3">
            {([
              { key: "exact", label: "Exact Match", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
              { key: "likely", label: "Likely Match", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
              { key: "needsReview", label: "Needs Review", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
              { key: "noMatch", label: "No Match", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
            ] as const).map((s) => (
              <div key={s.key} className={cn("rounded-lg border px-3 py-2 text-center", s.bg)}>
                <p className={cn("text-lg font-bold", s.color)}>{preview.summary[s.key]}</p>
                <p className="text-[10px] text-text-dim">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Info about auto-import */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2">
            <p className="text-xs text-blue-400">
              <strong>Exact</strong> and <strong>Likely</strong> matches will be auto-imported.
              {" "}<strong>Needs Review</strong> and <strong>No Match</strong> cases go to the review queue.
            </p>
          </div>

          {preview.summary.duplicates > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
              <p className="text-xs text-red-400">
                <strong>{preview.summary.duplicates}</strong> row{preview.summary.duplicates !== 1 ? "s" : ""} skipped as duplicates — tenant already has an active case.
              </p>
            </div>
          )}

          {/* Match table */}
          <div className="bg-bg border border-border rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-card sticky top-0 z-10">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Source Tenant</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Address / Unit</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Case #</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Match</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Matched To</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Action</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-text-dim">Conf.</th>
                </tr>
              </thead>
              <tbody>
                {preview.matches.map((m) => {
                  const style = MATCH_STYLES[m.matchType] ?? MATCH_STYLES.no_match;
                  return (
                    <tr key={m.rowIndex} className={cn("border-b border-border/30", m.matchType === "needs_review" && "bg-amber-500/5", m.matchType === "no_match" && "bg-red-500/5")}>
                      <td className="px-3 py-1.5 text-xs text-text-dim">{m.rowIndex + 1}</td>
                      <td className="px-3 py-1.5 text-xs text-text-primary font-medium">{m.sourceTenantName}</td>
                      <td className="px-3 py-1.5 text-xs text-text-dim">
                        {m.sourceAddress}{m.sourceUnit ? ` #${m.sourceUnit}` : ""}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-text-dim">{m.sourceCaseNumber || "—"}</td>
                      <td className="px-3 py-1.5">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", style.color, style.bg)}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-xs">
                        {m.matchedTenantName ? (
                          <span className="text-text-primary">
                            {m.matchedTenantName}
                            <span className="text-text-dim ml-1">
                              #{m.matchedUnit} — {m.matchedBuilding}
                            </span>
                          </span>
                        ) : (
                          <span className="text-text-dim italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        {(() => {
                          const actionStyle = ACTION_STYLES[m.importAction] ?? ACTION_STYLES.needs_review;
                          return (
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", actionStyle.color, actionStyle.bg)}>
                              {actionStyle.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <span className={cn("text-xs font-medium", style.color)}>
                          {(m.confidence * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button onClick={handleReset} className="text-xs text-text-dim hover:text-text-muted">Cancel</button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset}>Start Over</Button>
              <Button onClick={handleConfirmImport}>
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                Confirm Import ({preview.summary.exact + preview.summary.likely - (preview.summary.duplicates || 0)} auto, {preview.summary.needsReview + preview.summary.noMatch} to review{preview.summary.duplicates ? `, ${preview.summary.duplicates} dupes skipped` : ""})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Importing */}
      {step === "importing" && (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <Loader2 className="w-8 h-8 text-purple-400 mx-auto mb-3 animate-spin" />
          <p className="text-sm font-medium text-text-primary">Importing legal cases...</p>
        </div>
      )}

      {/* Done */}
      {step === "done" && result && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium text-green-400">Legal Import Complete</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-green-400/80">Imported:</span>
                <span className="text-green-400 font-bold ml-1">{result.imported}</span>
              </div>
              <div>
                <span className="text-amber-400/80">Queued for review:</span>
                <span className="text-amber-400 font-bold ml-1">{result.queued}</span>
              </div>
              {result.duplicatesSkipped > 0 && (
                <div>
                  <span className="text-red-400/80">Duplicates skipped:</span>
                  <span className="text-red-400 font-bold ml-1">{result.duplicatesSkipped}</span>
                </div>
              )}
              <div>
                <span className="text-red-400/80">Skipped:</span>
                <span className="text-red-400 font-bold ml-1">{result.skipped}</span>
              </div>
            </div>
          </div>

          {result.queued > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-400">
                {result.queued} case{result.queued !== 1 ? "s" : ""} need manual review.
                Check the Review Queue tab to match them.
              </p>
            </div>
          )}

          {result.errors.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-red-400">{result.errors.length} errors</summary>
              <ul className="mt-1 text-xs text-text-dim list-disc list-inside max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}

          <div className="flex gap-2">
            <button onClick={handleReset} className="text-xs text-accent underline">Import another file</button>
            {onDone && <button onClick={onDone} className="text-xs text-text-dim underline">Close</button>}
          </div>
        </div>
      )}

      {/* Error */}
      {(previewMutation.isError || confirmMutation.isError) && step === "idle" && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{previewMutation.error?.message || confirmMutation.error?.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
