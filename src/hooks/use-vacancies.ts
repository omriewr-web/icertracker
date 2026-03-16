"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/stores/app-store";
import toast from "react-hot-toast";

export interface VacancyUnitView {
  id: string;
  unitNumber: string;
  buildingId: string;
  buildingAddress: string;
  bedroomCount: number | null;
  bathroomCount: number | null;
  squareFeet: number | null;
  legalRent: number | null;
  askingRent: number | null;
  proposedRent: number | null;
  approvedRent: number | null;
  rentProposedBy: string | null;
  rentApprovedBy: string | null;
  rentProposedAt: string | null;
  rentApprovedAt: string | null;
  vacancyStatus: string;
  vacantSince: string | null;
  readyDate: string | null;
  statusChangedAt: string | null;
  accessType: string | null;
  accessNotes: string | null;
  superName: string | null;
  superPhone: string | null;
  isVacant: boolean;
  daysVacant: number | null;
  daysSinceReady: number | null;
  bestRent: number;
  turnover: {
    id: string;
    status: string;
    assignedToId: string | null;
    assignedToName: string | null;
    estimatedCost: number | null;
    inspectionDate: string | null;
    scopeOfWork: string | null;
    moveOutDate: string | null;
    vendorCount: number;
  } | null;
}

export function useVacancies(filters?: { status?: string; daysVacant?: string }) {
  const { selectedBuildingId } = useAppStore();

  return useQuery<VacancyUnitView[]>({
    queryKey: ["vacancies", selectedBuildingId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBuildingId) params.set("buildingId", selectedBuildingId);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.daysVacant) params.set("daysVacant", filters.daysVacant);
      const res = await fetch(`/api/vacancies?${params}`);
      if (!res.ok) throw new Error("Failed to fetch vacancies");
      return res.json();
    },
  });
}

export function useUpdateVacancyStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ unitId, status }: { unitId: string; status: string }) => {
      const res = await fetch(`/api/vacancies/${unitId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vacancies"] });
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
      qc.invalidateQueries({ queryKey: ["turnovers"] });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateVacancyUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ unitId, data }: { unitId: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/units/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update unit");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vacancies"] });
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useVacancyRent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ unitId, action, rent }: { unitId: string; action: "propose" | "approve"; rent: number }) => {
      const res = await fetch(`/api/vacancies/${unitId}/rent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rent }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update rent");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["vacancies"] });
      qc.invalidateQueries({ queryKey: ["units"] });
      toast.success(vars.action === "propose" ? "Rent proposed" : "Rent approved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
