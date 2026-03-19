"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";
import { useCreateWorkOrder } from "@/hooks/use-work-orders";
import { useBuildings } from "@/hooks/use-buildings";
import { useVendors } from "@/hooks/use-vendors";
import AIEnhanceButton from "@/components/ui/ai-enhance-button";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const CATEGORIES = ["PLUMBING", "ELECTRICAL", "HVAC", "APPLIANCE", "GENERAL", "OTHER"] as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateWorkOrderModal({ open, onClose }: Props) {
  const createWO = useCreateWorkOrder();
  const { data: buildings } = useBuildings();
  const { data: vendors } = useVendors();

  const [units, setUnits] = useState<{ id: string; unitNumber: string; tenantId?: string; tenantName?: string }[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    category: "GENERAL",
    buildingId: "",
    unitId: "",
    tenantId: "",
    vendorId: "",
    scheduledDate: "",
    dueDate: "",
    estimatedCost: "",
  });

  async function handleBuildingChange(buildingId: string) {
    setForm({ ...form, buildingId, unitId: "", tenantId: "" });
    if (!buildingId) { setUnits([]); return; }
    try {
      const res = await fetch(`/api/units?buildingId=${buildingId}`);
      if (res.ok) {
        const data = await res.json();
        setUnits(data.map((u: any) => ({
          id: u.id,
          unitNumber: u.unitNumber,
          tenantId: u.tenant?.id || null,
          tenantName: u.tenant?.name || null,
        })));
      }
    } catch { setUnits([]); }
  }

  function handleUnitChange(unitId: string) {
    const unit = units.find((u) => u.id === unitId);
    setForm({
      ...form,
      unitId,
      tenantId: unit?.tenantId || "",
    });
  }

  function handleCreate() {
    if (!form.title || !form.description || !form.buildingId) return;
    createWO.mutate(
      {
        title: form.title,
        description: form.description,
        priority: form.priority,
        category: form.category,
        buildingId: form.buildingId,
        unitId: form.unitId || null,
        tenantId: form.tenantId || null,
        vendorId: form.vendorId || null,
        scheduledDate: form.scheduledDate || null,
        dueDate: form.dueDate || null,
        estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : null,
      },
      {
        onSuccess: () => {
          setForm({ title: "", description: "", priority: "MEDIUM", category: "GENERAL", buildingId: "", unitId: "", tenantId: "", vendorId: "", scheduledDate: "", dueDate: "", estimatedCost: "" });
          setUnits([]);
          onClose();
        },
      }
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="New Work Order">
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-text-dim mb-1">Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" placeholder="Brief summary of the issue" />
        </div>
        <div>
          <label className="block text-xs text-text-dim mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none" rows={3} placeholder="Detailed description..." />
          <AIEnhanceButton value={form.description} context="work_order_description" onEnhanced={(v) => setForm({ ...form, description: v })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-dim mb-1">Priority</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-dim mb-1">Building *</label>
          <select value={form.buildingId} onChange={(e) => handleBuildingChange(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
            <option value="">Select building</option>
            {buildings?.map((b) => <option key={b.id} value={b.id}>{b.address}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-dim mb-1">Unit</label>
            <select value={form.unitId} onChange={(e) => handleUnitChange(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
              <option value="">Common Area / None</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.unitNumber}{u.tenantName ? ` — ${u.tenantName}` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Tenant</label>
            <input value={form.tenantId ? units.find((u) => u.tenantId === form.tenantId)?.tenantName || form.tenantId : ""} readOnly className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-dim focus:outline-none" placeholder="Auto-populated from unit" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-dim mb-1">Vendor</label>
            <select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
              <option value="">None</option>
              {vendors?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Scheduled Date</label>
            <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-dim mb-1">Due Date</label>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Estimated Cost</label>
            <input type="number" value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} placeholder="0.00" className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!form.title || !form.buildingId || createWO.isPending}>
            {createWO.isPending ? "Creating..." : "Create Work Order"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
