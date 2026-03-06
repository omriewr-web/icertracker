"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

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
    }): Promise<ConfirmResult> => {
      const formData = new FormData();
      formData.append("file", payload.file);
      formData.append("columnMapping", JSON.stringify(payload.columnMapping));
      formData.append("dataStartRow", String(payload.dataStartRow));
      formData.append("headerRows", JSON.stringify(payload.headerRows));
      formData.append("fileType", payload.fileType);
      if (payload.matchedProfileId) formData.append("matchedProfileId", payload.matchedProfileId);
      formData.append("aiUsed", String(payload.aiUsed));
      const res = await fetch("/api/import/confirm", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["buildings"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
      toast.success(`Imported ${data.imported} records`);
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
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["buildings"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
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
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["buildings"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
      toast.success(`Imported ${data.imported} records`);
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
      qc.invalidateQueries({ queryKey: ["buildings"] });
      qc.invalidateQueries({ queryKey: ["compliance"] });
      toast.success(`Imported ${data.created} new, ${data.updated} updated buildings. ${data.complianceCreated} compliance items generated.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
