"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";
import { useCreateProject } from "@/hooks/use-projects";
import { useBuildings } from "@/hooks/use-buildings";
import { useVendors } from "@/hooks/use-vendors";

const CATEGORIES = [
  "TURNOVER", "CAPITAL_IMPROVEMENT", "VIOLATION_REMEDIATION", "LOCAL_LAW",
  "FACADE", "ROOF", "BOILER", "PLUMBING", "ELECTRICAL", "APARTMENT_RENO",
  "COMMON_AREA", "EMERGENCY", "OTHER",
] as const;

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

function label(s: string) { return s.replace(/_/g, " "); }

export default function CreateProjectModal({ open, onClose }: Props) {
  const createProject = useCreateProject();
  const { data: buildings } = useBuildings();
  const { data: vendors } = useVendors();

  const [units, setUnits] = useState<{ id: string; unitNumber: string }[]>([]);
  const [form, setForm] = useState({
    name: "",
    buildingId: "",
    unitId: "",
    category: "OTHER" as string,
    priority: "MEDIUM" as string,
    description: "",
    scopeOfWork: "",
    estimatedBudget: "",
    startDate: "",
    targetEndDate: "",
    managerId: "",
    vendorId: "",
    requiresApproval: false,
    ownerVisible: false,
  });

  async function handleBuildingChange(buildingId: string) {
    setForm({ ...form, buildingId, unitId: "" });
    if (!buildingId) { setUnits([]); return; }
    try {
      const res = await fetch(`/api/units?buildingId=${buildingId}`);
      if (res.ok) {
        const data = await res.json();
        setUnits(data.map((u: any) => ({ id: u.id, unitNumber: u.unitNumber })));
      }
    } catch { setUnits([]); }
  }

  function handleCreate() {
    if (!form.name || !form.buildingId) return;
    createProject.mutate(
      {
        name: form.name,
        buildingId: form.buildingId,
        unitId: form.unitId || null,
        category: form.category,
        priority: form.priority,
        description: form.description || null,
        scopeOfWork: form.scopeOfWork || null,
        estimatedBudget: form.estimatedBudget ? parseFloat(form.estimatedBudget) : null,
        startDate: form.startDate || null,
        targetEndDate: form.targetEndDate || null,
        managerId: form.managerId || null,
        vendorId: form.vendorId || null,
        requiresApproval: form.requiresApproval,
        ownerVisible: form.ownerVisible,
      },
      {
        onSuccess: () => {
          setForm({ name: "", buildingId: "", unitId: "", category: "OTHER", priority: "MEDIUM", description: "", scopeOfWork: "", estimatedBudget: "", startDate: "", targetEndDate: "", managerId: "", vendorId: "", requiresApproval: false, ownerVisible: false });
          setUnits([]);
          onClose();
        },
      },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="New Project" wide>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-text-dim mb-1">Project Name *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" placeholder="e.g. 993 Summit Ave — Roof Replacement" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-dim mb-1">Building *</label>
            <select value={form.buildingId} onChange={(e) => handleBuildingChange(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
              <option value="">Select building</option>
              {buildings?.map((b: any) => <option key={b.id} value={b.id}>{b.address}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Unit (optional)</label>
            <select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" disabled={!form.buildingId}>
              <option value="">Whole building</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-dim mb-1">Category *</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
              {CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Priority</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-dim mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none" rows={2} placeholder="Project description..." />
        </div>
        <div>
          <label className="block text-xs text-text-dim mb-1">Scope of Work</label>
          <textarea value={form.scopeOfWork} onChange={(e) => setForm({ ...form, scopeOfWork: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none" rows={2} placeholder="Detailed scope..." />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-text-dim mb-1">Estimated Budget</label>
            <input type="number" value={form.estimatedBudget} onChange={(e) => setForm({ ...form, estimatedBudget: e.target.value })} placeholder="0.00" className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Start Date</label>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Target End Date</label>
            <input type="date" value={form.targetEndDate} onChange={(e) => setForm({ ...form, targetEndDate: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-dim mb-1">Vendor</label>
            <select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
              <option value="">None</option>
              {vendors?.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-4 pb-1">
            <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
              <input type="checkbox" checked={form.requiresApproval} onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })} className="rounded" />
              Requires Approval
            </label>
            <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
              <input type="checkbox" checked={form.ownerVisible} onChange={(e) => setForm({ ...form, ownerVisible: e.target.checked })} className="rounded" />
              Owner Visible
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!form.name || !form.buildingId || createProject.isPending}>
            {createProject.isPending ? "Creating..." : "Create Project"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
