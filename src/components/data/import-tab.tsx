"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, X, Building2, CheckCircle, AlertCircle } from "lucide-react";
import Button from "@/components/ui/button";
import UploadZone from "@/components/data/upload-zone";
import OnboardingCards from "@/components/data/onboarding-cards";
import ImportHistory from "@/components/data/import-history";
import { useBuildingImportPreview, useBuildingImportConfirm } from "@/hooks/use-import";
import { cn } from "@/lib/utils";

export default function ImportTab() {
  return (
    <div className="space-y-6">
      {/* Quick Import Cards */}
      <OnboardingCards />

      {/* Smart Tenant Data Import (auto-detection) */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-text-primary mb-1">Smart Import (Auto-Detect)</h2>
        <p className="text-xs text-text-dim mb-4">
          Drop any Yardi, AppFolio, DHCR, or ConEd export — the format will be auto-detected.
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
          Upload a building data spreadsheet with property info, construction details, life safety systems, elevator/boiler data, and compliance filing dates.
        </p>
        <BuildingDataUpload />
      </div>

      {/* Import History */}
      <ImportHistory />
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

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
          dragOver ? "border-accent bg-accent/5" : "border-border hover:border-accent/50",
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
        <FileSpreadsheet className="w-8 h-8 text-text-dim mx-auto mb-2" />
        <p className="text-sm text-text-muted">{file ? file.name : "Drop Excel file here or click to browse"}</p>
      </div>

      {file && !preview && (
        <Button onClick={handlePreview} disabled={previewMutation.isPending}>
          {previewMutation.isPending ? "Analyzing..." : "Preview Import"}
        </Button>
      )}

      {preview && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-sm text-text-primary font-medium">{preview.buildingsFound} buildings found</span>
          </div>
          <p className="text-xs text-text-dim">
            {preview.new} new, {preview.existing} updates
          </p>
          {preview.warnings?.length > 0 && (
            <div className="flex items-start gap-2 text-amber-400">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <p className="text-xs">{preview.warnings.join(". ")}</p>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleConfirm} disabled={confirmMutation.isPending}>
              {confirmMutation.isPending ? "Importing..." : "Confirm Import"}
            </Button>
            <Button variant="outline" onClick={() => { setFile(null); setPreview(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {confirmMutation.isSuccess && (
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm">Building data imported successfully</span>
        </div>
      )}
    </div>
  );
}
