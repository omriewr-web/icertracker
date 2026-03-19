"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Trash2, Eye } from "lucide-react";
import { useTenants, useDeleteTenant } from "@/hooks/use-tenants";
import { useBuildings } from "@/hooks/use-buildings";
import { useAppStore } from "@/stores/app-store";
import Button from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { TableTabSkeleton } from "@/components/ui/skeleton";
import { fmt$ } from "@/lib/utils";

const ARREARS_OPTIONS = [
  { value: "all", label: "All Arrears" },
  { value: "current", label: "Current" },
  { value: "30", label: "30 Days" },
  { value: "60", label: "60 Days" },
  { value: "90", label: "90 Days" },
  { value: "120+", label: "120+ Days" },
];

const LEASE_OPTIONS = [
  { value: "all", label: "All Leases" },
  { value: "active", label: "Active" },
  { value: "expiring-soon", label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
  { value: "no-lease", label: "No Lease" },
];

export default function TenantsTab() {
  const { data: buildings } = useBuildings();
  const { setDetailTenantId, setTenantCreateOpen } = useAppStore();
  const deleteTenant = useDeleteTenant();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [arrearsFilter, setArrearsFilter] = useState("all");
  const [leaseFilter, setLeaseFilter] = useState("all");

  // useTenants uses the global store filters, so we use a local query approach
  const { data: allTenants, isLoading } = useTenants();

  const filtered = useMemo(() => {
    let list = allTenants || [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.buildingAddress.toLowerCase().includes(q) ||
        t.unitNumber.toLowerCase().includes(q)
      );
    }
    if (buildingFilter) {
      list = list.filter((t) => t.buildingId === buildingFilter);
    }
    if (arrearsFilter !== "all") {
      list = list.filter((t) => t.arrearsCategory === arrearsFilter);
    }
    if (leaseFilter !== "all") {
      list = list.filter((t) => t.leaseStatus === leaseFilter);
    }
    return list;
  }, [allTenants, search, buildingFilter, arrearsFilter, leaseFilter]);

  if (isLoading) return <TableTabSkeleton rows={10} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
          />
        </div>
        <select
          value={buildingFilter}
          onChange={(e) => setBuildingFilter(e.target.value)}
          className="px-3 py-1.5 text-sm bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">All Buildings</option>
          {buildings?.map((b) => (
            <option key={b.id} value={b.id}>{b.address}</option>
          ))}
        </select>
        <select
          value={arrearsFilter}
          onChange={(e) => setArrearsFilter(e.target.value)}
          className="px-3 py-1.5 text-sm bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
        >
          {ARREARS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={leaseFilter}
          onChange={(e) => setLeaseFilter(e.target.value)}
          className="px-3 py-1.5 text-sm bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
        >
          {LEASE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <p className="text-sm text-text-muted">{filtered.length} tenants</p>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setTenantCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Tenant
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Name</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Unit</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Building</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Rent</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Balance</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Arrears</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Lease</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Score</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                className="border-b border-border/50 hover:bg-card-hover cursor-pointer transition-colors"
                onClick={() => setDetailTenantId(t.id)}
              >
                <td className="px-4 py-3 text-text-primary font-medium">{t.name}</td>
                <td className="px-4 py-3 text-text-muted">{t.unitNumber}</td>
                <td className="px-4 py-3 text-text-muted">{t.buildingAddress}</td>
                <td className="px-4 py-3 text-text-muted">{fmt$(t.marketRent)}</td>
                <td className="px-4 py-3 font-medium">
                  <span className={t.balance > 0 ? "text-red-400" : "text-green-400"}>
                    {fmt$(t.balance)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <ArrearsBadge category={t.arrearsCategory} />
                </td>
                <td className="px-4 py-3">
                  <LeaseBadge status={t.leaseStatus} />
                </td>
                <td className="px-4 py-3 text-text-muted">{t.collectionScore}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <button onClick={() => setDetailTenantId(t.id)} className="p-1 text-text-dim hover:text-accent" title="View">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(t.id)} className="p-1 text-text-dim hover:text-red-400" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-text-dim text-sm">No tenants found</div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteTenant.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
        }}
        title="Delete Tenant"
        message="This will permanently delete this tenant and all associated notes, payments, and communication records."
        loading={deleteTenant.isPending}
      />
    </div>
  );
}

function ArrearsBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    current: "bg-green-500/10 text-green-400",
    "30": "bg-yellow-500/10 text-yellow-400",
    "60": "bg-orange-500/10 text-orange-400",
    "90": "bg-red-500/10 text-red-400",
    "120+": "bg-red-500/20 text-red-300",
    vacant: "bg-gray-500/10 text-gray-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[category] || "bg-gray-500/10 text-gray-400"}`}>
      {category === "current" ? "Current" : category === "vacant" ? "Vacant" : `${category} days`}
    </span>
  );
}

function LeaseBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-500/10 text-green-400",
    "expiring-soon": "bg-yellow-500/10 text-yellow-400",
    expired: "bg-red-500/10 text-red-400",
    "no-lease": "bg-gray-500/10 text-gray-400",
    vacant: "bg-gray-500/10 text-gray-400",
  };
  const labels: Record<string, string> = {
    active: "Active",
    "expiring-soon": "Expiring",
    expired: "Expired",
    "no-lease": "No Lease",
    vacant: "Vacant",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status] || "bg-gray-500/10 text-gray-400"}`}>
      {labels[status] || status}
    </span>
  );
}
