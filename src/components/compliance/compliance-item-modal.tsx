"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";
import { useBuildings } from "@/hooks/use-buildings";
import { useVendors } from "@/hooks/use-vendors";
import { useCreateComplianceItem, useUpdateComplianceItem } from "@/hooks/use-compliance";
import type { ComplianceItemView } from "@/types";
import AIEnhanceButton from "@/components/ui/ai-enhance-button";

interface Props {
  open: boolean;
  onClose: () => void;
  item?: ComplianceItemView | null;
  defaultBuildingId?: string | null;
}

const CATEGORIES = ["LOCAL_LAW", "INSPECTION", "FILING", "CUSTOM"] as const;
const FREQUENCIES = ["ANNUAL", "SEMI_ANNUAL", "QUARTERLY", "FIVE_YEAR", "FOUR_YEAR", "ONE_TIME", "ON_EVENT"] as const;
const STATUSES = ["COMPLIANT", "NON_COMPLIANT", "PENDING", "OVERDUE", "SCHEDULED", "NOT_APPLICABLE"] as const;

export default function ComplianceItemModal({ open, onClose, item, defaultBuildingId }: Props) {
  const { data: buildings } = useBuildings();
  const { data: vendors } = useVendors();
  const createMutation = useCreateComplianceItem();
  const updateMutation = useUpdateComplianceItem();

  const [form, setForm] = useState({
    buildingId: "",
    name: "",
    type: "",
    category: "LOCAL_LAW" as string,
    description: "",
    frequency: "ANNUAL" as string,
    status: "PENDING" as string,
    dueDate: "",
    nextDueDate: "",
    assignedVendorId: "",
    cost: 0,
    filedBy: "",
    certificateUrl: "",
    notes: "",
    isCustom: true,
  });

  useEffect(() => {
    if (item) {
      setForm({
        buildingId: item.buildingId,
        name: item.name,
        type: item.type,
        category: item.category,
        description: item.description,
        frequency: item.frequency,
        status: item.status,
        dueDate: item.dueDate?.split("T")[0] || "",
        nextDueDate: item.nextDueDate?.split("T")[0] || "",
        assignedVendorId: item.assignedVendorId || "",
        cost: item.cost,
        filedBy: item.filedBy || "",
        certificateUrl: item.certificateUrl || "",
        notes: item.notes || "",
        isCustom: item.isCustom,
      });
    } else {
      setForm((f) => ({
        ...f,
        buildingId: defaultBuildingId || "",
        name: "",
        type: "",
        category: "CUSTOM",
        description: "",
        frequency: "ANNUAL",
        status: "PENDING",
        dueDate: "",
        nextDueDate: "",
        assignedVendorId: "",
        cost: 0,
        filedBy: "",
        certificateUrl: "",
        notes: "",
        isCustom: true,
      }));
    }
  }, [item, defaultBuildingId, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...form,
      dueDate: form.dueDate || null,
      nextDueDate: form.nextDueDate || null,
      assignedVendorId: form.assignedVendorId || null,
      type: form.type || form.name.replace(/\s+/g, "_").toUpperCase(),
    };

    if (item) {
      updateMutation.mutate({ id: item.id, data }, { onSuccess: onClose });
    } else {
      createMutation.mutate(data, { onSuccess: onClose });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal open={open} onClose={onClose} title={item ? "Edit Compliance Item" : "Add Custom Compliance Item"} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Building">
            <select value={form.buildingId} onChange={(e) => setForm({ ...form, buildingId: e.target.value })} required className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
              <option value="">Select building...</option>
              {buildings?.map((b) => <option key={b.id} value={b.id}>{b.address}</option>)}
            </select>
          </Field>
          <Field label="Name">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
          </Field>
          <Field label="Category">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
          </Field>
          <Field label="Frequency">
            <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
              {FREQUENCIES.map((f) => <option key={f} value={f}>{f.replace(/_/g, " ")}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </Field>
          <Field label="Due Date">
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
          </Field>
          <Field label="Next Due Date">
            <input type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
          </Field>
          <Field label="Assigned Vendor">
            <select value={form.assignedVendorId} onChange={(e) => setForm({ ...form, assignedVendorId: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
              <option value="">None</option>
              {vendors?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </Field>
          <Field label="Cost ($)">
            <input type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
          </Field>
          <Field label="Filed By">
            <input value={form.filedBy} onChange={(e) => setForm({ ...form, filedBy: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
          </Field>
          <Field label="Certificate URL" full>
            <input value={form.certificateUrl} onChange={(e) => setForm({ ...form, certificateUrl: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
          </Field>
        </div>
        <Field label="Description">
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
          <AIEnhanceButton value={form.description} context="violation_note" onEnhanced={(v) => setForm({ ...form, description: v })} />
        </Field>
        <Field label="Notes">
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
          <AIEnhanceButton value={form.notes} context="violation_note" onEnhanced={(v) => setForm({ ...form, notes: v })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : item ? "Update" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-text-dim mb-1">{label}</label>
      {children}
    </div>
  );
}
