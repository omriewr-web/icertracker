"use client";

import { useMemo } from "react";
import { AlertTriangle, UserPlus, Clock, CalendarClock, RefreshCw, Bell } from "lucide-react";
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
import EmptyState from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { fmt$ } from "@/lib/utils";

export default function AlertsContent() {
  const { data: tenants, isLoading, isError, refetch } = useTenants();
  const { data: metrics } = useMetrics();
  const { setTenantCreateOpen, setArrearsFilter } = useAppStore();

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

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-dim animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>
        <p className="text-sm text-text-muted">Failed to load arrears data. Please try again.</p>
        <button onClick={() => refetch()} className="mt-3 text-xs text-accent hover:underline flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  if (arrearsTenants.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-display tracking-wide">Arrears Alerts</h1>
            <span className="text-[10px] text-text-dim tracking-[0.2em] uppercase hidden sm:inline">Financial — Revenue at Risk</span>
          </div>
          <Button size="sm" onClick={() => setTenantCreateOpen(true)}>
            <UserPlus className="w-3.5 h-3.5" /> Add Tenant
          </Button>
        </div>
        <EmptyState
          icon={Bell}
          title="No arrears alerts"
          description="All tenants are current on payments. No action needed."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-display tracking-wide">Arrears Alerts</h1>
          <span className="text-[10px] text-text-dim tracking-[0.2em] uppercase hidden sm:inline">Financial — Revenue at Risk</span>
        </div>
        <Button size="sm" onClick={() => setTenantCreateOpen(true)}>
          <UserPlus className="w-3.5 h-3.5" /> Add Tenant
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total in Arrears" value={arrearsTenants.length} icon={AlertTriangle} onClick={() => setArrearsFilter("")} />
        <KpiCard label="Total Owed" value={fmt$(totalArrears)} color="#EF4444" href="/collections" />
        <KpiCard label="30 Day" value={arrears30Tenants.length} icon={Clock} color="#3B82F6" subtext={arrears30Total > 0 ? fmt$(arrears30Total) : undefined} onClick={() => setArrearsFilter("30")} />
        <KpiCard label="60 Day" value={arrears60Tenants.length} icon={CalendarClock} color="#F59E0B" subtext={arrears60Total > 0 ? fmt$(arrears60Total) : undefined} onClick={() => setArrearsFilter("60")} />
      </div>

      <FilterBar />
      <BulkActionsBar />

      <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-hidden">
        <TenantTable tenants={arrearsTenants} />
      </div>

      <TenantDetailModal />
      <TenantEditModal />
    </div>
  );
}
