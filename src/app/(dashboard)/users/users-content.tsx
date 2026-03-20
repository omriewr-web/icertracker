// NOTE: This page handles basic user CRUD (roles, managers, building assignments).
// For granular permission management (presets, module grants, dangerous privileges),
// see the canonical page at /settings/users (src/app/(dashboard)/settings/users/page.tsx).
// These two pages may be consolidated in the future — see QA audit item L14.

"use client";

import { useState, useMemo } from "react";
import { Users, Plus } from "lucide-react";
import { useUsers, useDeleteUser } from "@/hooks/use-users";
import { useAllBuildings } from "@/hooks/use-buildings";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/skeleton";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import UserFormModal from "@/components/users/user-form-modal";
import { formatDate } from "@/lib/utils";

const roleBadgeColor: Record<string, string> = {
  SUPER_ADMIN: "red",
  ADMIN: "red",
  ACCOUNT_ADMIN: "red",
  PM: "blue",
  APM: "blue",
  COLLECTOR: "green",
  OWNER: "amber",
  LEASING_SPECIALIST: "purple",
  BROKER: "purple",
  SUPER: "gray",
  ACCOUNTING: "green",
  LEASING_AGENT: "purple",
};

export default function UsersContent() {
  const { data: users, isLoading } = useUsers();
  const { data: buildings } = useAllBuildings();
  const deleteUser = useDeleteUser();
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // PM users to serve as managers for APM/Leasing/Accounting roles
  const managers = useMemo(() => {
    if (!users) return [];
    return users
      .filter((u: any) => ["PM", "ADMIN", "ACCOUNT_ADMIN"].includes(u.role) && u.active)
      .map((u: any) => ({ id: u.id, name: u.name }));
  }, [users]);

  // Buildings list for assignment
  const buildingList = useMemo(() => {
    if (!buildings) return [];
    return buildings.map((b: any) => ({ id: b.id, address: b.address }));
  }, [buildings]);

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">User Management</h1>
        <Button onClick={() => { setMode("create"); setEditingUser(null); }}>
          <Plus className="w-4 h-4" /> Add User
        </Button>
      </div>

      <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Email</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Username</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Role</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Manager</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Status</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Created</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(!users || users.length === 0) && (
              <tr><td colSpan={8} className="text-center py-12 text-text-dim text-sm">No users found. Click &quot;Add User&quot; to create the first team member.</td></tr>
            )}
            {(users || []).map((u: any) => (
              <tr key={u.id} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                <td className="px-3 py-2 text-text-primary">{u.name}</td>
                <td className="px-3 py-2 text-text-muted text-xs">{u.email}</td>
                <td className="px-3 py-2 text-text-muted font-mono text-xs">{u.username}</td>
                <td className="px-3 py-2">
                  <Badge variant={roleBadgeColor[u.role] as any}>{u.role}</Badge>
                </td>
                <td className="px-3 py-2 text-text-dim text-xs">{u.manager?.name || "—"}</td>
                <td className="px-3 py-2">
                  <Badge variant={u.active ? "green" : "gray"}>{u.active ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="px-3 py-2 text-text-dim text-xs">{formatDate(u.createdAt)}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => { setEditingUser(u); setMode("edit"); }}
                    className="text-xs text-accent hover:text-accent-light mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteId(u.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mode && (
        <UserFormModal
          user={mode === "edit" ? editingUser : null}
          mode={mode}
          onClose={() => { setMode(null); setEditingUser(null); }}
          managers={managers}
          buildings={buildingList}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteUser.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
        }}
        title="Deactivate User"
        message="This user will be deactivated and can no longer sign in."
        confirmLabel="Deactivate"
        loading={deleteUser.isPending}
      />
    </div>
  );
}
