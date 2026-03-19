"use client";

import { useTenants } from "@/hooks/use-tenants";
import { useMetrics } from "@/hooks/use-metrics";
import KpiCard from "@/components/ui/kpi-card";
import FilterBar from "@/components/ui/filter-bar";
import TenantTable from "@/components/tenant/tenant-table";
import TenantDetailModal from "@/components/tenant/tenant-detail-modal";
import TenantEditModal from "@/components/tenant/tenant-edit-modal";
import { PageSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import ExportButton from "@/components/ui/export-button";
import { fmt$ } from "@/lib/utils";
import { FileText, AlertTriangle, RefreshCw } from "lucide-react";
import { useAppStore } from "@/stores/app-store";

export default function LeasesContent() {
  const { data: tenants, isLoading, isError, refetch } = useTenants();
  const { data: metrics } = useMetrics();
  const { setLeaseFilter } = useAppStore();

  if (isLoading) return <PageSkeleton />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-dim animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>
        <p className="text-sm text-text-muted">Failed to load lease data. Please try again.</p>
        <button onClick={() => refetch()} className="mt-3 text-xs text-accent hover:underline flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  if (!tenants || tenants.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Lease Management</h1>
        </div>
        <EmptyState
          icon={FileText}
          title="No tenants found"
          description="Import tenant data to start managing leases."
          action={{ label: "Import Data", href: "/data" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Lease Management</h1>
        <ExportButton
          data={(tenants || []).map((t) => ({
            name: t.name,
            buildingAddress: t.buildingAddress,
            unitNumber: t.unitNumber,
            balance: fmt$(t.balance),
            leaseStatus: t.leaseStatus,
            moveInDate: t.moveInDate || "",
            leaseExpiration: t.leaseExpiration || "",
            actualRent: fmt$(t.actualRent),
            legalRent: fmt$(t.legalRent),
            isStabilized: t.isStabilized ? "Yes" : "No",
          }))}
          filename="leases"
          columns={[
            { key: "name", label: "Tenant Name" },
            { key: "buildingAddress", label: "Building" },
            { key: "unitNumber", label: "Unit" },
            { key: "balance", label: "Balance" },
            { key: "leaseStatus", label: "Status" },
            { key: "moveInDate", label: "Lease Start" },
            { key: "leaseExpiration", label: "Lease End" },
            { key: "actualRent", label: "Rent" },
            { key: "legalRent", label: "Legal Rent" },
            { key: "isStabilized", label: "Stabilized" },
          ]}
          pdfConfig={{
            title: "Lease Management Report",
            stats: [
              { label: "Active Leases", value: String(Math.max(0, (metrics?.occupied || 0) - (metrics?.noLease || 0) - (metrics?.expiredLease || 0) - (metrics?.expiringSoon || 0))) },
              { label: "Expiring Soon", value: String(metrics?.expiringSoon || 0) },
              { label: "Expired", value: String(metrics?.expiredLease || 0) },
              { label: "No Lease", value: String(metrics?.noLease || 0) },
            ],
          }}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Active Leases" value={Math.max(0, (metrics?.occupied || 0) - (metrics?.noLease || 0) - (metrics?.expiredLease || 0) - (metrics?.expiringSoon || 0))} icon={FileText} color="#10B981" onClick={() => setLeaseFilter("")} />
        <KpiCard label="Expiring Soon" value={metrics?.expiringSoon || 0} color="#F59E0B" onClick={() => setLeaseFilter("expiring-soon")} />
        <KpiCard label="Expired" value={metrics?.expiredLease || 0} color="#EF4444" onClick={() => setLeaseFilter("expired")} />
        <KpiCard label="No Lease" value={metrics?.noLease || 0} color="#6B7280" onClick={() => setLeaseFilter("no-lease")} />
      </div>

      <FilterBar showLeaseFilter />

      <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-hidden">
        <TenantTable tenants={tenants || []} showLease showScore={false} />
      </div>

      <TenantDetailModal />
      <TenantEditModal />
    </div>
  );
}
