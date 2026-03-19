"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, UserPlus, Shield, Trash2, Settings, Download, PenLine,
  X, ArrowRight, ArrowLeft, Check, Loader2, AlertTriangle,
  Copy, Eye, ChevronDown, ChevronUp, RotateCcw,
} from "lucide-react";
import Button from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import type { PermissionPreset, Module, PermissionLevel, ModulePermissions } from "@/lib/permissions/types";
import {
  MODULES, LEVELS, LEVEL_RANK, MODULE_LABELS, PRESET_LABELS,
} from "@/lib/permissions/types";
import { PERMISSION_PRESETS, PRESET_DANGEROUS_DEFAULTS } from "@/lib/permissions/presets";

// ── Types ────────────────────────────────────────────────────

interface UserRow {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  active: boolean;
  permissionPreset: string;
  canExportSensitive: boolean;
  canDeleteRecords: boolean;
  canBulkUpdate: boolean;
  canManageUsers: boolean;
  canManageOrgSettings: boolean;
  moduleCount: number;
  accessGrants: Array<{ module: string; level: string; scopeType: string; scopeId: string | null }>;
  createdAt: string;
}

interface AuditEntry {
  id: string;
  changedBy: string;
  changedByName: string;
  changeType: string;
  oldValue: any;
  newValue: any;
  createdAt: string;
}

// ── Preset config ────────────────────────────────────────────

const PRESET_DESCRIPTIONS: Record<PermissionPreset, string> = {
  property_manager: "Day-to-day operations, collections, and compliance across assigned buildings",
  ar_clerk: "Full autonomy on collections, AR reporting, and legal tracking",
  leasing_agent: "Manages vacancies, units, and lease activity",
  building_super: "Handles work orders and maintenance for assigned buildings",
  reporting_only: "Can view and export everything, cannot make changes",
  owner_investor: "Portfolio-level visibility for asset managers and owners",
  account_admin: "Full access to all modules and settings",
};

const PRESET_COLORS: Record<PermissionPreset, string> = {
  property_manager: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ar_clerk: "bg-green-500/10 text-green-400 border-green-500/20",
  leasing_agent: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  building_super: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  reporting_only: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  owner_investor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  account_admin: "bg-red-500/10 text-red-400 border-red-500/20",
};

const LEVEL_COLORS: Record<PermissionLevel, string> = {
  none: "bg-white/5 text-text-dim",
  view: "bg-yellow-500/10 text-yellow-400",
  edit: "bg-blue-500/10 text-blue-400",
  full: "bg-green-500/10 text-green-400",
};

const ALL_PRESETS = Object.keys(PRESET_LABELS) as PermissionPreset[];

// ── Hooks ────────────────────────────────────────────────────

function useUsers() {
  return useQuery<UserRow[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });
}

function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to invite user");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

function useUpdatePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: any }) => {
      const res = await fetch(`/api/users/${userId}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update permissions");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Permissions updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function useAuditHistory(userId: string | null) {
  return useQuery<AuditEntry[]>({
    queryKey: ["permission-audit", userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/permissions`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!userId,
  });
}

// ── Preset Badge ─────────────────────────────────────────────

function PresetBadge({ preset }: { preset: string }) {
  const label = PRESET_LABELS[preset as PermissionPreset] ?? preset;
  const color = PRESET_COLORS[preset as PermissionPreset] ?? "bg-gray-500/10 text-gray-400 border-gray-500/20";
  return <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold border", color)}>{label}</span>;
}

// ── Module Pills ─────────────────────────────────────────────

function ModulePills({ grants }: { grants: Array<{ module: string; level: string }> }) {
  const active = grants.filter((g) => g.level !== "none");
  if (active.length === 0) return <span className="text-text-dim text-xs">No modules</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {active.slice(0, 4).map((g) => (
        <span key={g.module} className={cn("text-[9px] px-1.5 py-0.5 rounded", LEVEL_COLORS[g.level as PermissionLevel])}>
          {MODULE_LABELS[g.module as Module] ?? g.module}
        </span>
      ))}
      {active.length > 4 && <span className="text-[9px] text-text-dim">+{active.length - 4}</span>}
    </div>
  );
}

