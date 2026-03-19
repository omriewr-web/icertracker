"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TenantView } from "@/types";
import { useAppStore } from "@/stores/app-store";
import toast from "react-hot-toast";

export function useTenants() {
  const { selectedBuildingId, searchTerm, arrearsFilter, leaseFilter, sortField, sortDir } = useAppStore();

  return useQuery<TenantView[]>({
    queryKey: ["tenants", selectedBuildingId, searchTerm, arrearsFilter, leaseFilter, sortField, sortDir],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBuildingId) params.set("buildingId", selectedBuildingId);
      if (searchTerm) params.set("search", searchTerm);
      if (arrearsFilter !== "all") params.set("arrears", arrearsFilter);
      if (leaseFilter !== "all") params.set("lease", leaseFilter);
      params.set("sort", sortField);
      params.set("dir", sortDir);

      const res = await fetch(`/api/tenants?${params}`);
      if (!res.ok) throw new Error("Failed to fetch tenants");
      const json = await res.json();
      return json.tenants ?? json;
    },
  });
}

export function useTenant(id: string | null) {
  return useQuery({
    queryKey: ["tenants", id],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${id}`);
      if (!res.ok) throw new Error("Failed to fetch tenant");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update tenant");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
      toast.success("Tenant updated");
    },
    onError: () => toast.error("Failed to update tenant"),
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create tenant");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["buildings"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
      toast.success("Tenant created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tenants/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete tenant");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["buildings"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
      toast.success("Tenant deleted");
    },
    onError: () => toast.error("Failed to delete tenant"),
  });
}
