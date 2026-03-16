"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/stores/app-store";
import toast from "react-hot-toast";

export function useProjects(filters?: { status?: string; category?: string; priority?: string; health?: string }) {
  const { selectedBuildingId } = useAppStore();

  return useQuery({
    queryKey: ["projects", selectedBuildingId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBuildingId) params.set("buildingId", selectedBuildingId);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.category) params.set("category", filters.category);
      if (filters?.priority) params.set("priority", filters.priority);
      if (filters?.health) params.set("health", filters.health);
      const res = await fetch(`/api/projects?${params}`);
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create project");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created");
    },
    onError: () => toast.error("Failed to create project"),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update project");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project updated");
    },
    onError: () => toast.error("Failed to update project"),
  });
}

export function useLinkWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, workOrderId }: { projectId: string; workOrderId: string }) => {
      const res = await fetch(`/api/projects/${projectId}/link-work-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workOrderId }),
      });
      if (!res.ok) throw new Error("Failed to link work order");
      return res.json();
    },
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ["projects", projectId] });
      toast.success("Work order linked");
    },
    onError: () => toast.error("Failed to link work order"),
  });
}

export function useLinkViolation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, violationId }: { projectId: string; violationId: string }) => {
      const res = await fetch(`/api/projects/${projectId}/link-violations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ violationId }),
      });
      if (!res.ok) throw new Error("Failed to link violation");
      return res.json();
    },
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ["projects", projectId] });
      toast.success("Violation linked");
    },
    onError: () => toast.error("Failed to link violation"),
  });
}