// ── Dangerous Icons ──────────────────────────────────────────

function DangerIcons({ user }: { user: UserRow }) {
  const items = [
    { key: "export", active: user.canExportSensitive, icon: Download, label: "Export sensitive" },
    { key: "delete", active: user.canDeleteRecords, icon: Trash2, label: "Delete records" },
    { key: "bulk", active: user.canBulkUpdate, icon: Settings, label: "Bulk update" },
    { key: "users", active: user.canManageUsers, icon: Users, label: "Manage users" },
  ];
  const active = items.filter((i) => i.active);
  if (active.length === 0) return <span className="text-text-dim">-</span>;
  return (
    <div className="flex gap-1">
      {active.map(({ key, icon: Icon, label }) => (
        <span key={key} title={label} className="text-amber-400"><Icon className="w-3 h-3" /></span>
      ))}
    </div>
  );
}

// ── Invite/Edit Drawer ───────────────────────────────────────

interface DrawerProps {
  mode: "invite" | "edit";
  editUser?: UserRow | null;
  onClose: () => void;
}

function PermissionDrawer({ mode, editUser, onClose }: DrawerProps) {
  const [step, setStep] = useState(mode === "edit" ? 2 : 0);
  const inviteMutation = useInviteUser();
  const updateMutation = useUpdatePermissions();

  // Step 0: Basic info
  const [name, setName] = useState(editUser?.name ?? "");
  const [email, setEmail] = useState(editUser?.email ?? "");
  const [jobTitle, setJobTitle] = useState("");

  // Step 1: Preset
  const [selectedPreset, setSelectedPreset] = useState<PermissionPreset>(
    (editUser?.permissionPreset as PermissionPreset) ?? "property_manager"
  );

  // Step 2: Overrides
  const presetPerms = PERMISSION_PRESETS[selectedPreset];
  const presetDangers = PRESET_DANGEROUS_DEFAULTS[selectedPreset];
  const [overrides, setOverrides] = useState<Partial<ModulePermissions>>({});
  const [dangers, setDangers] = useState({
    canExportSensitive: editUser?.canExportSensitive ?? presetDangers.canExportSensitive,
    canDeleteRecords: editUser?.canDeleteRecords ?? presetDangers.canDeleteRecords,
    canBulkUpdate: editUser?.canBulkUpdate ?? presetDangers.canBulkUpdate,
    canManageUsers: editUser?.canManageUsers ?? presetDangers.canManageUsers,
    canManageOrgSettings: editUser?.canManageOrgSettings ?? presetDangers.canManageOrgSettings,
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Step 3: Confirm
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Audit history (edit mode)
  const { data: auditLogs } = useAuditHistory(mode === "edit" ? editUser?.id ?? null : null);

  const effectivePerms = useMemo(() => {
    const merged = { ...presetPerms, ...overrides };
    return merged;
  }, [presetPerms, overrides]);

  const hasOverrides = Object.keys(overrides).length > 0 ||
    dangers.canExportSensitive !== presetDangers.canExportSensitive ||
    dangers.canDeleteRecords !== presetDangers.canDeleteRecords ||
    dangers.canBulkUpdate !== presetDangers.canBulkUpdate ||
    dangers.canManageUsers !== presetDangers.canManageUsers ||
    dangers.canManageOrgSettings !== presetDangers.canManageOrgSettings;

  function resetOverrides() {
    setOverrides({});
    setDangers({ ...presetDangers });
  }

  async function handleConfirm() {
    if (mode === "invite") {
      const result = await inviteMutation.mutateAsync({
        name, email,
        permissionPreset: selectedPreset,
        moduleOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
        dangerousPrivileges: dangers,
      });
      setTempPassword(result.tempPassword);
      setStep(4); // show password step
    } else {
      await updateMutation.mutateAsync({
        userId: editUser!.id,
        data: {
          permissionPreset: selectedPreset,
          moduleOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
          dangerousPrivileges: dangers,
        },
      });
      onClose();
    }
  }

  const isPending = inviteMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />
      {/* Drawer */}
      <div className="w-full max-w-[560px] bg-bg border-l border-border overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-bg border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              {mode === "invite" ? "Invite User" : `Edit Permissions — ${editUser?.name}`}
            </h2>
            <p className="text-xs text-text-dim mt-0.5">
              Step {Math.min(step + 1, 4)} of 4
            </p>
          </div>
          <button onClick={onClose} className="text-text-dim hover:text-text-muted"><X className="w-5 h-5" /></button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((s) => (
              <div key={s} className={cn("h-1 flex-1 rounded-full", s <= step ? "bg-accent" : "bg-white/5")} />
            ))}
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* STEP 0: Basic Info */}
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-text-muted">Basic Info</h3>
              <div>
                <label className="block text-xs text-text-dim mb-1">Full Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-atlas-navy-3 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-xs text-text-dim mb-1">Email Address *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-atlas-navy-3 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-xs text-text-dim mb-1">Job Title (optional)</label>
                <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Senior Property Manager" className="w-full bg-atlas-navy-3 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
              </div>
              <p className="text-xs text-text-dim">A temporary password will be auto-generated after invite.</p>
              <Button onClick={() => setStep(1)} disabled={!name.trim() || !email.trim()} className="w-full">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* STEP 1: Choose Preset */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-text-muted">Choose Permission Preset</h3>
              <div className="grid grid-cols-1 gap-3">
                {ALL_PRESETS.map((p) => {
                  const perms = PERMISSION_PRESETS[p];
                  const active = MODULES.filter((m) => perms[m] !== "none");
                  return (
                    <button
                      key={p}
                      onClick={() => { setSelectedPreset(p); setOverrides({}); setDangers({ ...PRESET_DANGEROUS_DEFAULTS[p] }); }}
                      className={cn(
                        "text-left p-4 rounded-xl border transition-all",
                        selectedPreset === p ? "border-accent bg-accent/5" : "border-border hover:border-accent/30"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-text-primary">{PRESET_LABELS[p]}</span>
                        {selectedPreset === p && <Check className="w-4 h-4 text-accent" />}
                      </div>
                      <p className="text-xs text-text-dim mt-1">{PRESET_DESCRIPTIONS[p]}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {active.map((m) => (
                          <span key={m} className={cn("text-[9px] px-1.5 py-0.5 rounded", LEVEL_COLORS[perms[m]])}>
                            {MODULE_LABELS[m]}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3">
                {mode === "invite" && (
                  <Button variant="outline" onClick={() => setStep(0)} className="flex-1"><ArrowLeft className="w-4 h-4" /> Back</Button>
                )}
                <Button onClick={() => setStep(2)} className="flex-1">Next <ArrowRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}

          {/* STEP 2: Review & Customize */}
          {step === 2 && (
            <div className="space-y-5">
              <h3 className="text-sm font-medium text-text-muted">Review & Customize</h3>

              {/* Plain English summary */}
              <div className="bg-atlas-navy-3 border border-border rounded-xl p-4 space-y-2">
                <p className="text-sm text-text-primary font-medium">{name || editUser?.name || "This user"} will be able to:</p>
                {MODULES.map((m) => {
                  const level = effectivePerms[m];
                  const isOverridden = overrides[m] !== undefined;
                  if (level === "none") {
                    return <p key={m} className="text-xs text-text-dim flex items-center gap-2"><X className="w-3 h-3 text-red-400" /> Cannot access {MODULE_LABELS[m]}</p>;
                  }
                  return (
                    <p key={m} className={cn("text-xs flex items-center gap-2", isOverridden ? "text-amber-400" : "text-text-muted")}>
                      <Check className="w-3 h-3 text-green-400" />
                      {level === "full" ? "Full control over" : level === "edit" ? "Manage" : "View"} {MODULE_LABELS[m]}
                      {isOverridden && <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1 rounded">override</span>}
                    </p>
                  );
                })}
              </div>

              {/* Advanced overrides */}
              <button onClick={() => setAdvancedOpen(!advancedOpen)} className="flex items-center gap-2 text-sm text-accent">
                {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Advanced overrides
              </button>

              {advancedOpen && (
                <div className="space-y-4">
                  {/* Module grid */}
                  <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 text-left text-text-dim">Module</th>
                          {LEVELS.map((l) => <th key={l} className="px-2 py-2 text-center text-text-dim capitalize">{l}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {MODULES.map((m) => {
                          const current = effectivePerms[m];
                          const isOverridden = overrides[m] !== undefined;
                          return (
                            <tr key={m} className={cn("border-b border-border/30", isOverridden && "bg-amber-500/5")}>
                              <td className="px-3 py-2 text-text-muted">{MODULE_LABELS[m]}</td>
                              {LEVELS.map((l) => (
                                <td key={l} className="px-2 py-2 text-center">
                                  <input
                                    type="radio"
                                    name={`perm-${m}`}
                                    checked={current === l}
                                    onChange={() => {
                                      if (presetPerms[m] === l) {
                                        const next = { ...overrides };
                                        delete next[m];
                                        setOverrides(next);
                                      } else {
                                        setOverrides({ ...overrides, [m]: l });
                                      }
                                    }}
                                    className="accent-accent"
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Dangerous privileges */}
                  <div className="space-y-3">
                    <p className="text-xs text-text-dim font-medium uppercase tracking-wider">Dangerous Privileges</p>
                    {([
                      { key: "canExportSensitive" as const, label: "Export sensitive data", warning: "tenant financials, PII exports" },
                      { key: "canDeleteRecords" as const, label: "Delete records", warning: "permanent record deletion" },
                      { key: "canBulkUpdate" as const, label: "Bulk update operations", warning: "mass data changes" },
                      { key: "canManageUsers" as const, label: "Manage team members", warning: "invite/edit/deactivate users" },
                      { key: "canManageOrgSettings" as const, label: "Manage org settings", warning: "organization configuration" },
                    ]).map(({ key, label, warning }) => (
                      <label key={key} className="flex items-center justify-between p-3 bg-atlas-navy-3 border border-border rounded-lg cursor-pointer">
                        <div>
                          <span className="text-sm text-text-primary">{label}</span>
                          {dangers[key] && <p className="text-[10px] text-amber-400 mt-0.5"><AlertTriangle className="w-3 h-3 inline mr-1" />Grants ability to {warning}</p>}
                        </div>
                        <div
                          className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors", dangers[key] ? "bg-amber-500" : "bg-white/10")}
                          onClick={(e) => { e.preventDefault(); setDangers({ ...dangers, [key]: !dangers[key] }); }}
                        >
                          <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform", dangers[key] ? "translate-x-5" : "translate-x-0.5")} />
                        </div>
                      </label>
                    ))}
                  </div>

                  {hasOverrides && (
                    <button onClick={resetOverrides} className="flex items-center gap-2 text-xs text-accent hover:text-accent-light">
                      <RotateCcw className="w-3 h-3" /> Reset to preset defaults
                    </button>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1"><ArrowLeft className="w-4 h-4" /> Back</Button>
                <Button onClick={() => setStep(3)} className="flex-1">Next <ArrowRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}

          {/* STEP 3: Confirm */}
          {step === 3 && (
            <div className="space-y-5">
              <h3 className="text-sm font-medium text-text-muted">Confirm</h3>
              <div className="bg-atlas-navy-3 border border-border rounded-xl p-4 space-y-3">
                <div className="flex justify-between"><span className="text-xs text-text-dim">Name</span><span className="text-sm text-text-primary">{name || editUser?.name}</span></div>
                {mode === "invite" && <div className="flex justify-between"><span className="text-xs text-text-dim">Email</span><span className="text-sm text-text-primary">{email}</span></div>}
                <div className="flex justify-between"><span className="text-xs text-text-dim">Preset</span><PresetBadge preset={selectedPreset} /></div>
                {hasOverrides && (
                  <div className="border-t border-border pt-2">
                    <p className="text-[10px] text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Custom overrides from preset defaults</p>
                  </div>
                )}
              </div>

              {/* Audit history (edit mode) */}
              {mode === "edit" && auditLogs && auditLogs.length > 0 && (
                <div>
                  <p className="text-xs text-text-dim mb-2">Recent permission changes</p>
                  {auditLogs.slice(0, 3).map((log) => (
                    <div key={log.id} className="text-xs text-text-dim py-1">
                      {log.changeType} by {log.changedByName} on {new Date(log.createdAt).toLocaleDateString()}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1"><ArrowLeft className="w-4 h-4" /> Back</Button>
                <Button onClick={handleConfirm} disabled={isPending} className="flex-1">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "invite" ? "Send Invite & Create Account" : "Save Changes"}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Password (invite only) */}
          {step === 4 && tempPassword && (
            <div className="space-y-5 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-text-primary">Account Created</h3>
              <p className="text-sm text-text-muted">{name} has been invited with the <PresetBadge preset={selectedPreset} /> preset.</p>

              <div className="bg-atlas-navy-3 border border-accent/30 rounded-xl p-4">
                <p className="text-xs text-text-dim mb-2">Temporary Password</p>
                <div className="flex items-center gap-3">
                  <code className="text-xl font-mono text-accent tracking-wider flex-1">{tempPassword}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(tempPassword); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="text-accent hover:text-accent-light"
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-text-dim">Share this password securely. The user will be prompted to change it on first login.</p>
              <Button onClick={onClose} className="w-full">Done</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function SettingsUsersPage() {
  const { data: users, isLoading } = useUsers();
  const [drawer, setDrawer] = useState<{ mode: "invite" | "edit"; user?: UserRow } | null>(null);

  if (isLoading) return <PageSkeleton />;

  const activeUsers = (users ?? []).filter((u) => u.active);
  const inactiveUsers = (users ?? []).filter((u) => !u.active);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-display tracking-wide">Team & Permissions</h1>
          <span className="text-[10px] text-text-dim tracking-[0.2em] uppercase hidden sm:inline">Manage who has access to AtlasPM and what they can do</span>
        </div>
        <Button onClick={() => setDrawer({ mode: "invite" })}>
          <UserPlus className="w-4 h-4" /> Invite User
        </Button>
      </div>

      {activeUsers.length === 0 ? (
        <EmptyState
          title="No team members yet"
          description="Invite your first team member to get started."
          icon={Users}
        />
      ) : (
        <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text-dim uppercase">Name</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-text-dim uppercase">Preset</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-text-dim uppercase">Modules</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-text-dim uppercase">Privileges</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-text-dim uppercase">Joined</th>
                <th className="px-3 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {activeUsers.map((u, i) => (
                <tr key={u.id} className={cn("border-b border-border/30 hover:bg-card-hover transition-colors", i % 2 === 1 && "bg-white/[0.02]")}>
                  <td className="px-4 py-2.5">
                    <p className="text-text-primary font-medium">{u.name}</p>
                    <p className="text-text-dim text-xs">{u.email}</p>
                  </td>
                  <td className="px-3 py-2.5"><PresetBadge preset={u.permissionPreset} /></td>
                  <td className="px-3 py-2.5"><ModulePills grants={u.accessGrants} /></td>
                  <td className="px-3 py-2.5 text-center"><DangerIcons user={u} /></td>
                  <td className="px-3 py-2.5 text-text-dim text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => setDrawer({ mode: "edit", user: u })}
                      className="text-xs text-accent hover:text-accent-light flex items-center gap-1"
                    >
                      <PenLine className="w-3 h-3" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inactiveUsers.length > 0 && (
        <details className="text-sm">
          <summary className="text-text-dim cursor-pointer hover:text-text-muted">
            {inactiveUsers.length} deactivated user{inactiveUsers.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-1 pl-4">
            {inactiveUsers.map((u) => (
              <p key={u.id} className="text-text-dim text-xs">{u.name} ({u.email}) — <PresetBadge preset={u.permissionPreset} /></p>
            ))}
          </div>
        </details>
      )}

      {/* Drawer */}
      {drawer && (
        <PermissionDrawer
          mode={drawer.mode}
          editUser={drawer.user}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
