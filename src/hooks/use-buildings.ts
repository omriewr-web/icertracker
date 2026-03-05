"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BuildingView } from "@/types";
import toast from "react-hot-toast";

export function useBuildings() {
  return useQuery<BuildingView[]>({
    queryKey: ["buildings"],
    queryFn: async () => {
      const res = await fetch("/api/buildings");
      if (!res.ok) throw new Error("Failed to fetch buildings");
      return res.json();
    },
  });
}

export function useBuilding(id: string | null) {
  return useQuery({
    queryKey: ["buildings", id],
    queryFn: async () => {
      const res = await fetch(`/api/buildings/${id}`);
      if (!res.ok) throw new Error("Failed to fetch building");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create building");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buildings"] });
      toast.success("Building created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/buildings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update building");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buildings"] });
      toast.success("Building updated");
    },
    onError: () => toast.error("Failed to update building"),
  });
}

export function useDeleteBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/buildings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete building");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buildings"] });
      qc.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Building deleted");
    },
    onError: () => toast.error("Failed to delete building"),
  });
}
