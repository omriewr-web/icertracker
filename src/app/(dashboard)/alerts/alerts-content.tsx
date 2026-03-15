"use client";

import { useMemo } from "react";
import { AlertTriangle, UserPlus, Clock, CalendarClock } from "lucide-react";
import { useTenants } from "@/hooks/use-tenants";
import { useMetrics } from "@/hooks/use-metrics";
import { useAppStore } from "@/stores/app-store";
import KpiCard from "@/components/ui/kpi-card";
import FilterBar from "@/components/ui/filter-bar";
import TenantTable from "@/components/tenant/tenant-table";
import TenantDetailModal from "@/components/tenant/tenant-detail-modal";
import TenantEditModal from "@/components/tenant/tenant-edit-modal";
import BulkActionsBar from "@/components/tenant/bulk-actions-bar";
import Button from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
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
  const arrears30Tenants = arrearsTenants.filter((t) => t.arrearsCategory === "30");
  const arrears60Tenants = arrearsTenants.filter((t) => t.arrearsCategory === "60");
  const arrears30Total = arrears30Tenants.reduce((s, t) => s + t.balance, 0);
  const arrears60Total = arrears60Tenants.reduce((s, t) => s + t.balance, 0);

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Arrears Alerts</h1>
        <Button size="sm" onClick={() => setTenantCreateOpen(true)}>
          <UserPlus className="w-3.5 h-3.5" /> Add Tenant
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total in Arrears" value={arrearsTenants.length} icon={AlertTriangle} />
        <KpiCard label="Total Owed" value={fmt$(totalArrears)} color="#EF4444" />
        <KpiCard label="30 Day" value={arrears30Tenants.length} icon={Clock} color="#3B82F6" subtext={arrears30Total > 0 ? fmt$(arrears30Total) : undefined} />
        <KpiCard label="60 Day" value={arrears60Tenants.length} icon={CalendarClock} color="#F59E0B" subtext={arrears60Total > 0 ? fmt$(arrears60Total) : undefined} />
      </div>

      <FilterBar />
      <BulkActionsBar />

      <div className="bg-card-gradient border border-border rounded-xl overflow-hidden">
        <TenantTable tenants={arrearsTenants} />
      </div>

      <TenantDetailModal />
      <TenantEditModal />
    </div>
  );
}
