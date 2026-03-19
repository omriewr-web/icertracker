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
  currentMonthCheckStatus: "paid" | "unpaid" | "not_recorded";
  lastCheckDate: string | null;
  transferNeeded: boolean;
  transferReason: "moved_out" | "lease_expired" | null;
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
  totalAccounts: number;
  activeAccounts: number;
  paidThisMonth: number;
  unpaidThisMonth: number;
  noCheckThisMonth: number;
  withRiskSignals: number;
  transferNeeded: number;
  movedOutActive: number;
  leaseExpiredActive: number;
  vacantOwnerResponsibility: number;
  buildingRollup: BuildingRollup[];
}

export interface BuildingRollup {
  id: string;
  address: string;
  totalAccounts: number;
  unpaidThisMonth: number;
  noCheckThisMonth: number;
  riskCount: number;
  transferNeeded: number;
}

export interface MonthlyCheck {
  id: string;
  utilityAccountId: string;
  month: number;
  year: number;
  paymentStatus: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  proofFileUrl: string | null;
  notes: string | null;
  createdAt: string;
}

export function useUtilityMeters(filters?: { utilityType?: string; risk?: string; party?: string; checkStatus?: string }) {
  const { selectedBuildingId } = useAppStore();
  return useQuery<UtilityMeterView[]>({
    queryKey: ["utility-meters", selectedBuildingId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBuildingId) params.set("buildingId", selectedBuildingId);
      if (filters?.utilityType) params.set("utilityType", filters.utilityType);
      if (filters?.risk) params.set("risk", filters.risk);
      if (filters?.party) params.set("party", filters.party);
      if (filters?.checkStatus) params.set("checkStatus", filters.checkStatus);
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
      classification?: string; providerName?: string; meterNumber?: string; serviceAddress?: string; notes?: string;
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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create account");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utility-meters"] });
      qc.invalidateQueries({ queryKey: ["utility-meter"] });
      qc.invalidateQueries({ queryKey: ["utility-summary"] });
      toast.success("Account created");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create account"),
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

// ── Monthly Check Hooks ─────────────────────────────────────────

export function useMonthlyChecks(accountId: string | null) {
  return useQuery<MonthlyCheck[]>({
    queryKey: ["utility-checks", accountId],
    queryFn: async () => {
      const res = await fetch(`/api/utilities/accounts/${accountId}/checks`);
      if (!res.ok) throw new Error("Failed to fetch checks");
      return res.json();
    },
    enabled: !!accountId,
  });
}

export function useCreateOrUpdateCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      accountId: string; month: number; year: number;
      isPaid: boolean; paidDate?: string; amount?: number; notes?: string;
    }) => {
      const { accountId, ...rest } = data;
      const res = await fetch(`/api/utilities/accounts/${accountId}/checks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rest),
      });
      if (!res.ok) throw new Error("Failed to save check");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utility-checks"] });
      qc.invalidateQueries({ queryKey: ["utility-meters"] });
      qc.invalidateQueries({ queryKey: ["utility-meter"] });
      qc.invalidateQueries({ queryKey: ["utility-summary"] });
      toast.success("Check saved");
    },
    onError: () => toast.error("Failed to save check"),
  });
}

export function useUpdateCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ accountId, checkId, ...data }: { accountId: string; checkId: string; isPaid?: boolean; paidDate?: string; notes?: string }) => {
      const res = await fetch(`/api/utilities/accounts/${accountId}/checks/${checkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update check");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utility-checks"] });
      qc.invalidateQueries({ queryKey: ["utility-meters"] });
      qc.invalidateQueries({ queryKey: ["utility-meter"] });
      qc.invalidateQueries({ queryKey: ["utility-summary"] });
      toast.success("Check updated");
    },
    onError: () => toast.error("Failed to update check"),
  });
}
