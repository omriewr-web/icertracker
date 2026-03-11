"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/stores/app-store";
import toast from "react-hot-toast";

export interface UtilityMeterView {
  id: string;
  buildingId: string;
  buildingAddress: string;
  unitId: string | null;
  unitNumber: string | null;
  isVacant: boolean | null;
  tenantName: string | null;
  utilityType: string;
  providerName: string | null;
  meterNumber: string | null;
  serviceAddress: string | null;
  isActive: boolean;
  notes: string | null;
  accountNumber: string | null;
  assignedPartyType: string | null;
  assignedPartyName: string | null;
  accountStatus: string | null;
  accountCount: number;
  riskFlags: string[];
  riskFlag: string;
}

export interface UtilitySummary {
  totalMeters: number;
  assigned: number;
  unassigned: number;
  vacantTenantAccount: number;
  occupiedOwnerPaid: number;
  missingAccountNumber: number;
  closedWithBalance: number;
  missingMeterNumber: number;
}

export function useUtilityMeters(filters?: { utilityType?: string; risk?: string; party?: string }) {
  const { selectedBuildingId } = useAppStore();
  return useQuery<UtilityMeterView[]>({
    queryKey: ["utility-meters", selectedBuildingId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBuildingId) params.set("buildingId", selectedBuildingId);
      if (filters?.utilityType) params.set("utilityType", filters.utilityType);
      if (filters?.risk) params.set("risk", filters.risk);
      if (filters?.party) params.set("party", filters.party);
      const res = await fetch(`/api/utilities/meters?${params}`);
      if (!res.ok) throw new Error("Failed to fetch meters");
      return res.json();
    },
  });
}

export function useUtilityMeter(id: string | null) {
  return useQuery({
    queryKey: ["utility-meter", id],
    queryFn: async () => {
      const res = await fetch(`/api/utilities/meters/${id}`);
      if (!res.ok) throw new Error("Failed to fetch meter");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useUtilitySummary() {
  const { selectedBuildingId } = useAppStore();
  return useQuery<UtilitySummary>({
    queryKey: ["utility-summary", selectedBuildingId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBuildingId) params.set("buildingId", selectedBuildingId);
      const res = await fetch(`/api/utilities/summary?${params}`);
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });
}

export function useCreateMeter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      buildingId: string; unitId?: string; utilityType: string;
      providerName?: string; meterNumber?: string; serviceAddress?: string; notes?: string;
    }) => {
      const res = await fetch("/api/utilities/meters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create meter");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utility-meters"] });
      qc.invalidateQueries({ queryKey: ["utility-summary"] });
      toast.success("Meter created");
    },
    onError: () => toast.error("Failed to create meter"),
  });
}

export function useUpdateMeter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const res = await fetch(`/api/utilities/meters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update meter");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utility-meters"] });
      qc.invalidateQueries({ queryKey: ["utility-meter"] });
      qc.invalidateQueries({ queryKey: ["utility-summary"] });
      toast.success("Meter updated");
    },
    onError: () => toast.error("Failed to update meter"),
  });
}

export function useDeleteMeter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/utilities/meters/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete meter");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utility-meters"] });
      qc.invalidateQueries({ queryKey: ["utility-summary"] });
      toast.success("Meter deleted");
    },
    onError: () => toast.error("Failed to delete meter"),
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      utilityMeterId: string; accountNumber?: string; assignedPartyType: string;
      assignedPartyName?: string; tenantId?: string; startDate?: string; notes?: string;
    }) => {
      const res = await fetch("/api/utilities/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create account");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utility-meters"] });
      qc.invalidateQueries({ queryKey: ["utility-meter"] });
      qc.invalidateQueries({ queryKey: ["utility-summary"] });
      toast.success("Account created");
    },
    onError: () => toast.error("Failed to create account"),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const res = await fetch(`/api/utilities/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update account");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utility-meters"] });
      qc.invalidateQueries({ queryKey: ["utility-meter"] });
      qc.invalidateQueries({ queryKey: ["utility-summary"] });
      toast.success("Account updated");
    },
    onError: () => toast.error("Failed to update account"),
  });
}
