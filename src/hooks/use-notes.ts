"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export function useNotes(tenantId: string | null) {
  return useQuery({
    queryKey: ["notes", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/notes`);
      if (!res.ok) throw new Error("Failed to fetch notes");
      return res.json();
    },
    enabled: !!tenantId,
  });
}

export function useCreateNote(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { text: string; category: string }) => {
      const res = await fetch(`/api/tenants/${tenantId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create note");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes", tenantId] });
      qc.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Note added");
    },
    onError: () => toast.error("Failed to add note"),
  });
}

export function useUpdateNote(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, data }: { noteId: string; data: { text: string; category?: string } }) => {
      const res = await fetch(`/api/tenants/${tenantId}/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update note");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes", tenantId] });
      toast.success("Note updated");
    },
    onError: () => toast.error("Failed to update note"),
  });
}

export function useDeleteNote(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (noteId: string) => {
      const res = await fetch(`/api/tenants/${tenantId}/notes/${noteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete note");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes", tenantId] });
      qc.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}
