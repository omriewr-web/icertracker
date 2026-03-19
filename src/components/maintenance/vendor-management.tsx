"use client";

import { useState } from "react";
import { Plus, Trash2, Phone, Mail, Pencil } from "lucide-react";
import { useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor } from "@/hooks/use-vendors";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import EmptyState from "@/components/ui/empty-state";

interface VendorFormData {
  name: string;
  company: string;
  email: string;
  phone: string;
  specialty: string;
  hourlyRate: string;
  notes: string;
}

const EMPTY_FORM: VendorFormData = { name: "", company: "", email: "", phone: "", specialty: "", hourlyRate: "", notes: "" };

export default function VendorManagement() {
  const { data: vendors, isLoading } = useVendors();
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VendorFormData>(EMPTY_FORM);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(v: any) {
    setEditingId(v.id);
    setForm({
      name: v.name || "",
      company: v.company || "",
      email: v.email || "",
      phone: v.phone || "",
      specialty: v.specialty || "",
      hourlyRate: v.hourlyRate != null ? String(v.hourlyRate) : "",
      notes: v.notes || "",
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      company: form.company || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      specialty: form.specialty || undefined,
      hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
      notes: form.notes || undefined,
    };

    const onSuccess = () => {
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    };

    if (editingId) {
      updateVendor.mutate({ id: editingId, data: payload }, { onSuccess });
    } else {
      createVendor.mutate(payload, { onSuccess });
    }
  }

  const isPending = editingId ? updateVendor.isPending : createVendor.isPending;

  if (isLoading) return <p className="text-text-dim text-sm py-4">Loading vendors...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-muted">Vendors</h2>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" /> Add Vendor
        </Button>
      </div>

      {vendors && vendors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {vendors.map((v) => (
            <div key={v.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-text-primary">{v.name}</p>
                  {v.company && <p className="text-xs text-text-dim">{v.company}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(v)}
                    className="text-text-dim hover:text-accent transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteVendor.mutate(v.id)}
                    className="text-text-dim hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {v.specialty && (
                <span className="inline-block text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full mb-2">
                  {v.specialty}
                </span>
              )}
              <div className="space-y-1 text-xs text-text-dim">
                {v.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {v.phone}
                  </div>
                )}
                {v.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {v.email}
                  </div>
                )}
                {v.hourlyRate != null && (
                  <p>${v.hourlyRate}/hr</p>
                )}
              </div>
              {v.notes && <p className="text-xs text-text-dim mt-2 line-clamp-2">{v.notes}</p>}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No vendors" description="Add vendors to assign to work orders" />
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditingId(null); }} title={editingId ? "Edit Vendor" : "Add Vendor"}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Input label="Company" value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Specialty" value={form.specialty} onChange={(v) => setForm({ ...form, specialty: v })} />
            <Input label="Hourly Rate ($)" type="number" value={form.hourlyRate} onChange={(v) => setForm({ ...form, hourlyRate: v })} />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
            <Button type="submit" disabled={isPending || !form.name}>
              {isPending ? (editingId ? "Saving..." : "Adding...") : (editingId ? "Save Changes" : "Add Vendor")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-text-dim mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
      />
    </div>
  );
}
