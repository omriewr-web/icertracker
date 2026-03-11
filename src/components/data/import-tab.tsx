"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, X, Building2, CheckCircle, AlertCircle } from "lucide-react";
import Button from "@/components/ui/button";
import UploadZone from "@/components/data/upload-zone";
import { useBuildingImportPreview, useBuildingImportConfirm } from "@/hooks/use-import";
import { cn } from "@/lib/utils";

export default function ImportTab() {
  return (
    <div className="space-y-6">
      {/* Smart Tenant Data Import */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-text-primary mb-1">Tenant Data Import</h2>
        <p className="text-xs text-text-dim mb-4">
          Drop any Yardi export file — rent rolls, AR aging reports, or legal cases. The format will be auto-detected.
        </p>
        <UploadZone />
      </div>

      {/* Building Data Import */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Building Data Import</h2>
        </div>
        <p className="text-xs text-text-dim mb-4">
          Upload a building data spreadsheet with property info, construction details, life safety systems, elevator/boiler data, and compliance filing dates. Existing buildings are matched by address or block/lot and updated.
        </p>
        <BuildingDataUpload />
      </div>
    </div>
  );
}

function BuildingDataUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewMutation = useBuildingImportPreview();
  const confirmMutation = useBuildingImportConfirm();
  const [preview, setPreview] = useState<any>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(null);
      previewMutation.reset();
      confirmMutation.reset();
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls"))) {
      setFile(f);
      setPreview(null);
      previewMutation.reset();
      confirmMutation.reset();
    }
  }

  function handlePreview() {
    if (!file) return;
    previewMutation.mutate(file, {
      onSuccess: (data) => setPreview(data),
    });
  }

  function handleConfirm() {
    if (!file) return;
    confirmMutation.mutate(file, {
      onSuccess: () => {
        setFile(null);
        setPreview(null);
      },
    });
  }

  function handleReset() {
    setFile(null);
    setPreview(null);
    previewMutation.reset();
    confirmMutation.reset();
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
          dragOver ? "border-accent bg-accent/5" : "border-border hover:border-border-light"
        )}
      >
        <Upload className="w-6 h-6 text-text-dim mx-auto mb-2" />
        <p className="text-sm text-text-muted">
          Drop a building data file here, or <span className="text-accent">browse</span>
        </p>
        <p className="text-xs text-text-dim mt-1">Columns: Address, Block, Lot, BIN, Sprinkler, Elevator, Boiler, etc.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* File selected */}
      {file && !preview && !confirmMutation.data && (
        <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
          <FileSpreadsheet className="w-5 h-5 text-green-400" />
          <div className="flex-1">
            <p className="text-sm text-text-primary">{file.name}</p>
            <p className="text-xs text-text-dim">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button onClick={handleReset} className="text-text-dim hover:text-text-muted">
            <X className="w-4 h-4" />
          </button>
          <Button onClick={handlePreview} disabled={previewMutation.isPending}>
            {previewMutation.isPending ? "Analyzing..." : "Preview Import"}
          </Button>
        </div>
      )}

      {/* Preview results */}
      {preview && (
        <div className="bg-bg border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Import Preview</h3>
            <button onClick={handleReset} className="text-xs text-text-dim hover:text-text-muted">Cancel</button>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-text-primary">{preview.total}</p>
              <p className="text-xs text-text-dim">Total Buildings</p>
            </div>
            <div className="bg-card border border-green-500/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{preview.toCreate}</p>
              <p className="text-xs text-text-dim">New Buildings</p>
            </div>
            <div className="bg-card border border-blue-500/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">{preview.toUpdate}</p>
              <p className="text-xs text-text-dim">To Update</p>
            </div>
          </div>

          {/* Preview table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Row</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Address</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Action</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-dim">Matched By</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((p: any, i: number) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="px-3 py-1.5 text-text-dim text-xs">{p.rowIndex}</td>
                    <td className="px-3 py-1.5 text-text-primary text-xs">{p.address}</td>
                    <td className="px-3 py-1.5">
                      {p.action === "create" ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">New</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Update</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-text-dim text-xs">{p.matchedBy || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Errors */}
          {preview.errors?.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-400">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">{preview.errors.length} warnings:</p>
                <ul className="list-disc list-inside text-text-dim">
                  {preview.errors.slice(0, 5).map((e: string, i: number) => <li key={i}>{e}</li>)}
                  {preview.errors.length > 5 && <li>... and {preview.errors.length - 5} more</li>}
                </ul>
              </div>
            </div>
          )}

          {/* Confirm button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleReset}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={confirmMutation.isPending}>
              {confirmMutation.isPending ? "Importing..." : `Import ${preview.total} Buildings`}
            </Button>
          </div>
        </div>
      )}

      {/* Error states */}
      {previewMutation.isError && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{previewMutation.error?.message || "Preview failed"}</span>
          <button onClick={handleReset} className="ml-auto text-xs underline">Try again</button>
        </div>
      )}
      {confirmMutation.isError && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{confirmMutation.error?.message || "Import failed"}</span>
          <button onClick={handleReset} className="ml-auto text-xs underline">Try again</button>
        </div>
      )}

      {/* Success message */}
      {confirmMutation.data && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-sm text-green-400">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="font-medium">Import Complete</span>
          </div>
          <p className="text-xs text-green-400/80">
            {confirmMutation.data.created} created, {confirmMutation.data.updated} updated.
            {confirmMutation.data.complianceCreated > 0 && ` ${confirmMutation.data.complianceCreated} compliance items auto-generated.`}
          </p>
          {confirmMutation.data.errors?.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-green-400/70">
                {confirmMutation.data.errors.length} warnings
              </summary>
              <ul className="mt-1 text-xs text-text-dim list-disc list-inside">
                {confirmMutation.data.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
