"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ViolationView, ViolationStats } from "@/types";
import { useAppStore } from "@/stores/app-store";
import toast from "react-hot-toast";
import { useState, useCallback } from "react";

export function useViolations(filters?: { source?: string; class?: string; status?: string; isComplaint?: string; dateFrom?: string; dateTo?: string }) {
  const { selectedBuildingId } = useAppStore();

  return useQuery<ViolationView[]>({
    queryKey: ["violations", selectedBuildingId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBuildingId) params.set("buildingId", selectedBuildingId);
      if (filters?.source) params.set("source", filters.source);
      if (filters?.class) params.set("class", filters.class);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.isComplaint) params.set("isComplaint", filters.isComplaint);
      if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters?.dateTo) params.set("dateTo", filters.dateTo);
      const res = await fetch(`/api/violations?${params}`);
      if (!res.ok) throw new Error("Failed to fetch violations");
      return res.json();
    },
  });
}

export function useViolationStats() {
  const { selectedBuildingId } = useAppStore();

  return useQuery<ViolationStats>({
    queryKey: ["violations", "stats", selectedBuildingId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBuildingId) params.set("buildingId", selectedBuildingId);
      const res = await fetch(`/api/violations/stats?${params}`);
      if (!res.ok) throw new Error("Failed to fetch violation stats");
      return res.json();
    },
  });
}

export function useSyncViolations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data?: { buildingId?: string; sources?: string[] }) => {
      const res = await fetch("/api/violations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data || {}),
      });
      if (!res.ok) throw new Error("Failed to sync violations");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["violations"] });
      toast.success(`Sync complete: ${data.totalNew} new, ${data.totalUpdated} updated`);
    },
    onError: () => toast.error("Failed to sync violations"),
  });
}

interface SyncProgress {
  synced: number;
  total: number;
  totalNew: number;
  totalUpdated: number;
  done: boolean;
  error?: string;
}

export function useSyncViolationsStream() {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [isPending, setIsPending] = useState(false);

  const mutate = useCallback(async (data?: { buildingId?: string; sources?: string[] }) => {
    // Single building — use normal fetch, no streaming
    if (data?.buildingId) {
      setIsPending(true);
      setProgress(null);
      try {
        const res = await fetch("/api/violations/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to sync violations");
        const result = await res.json();
        qc.invalidateQueries({ queryKey: ["violations"] });
        toast.success(`Sync complete: ${result.totalNew} new, ${result.totalUpdated} updated`);
      } catch {
        toast.error("Failed to sync violations");
      } finally {
        setIsPending(false);
      }
      return;
    }

    // All buildings — use SSE streaming
    setIsPending(true);
    setProgress({ synced: 0, total: 0, totalNew: 0, totalUpdated: 0, done: false });

    try {
      const res = await fetch("/api/violations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data || {}),
      });

      if (!res.ok) throw new Error("Failed to sync violations");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let cumulativeNew = 0;
      let cumulativeUpdated = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === "progress") {
              cumulativeNew += msg.batchNew || 0;
              cumulativeUpdated += msg.batchUpdated || 0;
              setProgress({ synced: msg.synced, total: msg.total, totalNew: cumulativeNew, totalUpdated: cumulativeUpdated, done: false });
            } else if (msg.type === "done") {
              setProgress({ synced: msg.buildingCount, total: msg.buildingCount, totalNew: msg.totalNew, totalUpdated: msg.totalUpdated, done: true });
              qc.invalidateQueries({ queryKey: ["violations"] });
              toast.success(`Sync complete: ${msg.totalNew} new, ${msg.totalUpdated} updated`);
            } else if (msg.type === "error") {
              setProgress((p) => p ? { ...p, done: true, error: msg.message } : null);
              toast.error(`Sync error: ${msg.message}`);
            }
          } catch { /* skip malformed SSE lines */ }
        }
      }
    } catch {
      toast.error("Failed to sync violations");
    } finally {
      setIsPending(false);
    }
  }, [qc]);

  return { mutate, isPending, progress };
}
