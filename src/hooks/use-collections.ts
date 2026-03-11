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
