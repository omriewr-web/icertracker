"use client";

import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import Button from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedRow {
  rowIndex: number;
  buildingAddress: string | null;
  block: string | null;
  lot: string | null;
  unitNumber: string;
  legalRent: number | null;
  prefRent: number | null;
  isStabilized: boolean | null;
  dhcrId: string | null;
  matchedBuildingId: string | null;
  matchedBuildingAddress: string | null;
  matchedUnitId: string | null;
  matchStatus: "matched" | "building_only" | "no_match";
}

interface ParseResponse {
  rows: ParsedRow[];
  counts: { matched: number; buildingOnly: number; noMatch: number };
  error?: string;
}

interface ConfirmResponse {
  successCount: number;
  errorCount: number;
  errors: string[];
}

type Step = "upload" | "preview" | "done";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(val: number | null): string {
  if (val == null) return "-";
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const matchStatusConfig = {
  matched: {
    label: "Matched",
    icon: CheckCircle2,
    rowClass: "bg-green-500/10 border-l-4 border-l-green-500",
    badgeClass: "text-green-400 bg-green-500/10",
  },
  building_only: {
    label: "Building Only",
    icon: AlertTriangle,
    rowClass: "bg-yellow-500/10 border-l-4 border-l-yellow-500",
    badgeClass: "text-yellow-400 bg-yellow-500/10",
  },
  no_match: {
    label: "No Match",
    icon: XCircle,
    rowClass: "bg-red-500/10 border-l-4 border-l-red-500",
    badgeClass: "text-red-400 bg-red-500/10",
  },
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LegalRentImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [counts, setCounts] = useState<ParseResponse["counts"]>({
    matched: 0,
    buildingOnly: 0,
    noMatch: 0,
  });
  const [importResult, setImportResult] = useState<ConfirmResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse mutation
  const parseMutation = useMutation({
    mutationFn: async (selectedFile: File) => {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch("/api/import/legal-rent/parse", {
        method: "POST",
        body: formData,
      });
      const data: ParseResponse = await res.json();
      if (!res.ok) throw new Error(data.error || "Parse failed");
      return data;
    },
    onSuccess: (data) => {
      setRows(data.rows);
      setCounts(data.counts);
      setStep("preview");
      if (data.rows.length === 0) {
        toast.error("No data rows found in the file.");
      } else {
        toast.success(`Parsed ${data.rows.length} rows.`);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Confirm mutation
  const confirmMutation = useMutation({
    mutationFn: async (matchedRows: ParsedRow[]) => {
      const payload = matchedRows.map((r) => ({
        matchedUnitId: r.matchedUnitId!,
        matchedBuildingId: r.matchedBuildingId!,
        legalRent: r.legalRent,
        prefRent: r.prefRent,
        isStabilized: r.isStabilized,
        dhcrId: r.dhcrId,
      }));
      const res = await fetch("/api/import/legal-rent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload }),
      });
      const data: ConfirmResponse = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error: string }).error || "Import failed");
      return data;
    },
    onSuccess: (data) => {
      setImportResult(data);
      setStep("done");
      if (data.errorCount === 0) {
        toast.success(`Successfully imported ${data.successCount} rows.`);
      } else {
        toast(`Imported ${data.successCount} rows with ${data.errorCount} errors.`, { icon: "⚠️" });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  }, []);

  const handleParse = useCallback(() => {
    if (!file) return;
    parseMutation.mutate(file);
  }, [file, parseMutation]);

  const handleConfirm = useCallback(() => {
    const matched = rows.filter((r) => r.matchStatus === "matched");
    if (matched.length === 0) {
      toast.error("No fully matched rows to import.");
      return;
    }
    confirmMutation.mutate(matched);
  }, [rows, confirmMutation]);

  const handleReset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setRows([]);
    setCounts({ matched: 0, buildingOnly: 0, noMatch: 0 });
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const res = await fetch("/api/import/legal-rent/template");
      if (!res.ok) throw new Error("Failed to download template");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "legal-rent-import-template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download template.");
    }
  }, []);

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/data"
          className="flex items-center gap-1 text-text-dim hover:text-text-muted transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Data Management
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Legal Rent Import
        </h1>
        <p className="text-text-muted text-sm mt-1">
          Bulk update legal rents, preferential rents, stabilization status, and
          DHCR registration IDs from a spreadsheet.
        </p>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Step 1: Upload */}
      {/* ---------------------------------------------------------------- */}
      {step === "upload" && (
        <div className="bg-atlas-navy-3 border border-border rounded-xl p-6 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-accent/10">
              <FileSpreadsheet className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-text-primary">
                Upload Spreadsheet
              </h2>
              <p className="text-text-muted text-sm mt-1">
                Upload an .xlsx or .csv file with legal rent data. The file must
                include at minimum <strong>Unit Number</strong> and{" "}
                <strong>Legal Rent</strong> columns, plus a{" "}
                <strong>Building Address</strong> or{" "}
                <strong>Block/Lot</strong> to match buildings.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="md" onClick={handleDownloadTemplate}>
              <Download className="w-4 h-4" />
              Download Template
            </Button>
          </div>

          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <Upload className="w-10 h-10 text-text-dim mx-auto mb-3" />
            <p className="text-text-muted text-sm mb-3">
              Select an .xlsx or .csv file to upload
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              onChange={handleFileChange}
              className="block mx-auto text-sm text-text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-border file:text-sm file:font-medium file:bg-atlas-navy-2 file:text-text-primary hover:file:bg-card-hover file:cursor-pointer file:transition-colors"
            />
            {file && (
              <p className="mt-3 text-sm text-text-primary">
                Selected: <span className="font-medium">{file.name}</span>{" "}
                <span className="text-text-dim">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleParse}
              disabled={!file || parseMutation.isPending}
              size="lg"
            >
              {parseMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Parse File
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Step 2: Preview */}
      {/* ---------------------------------------------------------------- */}
      {step === "preview" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Match Summary
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-lg font-bold text-green-400">
                    {counts.matched}
                  </p>
                  <p className="text-xs text-text-muted">
                    Fully Matched (will import)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <div>
                  <p className="text-lg font-bold text-yellow-400">
                    {counts.buildingOnly}
                  </p>
                  <p className="text-xs text-text-muted">
                    Building Only (unit not found)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <XCircle className="w-5 h-5 text-red-400" />
                <div>
                  <p className="text-lg font-bold text-red-400">
                    {counts.noMatch}
                  </p>
                  <p className="text-xs text-text-muted">
                    No Match (skipped)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-atlas-navy-2">
                    <th className="text-left px-4 py-3 text-text-dim font-medium text-xs uppercase tracking-wider sticky top-0">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-text-dim font-medium text-xs uppercase tracking-wider sticky top-0">
                      Building
                    </th>
                    <th className="text-left px-4 py-3 text-text-dim font-medium text-xs uppercase tracking-wider sticky top-0">
                      Unit
                    </th>
                    <th className="text-right px-4 py-3 text-text-dim font-medium text-xs uppercase tracking-wider sticky top-0">
                      Legal Rent
                    </th>
                    <th className="text-right px-4 py-3 text-text-dim font-medium text-xs uppercase tracking-wider sticky top-0">
                      Pref Rent
                    </th>
                    <th className="text-center px-4 py-3 text-text-dim font-medium text-xs uppercase tracking-wider sticky top-0">
                      Stabilized
                    </th>
                    <th className="text-left px-4 py-3 text-text-dim font-medium text-xs uppercase tracking-wider sticky top-0">
                      DHCR ID
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const cfg = matchStatusConfig[row.matchStatus];
                    const Icon = cfg.icon;
                    return (
                      <tr
                        key={row.rowIndex}
                        className={`${cfg.rowClass} border-b border-border/50 hover:bg-card-hover/30 transition-colors`}
                      >
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badgeClass}`}
                          >
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-text-primary">
                          {row.matchedBuildingAddress || row.buildingAddress || (
                            <span className="text-text-dim italic">
                              {row.block && row.lot
                                ? `Block ${row.block} / Lot ${row.lot}`
                                : "No address"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-text-primary font-medium">
                          {row.unitNumber}
                        </td>
                        <td className="px-4 py-2.5 text-right text-text-primary tabular-nums">
                          {formatCurrency(row.legalRent)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-text-muted tabular-nums">
                          {formatCurrency(row.prefRent)}
                        </td>
                        <td className="px-4 py-2.5 text-center text-text-muted">
                          {row.isStabilized == null
                            ? "-"
                            : row.isStabilized
                              ? "Yes"
                              : "No"}
                        </td>
                        <td className="px-4 py-2.5 text-text-muted font-mono text-xs">
                          {row.dhcrId || "-"}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-text-dim"
                      >
                        No rows parsed from the file.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handleReset}>
              <ArrowLeft className="w-4 h-4" />
              Start Over
            </Button>
            <div className="flex items-center gap-3">
              {counts.matched === 0 && (
                <p className="text-sm text-text-dim">
                  No fully matched rows to import.
                </p>
              )}
              <Button
                onClick={handleConfirm}
                disabled={counts.matched === 0 || confirmMutation.isPending}
                size="lg"
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Import {counts.matched} Matched Row
                    {counts.matched !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Step 3: Done */}
      {/* ---------------------------------------------------------------- */}
      {step === "done" && importResult && (
        <div className="bg-atlas-navy-3 border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-green-500/10">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Import Complete
              </h2>
              <p className="text-text-muted text-sm mt-1">
                Successfully updated{" "}
                <span className="font-semibold text-green-400">
                  {importResult.successCount}
                </span>{" "}
                unit{importResult.successCount !== 1 ? "s" : ""}.
                {importResult.errorCount > 0 && (
                  <>
                    {" "}
                    <span className="font-semibold text-red-400">
                      {importResult.errorCount}
                    </span>{" "}
                    error{importResult.errorCount !== 1 ? "s" : ""} occurred.
                  </>
                )}
              </p>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
              <p className="text-sm font-medium text-red-400 mb-2">Errors:</p>
              <ul className="space-y-1">
                {importResult.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-300 font-mono">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset}>
              Import Another File
            </Button>
            <Link href="/data">
              <Button variant="ghost">Back to Data Management</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Instructions */}
      {step === "upload" && (
        <div className="bg-atlas-navy-3/50 border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            How it works
          </h3>
          <ol className="space-y-2 text-sm text-text-muted list-decimal list-inside">
            <li>
              Download the template or prepare your own file with the required
              columns.
            </li>
            <li>
              Include <strong>Building Address</strong> (or Block/Lot) and{" "}
              <strong>Unit Number</strong> to match existing records.
            </li>
            <li>
              Upload and parse the file to preview which rows match your
              portfolio.
            </li>
            <li>
              Review the color-coded preview: green rows will be imported,
              yellow/red rows are skipped.
            </li>
            <li>
              Confirm to update <strong>Legal Rent</strong>,{" "}
              <strong>Preferential Rent</strong>,{" "}
              <strong>Rent Stabilized</strong> status, and{" "}
              <strong>DHCR Registration ID</strong> on matched units.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
