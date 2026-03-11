"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export interface LegalCaseVendor {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
}

export interface LegalNoteView {
  id: string;
  text: string;
  stage: string;
  isSystem: boolean;
  createdAt: string;
  author: { name: string };
}

export interface LegalCaseView {
  id: string;
  tenantId: string;
  inLegal: boolean;
  stage: string;
  caseNumber: string | null;
  attorney: string | null;
  attorneyId: string | null;
  filedDate: string | null;
  courtDate: string | null;
  arrearsBalance: number | null;
  status: string;
  assignedUserId: string | null;
  marshalId: string | null;
  marshalScheduledDate: string | null;
  marshalExecutedDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  notes: LegalNoteView[];
  attorneyContact: LegalCaseVendor | null;
  marshalContact: LegalCaseVendor | null;
  assignedUser: { id: string; name: string } | null;
}

export interface LegalCaseHistoryItem {
  id: string;
  stage: string;
  caseNumber: string | null;
  attorney: string | null;
  filedDate: string | null;
  courtDate: string | null;
  arrearsBalance: number | null;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  assignedUser: { name: string } | null;
  attorneyContact: { name: string; company: string | null } | null;
}

export function useLegalCase(tenantId: string | null) {
  return useQuery<LegalCaseView | null>({
    queryKey: ["legal", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/legal`);
      if (!res.ok) throw new Error("Failed to fetch legal case");
      return res.json();
    },
    enabled: !!tenantId,
  });
}

export function useLegalCaseHistory(tenantId: string | null) {
  return useQuery<{ cases: LegalCaseHistoryItem[] }>({
    queryKey: ["legal-history", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/legal/history`);
      if (!res.ok) throw new Error("Failed to fetch legal history");
      return res.json();
    },
    enabled: !!tenantId,
  });
}

export function useUpsertLegalCase(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/tenants/${tenantId}/legal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update legal case");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal", tenantId] });
      qc.invalidateQueries({ queryKey: ["legal-history", tenantId] });
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["court-dates"] });
      toast.success("Legal case updated");
    },
    onError: () => toast.error("Failed to update legal case"),
  });
}

export function useCreateLegalNote(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { text: string; stage: string }) => {
      const res = await fetch(`/api/tenants/${tenantId}/legal/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add legal note");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal", tenantId] });
      toast.success("Legal note added");
    },
    onError: () => toast.error("Failed to add legal note"),
  });
}

export interface CourtDateItem {
  id: string;
  courtDate: string;
  stage: string;
  caseNumber: string | null;
  tenantId: string;
  tenantName: string;
  unitNumber: string;
  buildingId: string;
  buildingAddress: string;
  assignedUserName: string | null;
  attorneyName: string | null;
}

export function useCourtDates() {
  return useQuery<{ cases: CourtDateItem[] }>({
    queryKey: ["court-dates"],
    queryFn: async () => {
      const res = await fetch("/api/legal/court-dates");
      if (!res.ok) throw new Error("Failed to fetch court dates");
      return res.json();
    },
  });
}

export interface LegalVendorOption {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
}

export function useLegalVendors(type: "attorney" | "marshal") {
  return useQuery<{ vendors: LegalVendorOption[] }>({
    queryKey: ["legal-vendors", type],
    queryFn: async () => {
      const res = await fetch(`/api/legal/vendors?type=${type}`);
      if (!res.ok) throw new Error("Failed to fetch vendors");
      return res.json();
    },
  });
}

export interface LegalUserOption {
  id: string;
  name: string;
  email: string;
}

export function useLegalUsers(buildingId: string | null) {
  return useQuery<{ users: LegalUserOption[] }>({
    queryKey: ["legal-users", buildingId],
    queryFn: async () => {
      const params = buildingId ? `?buildingId=${buildingId}` : "";
      const res = await fetch(`/api/legal/users${params}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: !!buildingId,
  });
}

export interface LegalStats {
  activeCases: number;
  courtThisWeek: number;
  noAttorney: number;
  noAssignee: number;
  pendingReview: number;
}

export function useLegalStats() {
  return useQuery<LegalStats>({
    queryKey: ["legal-stats"],
    queryFn: async () => {
      const res = await fetch("/api/legal/stats");
      if (!res.ok) throw new Error("Failed to fetch legal stats");
      return res.json();
    },
  });
}
