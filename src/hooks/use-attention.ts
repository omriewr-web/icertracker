"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ── Types ─────────────────────────────────────────────────────

export interface AttentionScore {
  entityType: string;
  entityId: string;
  score: number;
  label: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "OK";
  breakdown: {
    arrears: number;
    signals: number;
    legal: number;
    vacancy: number;
    workOrders: number;
    utilities: number;
    leaseRisk: number;
    staleness: number;
  };
  topReason: string;
}

export interface ActionCard {
  id: string;
  module: string;
  entityType: string;
  entityId: string;
  title: string;
  reason: string;
  urgency: "low" | "medium" | "high" | "critical";
  suggestedAction: string;
  quickActions: Array<{
    label: string;
    actionCode: string;
    variant: "primary" | "secondary" | "danger";
  }>;
  source: string;
}

// ── Attention Score ───────────────────────────────────────────

export function useTenantAttention(tenantId: string | null) {
  return useQuery<AttentionScore>({
    queryKey: ["attention", "tenant", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/attention/tenant/${tenantId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!tenantId,
  });
}

export function useBuildingAttention(buildingId: string | null) {
  return useQuery<AttentionScore>({
    queryKey: ["attention", "building", buildingId],
    queryFn: async () => {
      const res = await fetch(`/api/attention/building/${buildingId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!buildingId,
  });
}

export function useAttentionRankings(buildingId?: string, limit = 20) {
  const params = new URLSearchParams();
  if (buildingId) params.set("buildingId", buildingId);
  params.set("limit", String(limit));

  return useQuery<AttentionScore[]>({
    queryKey: ["attention", "rankings", buildingId, limit],
    queryFn: async () => {
      const res = await fetch(`/api/attention/rankings?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      return data.rankings;
    },
  });
}

// ── Action Cards ──────────────────────────────────────────────

export function useActionCards(entityType: string | null, entityId: string | null) {
  return useQuery<ActionCard[]>({
    queryKey: ["attention", "action-cards", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/attention/action-cards/${entityType}/${entityId}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      return data.cards;
    },
    enabled: !!entityType && !!entityId,
  });
}

// ── Decision Log ──────────────────────────────────────────────

export function useLogDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      action: "log_shown" | "record_outcome";
      module?: string;
      entityType?: string;
      entityId?: string;
      recommendationCode?: string;
      recommendationText?: string;
      severity?: string;
      logId?: string;
      outcome?: string;
      userAction?: string;
    }) => {
      const res = await fetch("/api/attention/decision-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
}

// ── Thread Summary ────────────────────────────────────────────

export function useSummarizeThread() {
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await fetch(
        `/api/comms/conversations/${conversationId}/summarize`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to summarize");
      const data = await res.json();
      return data.summary as string;
    },
  });
}
