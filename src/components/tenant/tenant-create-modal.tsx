"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { useBuildings } from "@/hooks/use-buildings";
import { useCreateTenant } from "@/hooks/use-tenants";

export default function TenantCreateModal() {
  const { tenantCreateOpen, setTenantCreateOpen, selectedBuildingId } = useAppStore();
  const { data: buildings } = useBuildings();
  const createTenant = useCreateTenant();

  const [form, setForm] = useState({
    buildingId: selectedBuildingId || "",
    unitNumber: "",
    name: "",
    email: "",
    phone: "",
    marketRent: "",
    legalRent: "",
    deposit: "",
    chargeCode: "",
    isStabilized: false,
    leaseExpiration: "",
    moveInDate: "",
  });

  // Reset form when modal opens
  const handleClose = () => {
    setTenantCreateOpen(false);
    setForm({
      buildingId: selectedBuildingId || "",
      unitNumber: "",
      name: "",
      email: "",
      phone: "",
      marketRent: "",
      legalRent: "",
      deposit: "",
      chargeCode: "",
      isStabilized: false,
      leaseExpiration: "",
      moveInDate: "",
    });
  };

  function handleSave() {
    createTenant.mutate(
      {
        buildingId: form.buildingId,
        unitNumber: form.unitNumber,
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        marketRent: parseFloat(form.marketRent) || 0,
        legalRent: parseFloat(form.legalRent) || 0,
        deposit: parseFloat(form.deposit) || 0,
        chargeCode: form.chargeCode || null,
        isStabilized: form.isStabilized,
        leaseExpiration: form.leaseExpiration || null,
        moveInDate: form.moveInDate || null,
      },
      { onSuccess: handleClose }
    );
  }

  if (!tenantCreateOpen) return null;

  return (
    <Modal open={tenantCreateOpen} onClose={handleClose} title="Add Tenant">
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-text-dim mb-1">Building *</label>
          <select
            value={form.buildingId}
            onChange={(e) => setForm({ ...form, buildingId: e.target.value })}
            className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="">Select building...</option>
            {buildings?.map((b) => (
              <option key={b.id} value={b.id}>{b.address}</option>
            ))}
          </select>
        </div>
        <InputField label="Unit Number *" value={form.unitNumber} onChange={(v) => setForm({ ...form, unitNumber: v })} />
        <InputField label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <InputField label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputField label="Market Rent" value={form.marketRent} onChange={(v) => setForm({ ...form, marketRent: v })} type="number" />
          <InputField label="Legal Rent" value={form.legalRent} onChange={(v) => setForm({ ...form, legalRent: v })} type="number" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputField label="Deposit" value={form.deposit} onChange={(v) => setForm({ ...form, deposit: v })} type="number" />
          <InputField label="Charge Code" value={form.chargeCode} onChange={(v) => setForm({ ...form, chargeCode: v })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputField label="Move-In Date" value={form.moveInDate} onChange={(v) => setForm({ ...form, moveInDate: v })} type="date" />
          <InputField label="Lease Expiration" value={form.leaseExpiration} onChange={(v) => setForm({ ...form, leaseExpiration: v })} type="date" />
        </div>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={form.isStabilized}
            onChange={(e) => setForm({ ...form, isStabilized: e.target.checked })}
            className="rounded"
          />
          Rent Stabilized
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={createTenant.isPending || !form.buildingId || !form.unitNumber || !form.name}
          >
            {createTenant.isPending ? "Creating..." : "Create Tenant"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function InputField({
  label, value, onChange, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-text-dim mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
      />
    </div>
  );
}
