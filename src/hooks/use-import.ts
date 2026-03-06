"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

/** All query keys that should be invalidated after any import */
const IMPORT_INVALIDATION_KEYS = [
  "tenants", "buildings", "units", "metrics",
  "vacancies", "legalCases", "violations",
  "workOrders", "collectionCases",
] as const;

function invalidateImportCaches(qc: ReturnType<typeof useQueryClient>) {
  for (const key of IMPORT_INVALIDATION_KEYS) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

export interface ColumnMapping {
  columnIndex: number;
  sourceHeader: string;
  mappedField: string | null;
  confidence: number;
  method?: string;
}

export interface AiAnalysis {
  fileType: string;
  confidence: number;
  headerRows: number[];
  dataStartRow: number;
  ignoredRowTypes: string[];
  ignoredRowIndices: number[];
  columns: Array<{
    columnIndex: number;
    sourceHeader: string;
    normalizedHeader: string;
    mappedField: string | null;
    confidence: number;
    reason: string;
    method?: string;
  }>;
  requiredFieldsStatus: {
    missingRequiredFields: string[];
    presentRequiredFields: string[];
  };
  warnings: string[];
  assumptions: string[];
}

export interface MatchedProfile {
  id: string;
  name: string;
  confidence: number;
}

export interface AnalyzeResult {
  analysis: AiAnalysis;
  sampleRows: string[][];
  rawSampleRows: Record<string, unknown>[];
  rowCount: number;
  sheetName: string;
  matchedProfile: MatchedProfile | null;
  aiUsed: boolean;
}

export interface ConfirmResult {
  imported: number;
  skipped: number;
  errors: string[];
  total: number;
  format: string;
  batchId: string;
  profileSaved: boolean;
}

export function useConfirmImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      file: File;
      columnMapping: ColumnMapping[];
      dataStartRow: number;
      headerRows: number[];
      fileType: string;
      matchedProfileId?: string;
      aiUsed: boolean;
      mode?: "stage" | "direct";
    }): Promise<ConfirmResult | StageResult> => {
      const formData = new FormData();
      formData.append("file", payload.file);
      formData.append("columnMapping", JSON.stringify(payload.columnMapping));
      formData.append("dataStartRow", String(payload.dataStartRow));
      formData.append("headerRows", JSON.stringify(payload.headerRows));
      formData.append("fileType", payload.fileType);
      if (payload.matchedProfileId) formData.append("matchedProfileId", payload.matchedProfileId);
      formData.append("aiUsed", String(payload.aiUsed));
      formData.append("mode", payload.mode || "stage");
      const res = await fetch("/api/import/confirm", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if ("staged" in data && data.staged) {
        qc.invalidateQueries({ queryKey: ["staging-batches"] });
        toast.success(`Staged for review: ${data.summary.total} rows (${data.summary.newTenants} new, ${data.summary.updates} updates)`);
      } else if ("imported" in data) {
        invalidateImportCaches(qc);
        toast.success(`Imported ${data.imported} records`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAnalyzeImport() {
  return useMutation({
    mutationFn: async (file: File): Promise<AnalyzeResult> => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/analyze", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Analysis failed");
      }
      return res.json();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useImportExcel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      invalidateImportCaches(qc);
      toast.success(`Imported ${data.imported} records`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMappedImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, columnMapping, dataStartRow, headerRows }: {
      file: File;
      columnMapping: ColumnMapping[];
      dataStartRow: number;
      headerRows: number[];
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("columnMapping", JSON.stringify(columnMapping));
      formData.append("dataStartRow", String(dataStartRow));
      formData.append("headerRows", JSON.stringify(headerRows));
      const res = await fetch("/api/import", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      invalidateImportCaches(qc);
      toast.success(`Imported ${data.imported} records`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Staging hooks ───────────────────────────────────────────

export interface StagingSummary {
  total: number;
  newTenants: number;
  updates: number;
  vacancies: number;
  errors: number;
  buildings: string[];
}

export interface StagingBatch {
  id: string;
  importType: string;
  fileName: string;
  uploadedById: string;
  status: string;
  summaryJson: StagingSummary;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  importBatchId: string | null;
  createdAt: string;
}

export interface StageResult {
  staged: boolean;
  stagingId: string;
  summary: StagingSummary;
}

export function useStagingBatches(status?: string) {
  return useQuery({
    queryKey: ["staging-batches", status],
    queryFn: async (): Promise<StagingBatch[]> => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/import/staging?${params}`);
      if (!res.ok) throw new Error("Failed to fetch staging batches");
      return res.json();
    },
  });
}

export function useStagingBatchDetail(id: string | null) {
  return useQuery({
    queryKey: ["staging-batch", id],
    queryFn: async () => {
      const res = await fetch(`/api/import/staging?id=${id}`);
      if (!res.ok) throw new Error("Failed to fetch staging batch");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useApproveStagingBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await fetch("/api/import/staging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "approve", notes }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Approval failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["staging-batches"] });
      invalidateImportCaches(qc);
      toast.success(`Approved: imported ${data.imported} records`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRejectStagingBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await fetch("/api/import/staging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "reject", notes }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Rejection failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staging-batches"] });
      toast.success("Batch rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBuildingImportPreview() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/buildings?mode=preview", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Preview failed");
      }
      return res.json();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBuildingImportConfirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/buildings?mode=confirm", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      invalidateImportCaches(qc);
      qc.invalidateQueries({ queryKey: ["compliance"] });
      toast.success(`Imported ${data.created} new, ${data.updated} updated buildings. ${data.complianceCreated} compliance items generated.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
