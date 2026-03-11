"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export interface Signal {
  id: string;
  deduplicationKey: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  buildingId: string | null;
  tenantId: string | null;
  status: string;
  lastTriggeredAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  assignedToUserId: string | null;
  dueAt: string | null;
  snoozedUntil: string | null;
  recommendedAction: string | null;
  resolutionNote: string | null;
  acknowledgedById: string | null;
  resolvedById: string | null;
}

interface SignalsResponse {
  signals: Signal[];
  counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  lastScan: {
    scanType: string;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    success: boolean;
    errorMessage: string | null;
    createdSignals: number;
    updatedSignals: number;
    resolvedSignals: number;
  } | null;
}

interface ScanResult {
  created: number;
  updated: number;
  resolved: number;
  total: number;
  durationMs: number;
}

export function useSignals(filters?: { severity?: string; type?: string; buildingId?: string; status?: string }) {
  return useQuery<SignalsResponse>({
    queryKey: ["signals", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.severity) params.set("severity", filters.severity);
      if (filters?.type) params.set("type", filters.type);
      if (filters?.buildingId) params.set("buildingId", filters.buildingId);
      if (filters?.status) params.set("status", filters.status || "active");
      const res = await fetch(`/api/signals?${params}`);
      if (!res.ok) throw new Error("Failed to fetch signals");
      return res.json();
    },
  });
}

export function useRunScan() {
  const qc = useQueryClient();
  return useMutation<ScanResult>({
    mutationFn: async () => {
      const res = await fetch("/api/signals", { method: "POST" });
      if (!res.ok) throw new Error("Scan failed");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["signals"] });
      toast.success(`Scan complete: ${data.created} new, ${data.resolved} resolved (${data.durationMs}ms)`);
    },
    onError: () => toast.error("Signal scan failed"),
  });
}

export function useAcknowledgeSignal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/signals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge" }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signals"] });
    },
  });
}

export function useResolveSignal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resolutionNote }: { id: string; resolutionNote?: string }) => {
      const res = await fetch(`/api/signals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", resolutionNote }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signals"] });
      toast.success("Signal resolved");
    },
  });
}

export function useUpdateSignal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; assignedToUserId?: string | null; dueAt?: string | null; snoozedUntil?: string | null }) => {
      const { id, ...fields } = data;
      const res = await fetch(`/api/signals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signals"] });
      toast.success("Insight updated");
    },
  });
}
