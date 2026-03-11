"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export type ImportAction = "new_case" | "will_update" | "duplicate" | "needs_review";

export interface LegalMatchRow {
  rowIndex: number;
  sourceAddress: string;
  sourceUnit: string;
  sourceTenantName: string;
  sourceCaseNumber: string;
  sourceStage: string;
  sourceBalance: number;
  matchType: "exact" | "likely" | "needs_review" | "no_match";
  confidence: number;
  matchedTenantId: string | null;
  matchedTenantName: string | null;
  matchedBuilding: string | null;
  matchedUnit: string | null;
  reasons: string[];
  importAction: ImportAction;
}

export interface LegalPreviewResult {
  summary: {
    total: number;
    exact: number;
    likely: number;
    needsReview: number;
    noMatch: number;
    duplicates: number;
  };
  matches: LegalMatchRow[];
}

export interface LegalImportResult {
  imported: number;
  skipped: number;
  duplicatesSkipped: number;
  queued: number;
  errors: string[];
  total: number;
  batchId: string;
  summary: {
    exact: number;
    likely: number;
    needsReview: number;
    noMatch: number;
  };
}

export function useLegalImportPreview() {
  return useMutation({
    mutationFn: async (file: File): Promise<LegalPreviewResult> => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import/legal?mode=preview", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Preview failed");
      }
      return res.json();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLegalImportConfirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<LegalImportResult> => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import/legal?mode=import", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
      qc.invalidateQueries({ queryKey: ["legal-review-queue"] });
      toast.success(`Imported ${data.imported} cases${data.queued > 0 ? `, ${data.queued} queued for review` : ""}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface ReviewQueueItem {
  id: string;
  importBatchId: string;
  rowIndex: number;
  rawData: any;
  matchType: string;
  matchConfidence: number;
  candidateTenantId: string | null;
  candidateTenantName: string | null;
  candidateBuildingAddress: string | null;
  candidateUnitNumber: string | null;
  sourceAddress: string | null;
  sourceUnit: string | null;
  sourceTenantName: string | null;
  sourceCaseNumber: string | null;
  status: string;
  createdAt: string;
}

export function useReviewQueue() {
  return useQuery({
    queryKey: ["legal-review-queue"],
    queryFn: async (): Promise<{ items: ReviewQueueItem[] }> => {
      const res = await fetch("/api/legal/review");
      if (!res.ok) throw new Error("Failed to fetch review queue");
      return res.json();
    },
  });
}

export function useResolveReviewItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { queueId: string; action: "approve" | "reject"; tenantId?: string }) => {
      const res = await fetch("/api/legal/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to resolve");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["legal-review-queue"] });
      qc.invalidateQueries({ queryKey: ["tenants"] });
      toast.success(vars.action === "approve" ? "Case approved and matched" : "Case rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface LegalCandidateItem {
  tenantId: string;
  name: string;
  unitNumber: string;
  buildingAddress: string;
  balance: number;
  monthsOwed: number;
  collectionScore: number;
  arrearsCategory: string;
  leaseStatus: string;
  arrearsDays: number;
  referralScore: number;
  reasons: string[];
}

export function useLegalCandidates() {
  return useQuery({
    queryKey: ["legal-candidates"],
    queryFn: async (): Promise<{ candidates: LegalCandidateItem[]; total: number }> => {
      const res = await fetch("/api/legal/candidates");
      if (!res.ok) throw new Error("Failed to fetch candidates");
      return res.json();
    },
  });
}
