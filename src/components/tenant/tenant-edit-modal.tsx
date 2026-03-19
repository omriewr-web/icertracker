"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { useTenant, useUpdateTenant } from "@/hooks/use-tenants";
import LoadingSpinner from "@/components/ui/loading-spinner";

export default function TenantEditModal() {
  const { editTenantId, setEditTenantId } = useAppStore();
  const { data: tenant, isLoading } = useTenant(editTenantId);
  const updateTenant = useUpdateTenant();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    marketRent: "",
    balance: "",
    deposit: "",
    chargeCode: "",
    leaseExpiration: "",
    moveInDate: "",
    isStabilized: false,
  });

  useEffect(() => {
    if (tenant) {
      setForm({
        name: tenant.name || "",
        email: tenant.email || "",
        phone: tenant.phone || "",
        marketRent: String(Number(tenant.marketRent) || ""),
        balance: String(Number(tenant.balance) || ""),
        deposit: String(Number(tenant.deposit) || ""),
        chargeCode: tenant.chargeCode || "",
        leaseExpiration: tenant.leaseExpiration ? new Date(tenant.leaseExpiration).toISOString().split("T")[0] : "",
        moveInDate: tenant.moveInDate ? new Date(tenant.moveInDate).toISOString().split("T")[0] : "",
        isStabilized: tenant.isStabilized || false,
      });
    }
  }, [tenant]);

  function handleSave() {
    if (!editTenantId) return;
    updateTenant.mutate(
      {
        id: editTenantId,
        data: {
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          marketRent: parseFloat(form.marketRent) || 0,
          balance: parseFloat(form.balance) || 0,
          deposit: parseFloat(form.deposit) || 0,
          chargeCode: form.chargeCode || null,
          leaseExpiration: form.leaseExpiration || null,
          moveInDate: form.moveInDate || null,
          isStabilized: form.isStabilized,
        },
      },
      { onSuccess: () => setEditTenantId(null) }
    );
  }

  if (!editTenantId) return null;

  return (
    <Modal open={!!editTenantId} onClose={() => setEditTenantId(null)} title="Edit Tenant">
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-3">
          <InputField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <InputField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <InputField label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="Market Rent" value={form.marketRent} onChange={(v) => setForm({ ...form, marketRent: v })} type="number" />
            <InputField label="Balance" value={form.balance} onChange={(v) => setForm({ ...form, balance: v })} type="number" />
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
            <Button variant="outline" onClick={() => setEditTenantId(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateTenant.isPending}>
              {updateTenant.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      )}
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
