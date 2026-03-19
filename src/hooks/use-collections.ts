"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/stores/app-store";
import toast from "react-hot-toast";

// ── Dashboard KPIs ──

interface CollectionsDashboard {
  totalBalance: number;
  tenantCount: number;
  legalCount: number;
  staleCount: number;
  followUpsDue: number;
}

export function useCollectionsDashboard() {
  const { selectedBuildingId } = useAppStore();

  return useQuery<CollectionsDashboard>({
    queryKey: ["collections", "dashboard", selectedBuildingId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBuildingId) params.set("buildingId", selectedBuildingId);
      const res = await fetch(`/api/collections/dashboard?${params}`);
      if (!res.ok) throw new Error("Failed to fetch collections dashboard");
      return res.json();
    },
  });
}

// ── Tenant AR list (paginated) ──

export interface ARTenantRow {
  id: string;
  name: string;
  balance: number;
  arrearsCategory: string;
  arrearsDays: number;
  leaseStatus: string;
  inLegal: boolean;
  buildingAddress: string;
  buildingId: string;
  unitNumber: string;
  lastNoteDate: string | null;
  lastNoteText: string | null;
  collectionStatus: string | null;
  collectionNoteDate: string | null;
  collectionNoteText: string | null;
}

interface ARTenantsResponse {
  data: ARTenantRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CollectionFilters {
  buildingId?: string;
  status?: string;
  minBalance?: number;
  page?: number;
  pageSize?: number;
}

export function useCollectionTenants(filters?: CollectionFilters) {
  const { selectedBuildingId } = useAppStore();

  return useQuery<ARTenantsResponse>({
    queryKey: ["collections", "tenants", selectedBuildingId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      const bid = filters?.buildingId || selectedBuildingId;
      if (bid) params.set("buildingId", bid);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.minBalance != null) params.set("minBalance", String(filters.minBalance));
      if (filters?.page) params.set("page", String(filters.page));
      if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
      const res = await fetch(`/api/collections/tenants?${params}`);
      if (!res.ok) throw new Error("Failed to fetch collection tenants");
      return res.json();
    },
  });
}

// ── Tenant collection profile ──

export function useCollectionProfile(tenantId: string | null) {
  return useQuery({
    queryKey: ["collections", "profile", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/collections/tenants/${tenantId}`);
      if (!res.ok) throw new Error("Failed to fetch collection profile");
      return res.json();
    },
    enabled: !!tenantId,
  });
}

// ── Create collection note ──

export function useCreateCollectionNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, data }: { tenantId: string; data: { content: string; actionType: string; followUpDate?: string } }) => {
      const res = await fetch(`/api/collections/tenants/${tenantId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create note");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Collection note added");
    },
    onError: () => toast.error("Failed to add collection note"),
  });
}

// ── Bulk collection action ──

export function useBulkCollectionAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { tenantIds: string[]; action: string; value?: string; note?: string }) => {
      const res = await fetch("/api/collections/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to perform bulk action");
      }
      return res.json();
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success(`Updated ${result.updated} tenant${result.updated !== 1 ? "s" : ""}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Send to legal ──

export function useSendToLegal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await fetch("/api/collections/send-to-legal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send to legal");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["legal"] });
      qc.invalidateQueries({ queryKey: ["legal-stats"] });
      toast.success("Tenant referred to legal");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Bulk follow-up ──

export function useBulkFollowup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      tenantIds: string[];
      noteText: string;
      noteType: string;
    }) => {
      const res = await fetch("/api/collections/bulk-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send bulk follow-up");
      }
      return res.json();
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success(
        `Follow-up notes created for ${result.success} tenant${result.success !== 1 ? "s" : ""}`
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Stage alerts (protocol-based overdue) ──

export interface StageAlert {
  stageId: string;
  tenantId: string;
  tenantName: string;
  unitNumber: string;
  buildingAddress: string;
  balance: number;
  stage: number;
  daysPastDue: number;
  actionOverdue: boolean;
  promiseBroken: boolean;
  lastActionAt: string | null;
  actionDueBy: string | null;
  nextRecommendedAction: string | null;
}

export function useStageAlerts() {
  return useQuery<StageAlert[]>({
    queryKey: ["collections", "stage-alerts"],
    queryFn: async () => {
      const res = await fetch("/api/collections/stage-alerts");
      if (!res.ok) return [];
      return res.json();
    },
  });
}

// ── Tenant stage + actions ──

export interface StageData {
  stage: {
    id: string;
    tenantId: string;
    stage: number;
    stageEnteredAt: string;
    daysPastDue: number;
    actionDueBy: string | null;
    actionOverdue: boolean;
    lastActionAt: string | null;
    lastActionType: string | null;
    nextRecommendedAction: string | null;
    status: string;
  };
  actions: Array<{
    id: string;
    actionType: string;
    actionDate: string;
    outcome: string;
    notes: string | null;
    promisedPaymentDate: string | null;
    promisedPaymentAmount: number | null;
    promiseBroken: boolean;
    staff: { id: string; name: string };
    createdAt: string;
  }>;
  recommendation: {
    recommendedAction: string;
    reason: string;
    urgency: "low" | "medium" | "high" | "critical";
  };
}

export function useTenantStage(tenantId: string | null) {
  return useQuery<StageData>({
    queryKey: ["collections", "stage", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/collections/tenants/${tenantId}/stage`);
      if (!res.ok) throw new Error("Failed to fetch stage data");
      return res.json();
    },
    enabled: !!tenantId,
  });
}

// ── Log collection action (stage system) ──

export function useLogCollectionAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tenantId,
      data,
    }: {
      tenantId: string;
      data: {
        actionType: string;
        actionDate: string;
        outcome: string;
        notes?: string;
        promisedPaymentDate?: string;
        promisedPaymentAmount?: number;
      };
    }) => {
      const res = await fetch(`/api/collections/tenants/${tenantId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to log action");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Action logged");
    },
    onError: () => toast.error("Failed to log action"),
  });
}

// ── Advance stage ──

export function useAdvanceStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tenantId,
      newStage,
    }: {
      tenantId: string;
      newStage: number;
    }) => {
      const res = await fetch(
        `/api/collections/tenants/${tenantId}/advance-stage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newStage }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to advance stage");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Stage advanced");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Update collection status ──

export function useUpdateCollectionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, status }: { tenantId: string; status: string }) => {
      const res = await fetch(`/api/collections/tenants/${tenantId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });
}
