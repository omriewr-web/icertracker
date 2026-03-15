"use client";

import { useTenants } from "@/hooks/use-tenants";
import { useMetrics } from "@/hooks/use-metrics";
import KpiCard from "@/components/ui/kpi-card";
import FilterBar from "@/components/ui/filter-bar";
import TenantTable from "@/components/tenant/tenant-table";
import TenantDetailModal from "@/components/tenant/tenant-detail-modal";
import TenantEditModal from "@/components/tenant/tenant-edit-modal";
import { PageSkeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";

export default function LeasesContent() {
  const { data: tenants, isLoading } = useTenants();
  const { data: metrics } = useMetrics();

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-text-primary">Lease Management</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Active Leases" value={(metrics?.occupied || 0) - (metrics?.noLease || 0) - (metrics?.expiredLease || 0) - (metrics?.expiringSoon || 0)} icon={FileText} color="#10B981" />
        <KpiCard label="Expiring Soon" value={metrics?.expiringSoon || 0} color="#F59E0B" />
        <KpiCard label="Expired" value={metrics?.expiredLease || 0} color="#EF4444" />
        <KpiCard label="No Lease" value={metrics?.noLease || 0} color="#6B7280" />
      </div>

      <FilterBar showLeaseFilter />

      <div className="bg-card-gradient border border-border rounded-xl overflow-hidden">
        <TenantTable tenants={tenants || []} showLease showScore={false} />
      </div>

      <TenantDetailModal />
      <TenantEditModal />
    </div>
  );
}
