"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export interface MaintenanceScheduleView {
  id: string;
  title: string;
  description: string | null;
  frequency: string;
  nextDueDate: string;
  autoCreateWorkOrder: boolean;
  buildingId: string;
  unitId: string | null;
  building: { address: string };
  unit: { unitNumber: string } | null;
  createdAt: string;
}

export function useMaintenanceSchedules() {
  return useQuery<MaintenanceScheduleView[]>({
    queryKey: ["maintenance-schedules"],
    queryFn: async () => {
      const res = await fetch("/api/maintenance-schedules");
      if (!res.ok) throw new Error("Failed to fetch schedules");
      return res.json();
    },
  });
}

export function useCreateMaintenanceSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/maintenance-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create schedule");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance-schedules"] });
      toast.success("Schedule created");
    },
    onError: () => toast.error("Failed to create schedule"),
  });
}

export function useUpdateMaintenanceSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/maintenance-schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update schedule");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance-schedules"] });
      toast.success("Schedule updated");
    },
    onError: () => toast.error("Failed to update schedule"),
  });
}

export function useDeleteMaintenanceSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/maintenance-schedules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete schedule");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance-schedules"] });
      toast.success("Schedule deleted");
    },
    onError: () => toast.error("Failed to delete schedule"),
  });
}
