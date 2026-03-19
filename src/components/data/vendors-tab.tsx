"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Phone, Mail } from "lucide-react";
import { useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor } from "@/hooks/use-vendors";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { TableTabSkeleton } from "@/components/ui/skeleton";
import { fmt$ } from "@/lib/utils";

export default function VendorsTab() {
  const { data: vendors, isLoading } = useVendors();
  const deleteVendor = useDeleteVendor();
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editVendor, setEditVendor] = useState<any>(null);

  const filtered = (vendors || []).filter((v) =>
    !search ||
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    (v.company && v.company.toLowerCase().includes(search.toLowerCase())) ||
    (v.specialty && v.specialty.toLowerCase().includes(search.toLowerCase()))
  );

  if (isLoading) return <TableTabSkeleton rows={6} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
            <input
              type="text"
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
            />
          </div>
          <p className="text-sm text-text-muted">{filtered.length} vendors</p>
        </div>
        <Button size="sm" onClick={() => { setEditVendor(null); setFormOpen(true); }}>
          <Plus className="w-3.5 h-3.5" /> Add Vendor
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Name</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Company</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Specialty</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Phone</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Email</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Rate</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                <td className="px-4 py-3 text-text-primary font-medium">{v.name}</td>
                <td className="px-4 py-3 text-text-muted">{v.company || "—"}</td>
                <td className="px-4 py-3">
                  {v.specialty ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{v.specialty}</span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {v.phone ? (
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{v.phone}</span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {v.email ? (
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{v.email}</span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-text-muted">{v.hourlyRate ? `${fmt$(v.hourlyRate)}/hr` : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => { setEditVendor(v); setFormOpen(true); }} className="p-1 text-text-dim hover:text-accent" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(v.id)} className="p-1 text-text-dim hover:text-red-400" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-text-dim text-sm">No vendors found</div>
        )}
      </div>

      <VendorFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditVendor(null); }}
        vendor={editVendor}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteVendor.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
        }}
        title="Delete Vendor"
        message="This will permanently delete this vendor."
        loading={deleteVendor.isPending}
      />
    </div>
  );
}

function VendorFormModal({ open, onClose, vendor }: {
  open: boolean; onClose: () => void; vendor: any;
}) {
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();
  const [form, setForm] = useState({
    name: "", company: "", specialty: "", phone: "", email: "", hourlyRate: "", notes: "",
  });

  const isEdit = !!vendor;

  // Sync form when vendor changes
  const currentVendorId = vendor?.id || null;
  const [prevId, setPrevId] = useState<string | null>(null);
  if (open && currentVendorId !== prevId) {
    setPrevId(currentVendorId);
    if (vendor) {
      setForm({
        name: vendor.name || "",
        company: vendor.company || "",
        specialty: vendor.specialty || "",
        phone: vendor.phone || "",
        email: vendor.email || "",
        hourlyRate: vendor.hourlyRate?.toString() || "",
        notes: vendor.notes || "",
      });
    } else {
      setForm({ name: "", company: "", specialty: "", phone: "", email: "", hourlyRate: "", notes: "" });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: form.name,
      company: form.company || null,
      specialty: form.specialty || null,
      phone: form.phone || null,
      email: form.email || null,
      hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : null,
      notes: form.notes || null,
    };
    if (isEdit) {
      updateVendor.mutate({ id: vendor.id, data }, { onSuccess: onClose });
    } else {
      createVendor.mutate(data, { onSuccess: onClose });
    }
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Vendor" : "Add Vendor"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-text-dim mb-1">Name *</label>
            <input type="text" value={form.name} onChange={set("name")} required
              className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Company</label>
            <input type="text" value={form.company} onChange={set("company")}
              className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Specialty</label>
            <input type="text" value={form.specialty} onChange={set("specialty")} placeholder="e.g. Plumbing, Electrical"
              className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Hourly Rate</label>
            <input type="number" step="0.01" value={form.hourlyRate} onChange={set("hourlyRate")} placeholder="0.00"
              className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Phone</label>
            <input type="tel" value={form.phone} onChange={set("phone")}
              className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Email</label>
            <input type="email" value={form.email} onChange={set("email")}
              className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-dim mb-1">Notes</label>
          <textarea value={form.notes} onChange={set("notes")} rows={3}
            className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent resize-none" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={createVendor.isPending || updateVendor.isPending}>
            {isEdit ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
