"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export interface UnitView {
  id: string;
  unitNumber: string;
  unitType: string | null;
  askingRent: number | null;
  legalRent: number | null;
  lastLeaseRent: number | null;
  isVacant: boolean;
  vacantSince: string | null;
  vacancyStatus: string | null;
  buildingId: string;
  buildingAddress: string;
  tenantId: string | null;
  tenantName: string | null;
  marketRent: number | null;
  balance: number | null;
}

export function useUnits(buildingId?: string | null) {
  return useQuery<UnitView[]>({
    queryKey: ["units", buildingId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (buildingId) params.set("buildingId", buildingId);
      const res = await fetch(`/api/units?${params}`);
      if (!res.ok) throw new Error("Failed to fetch units");
      return res.json();
    },
  });
}

export function useCreateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { buildingId: string; unitNumber: string; unitType?: string }) => {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create unit");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["buildings"] });
      toast.success("Unit created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/units/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update unit");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["buildings"] });
      toast.success("Unit updated");
    },
    onError: () => toast.error("Failed to update unit"),
  });
}

export function useDeleteUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/units/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete unit");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["buildings"] });
      toast.success("Unit deleted");
    },
    onError: () => toast.error("Failed to delete unit"),
  });
}
