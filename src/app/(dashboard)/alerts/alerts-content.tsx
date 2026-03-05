"use client";

import { useMemo } from "react";
import { AlertTriangle, UserPlus } from "lucide-react";
import { useTenants } from "@/hooks/use-tenants";
import { useMetrics } from "@/hooks/use-metrics";
import { useAppStore } from "@/stores/app-store";
import StatCard from "@/components/ui/stat-card";
import FilterBar from "@/components/ui/filter-bar";
import TenantTable from "@/components/tenant/tenant-table";
import TenantDetailModal from "@/components/tenant/tenant-detail-modal";
import TenantEditModal from "@/components/tenant/tenant-edit-modal";
import BulkActionsBar from "@/components/tenant/bulk-actions-bar";
import Button from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { fmt$ } from "@/lib/utils";

export default function AlertsContent() {
  const { data: tenants, isLoading } = useTenants();
  const { data: metrics } = useMetrics();
  const { setTenantCreateOpen } = useAppStore();

  const arrearsTenants = useMemo(
    () => (tenants || []).filter((t) => t.balance > 0 && t.arrearsCategory !== "current"),
    [tenants]
  );

  const totalArrears = arrearsTenants.reduce((s, t) => s + t.balance, 0);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Arrears Alerts</h1>
        <Button size="sm" onClick={() => setTenantCreateOpen(true)}>
          <UserPlus className="w-3.5 h-3.5" /> Add Tenant
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total in Arrears" value={arrearsTenants.length} icon={AlertTriangle} />
        <StatCard label="Total Owed" value={fmt$(totalArrears)} color="#EF4444" />
        <StatCard label="30 Day" value={metrics?.arrears30 || 0} color="#3B82F6" />
        <StatCard label="60 Day" value={metrics?.arrears60 || 0} color="#F59E0B" />
      </div>

      <FilterBar />
      <BulkActionsBar />

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <TenantTable tenants={arrearsTenants} />
      </div>

      <TenantDetailModal />
      <TenantEditModal />
    </div>
  );
}
