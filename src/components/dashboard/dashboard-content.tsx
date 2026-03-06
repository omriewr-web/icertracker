"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Users, AlertTriangle, DollarSign, Scale, FileText, Shield } from "lucide-react";
import { useMetrics } from "@/hooks/use-metrics";
import { useBuildings, useAllBuildings } from "@/hooks/use-buildings";
import { useViolationStats } from "@/hooks/use-violations";
import { useComplianceItems } from "@/hooks/use-compliance";
import StatCard from "@/components/ui/stat-card";
import { PageSkeleton } from "@/components/ui/skeleton";
import { fmt$, pct } from "@/lib/utils";
import ArrearsChart from "./arrears-chart";
import LeaseChart from "./lease-chart";
import BalanceChart from "./balance-chart";
import PropertiesTable from "./properties-table";
import BuildingInfo from "./building-info";
import { useAppStore } from "@/stores/app-store";

export default function DashboardContent() {
  const router = useRouter();
  const { selectedBuildingId, setSelectedBuildingId, selectedPortfolio, setSelectedPortfolio, setArrearsFilter, setLeaseFilter } = useAppStore();
  const { data: metrics, isLoading } = useMetrics();
  const { data: buildings } = useBuildings();
  const { data: allBuildings } = useAllBuildings();
  const selectedBuilding = buildings?.find((b) => b.id === selectedBuildingId);

  // Derive portfolio list from all buildings (unfiltered) so the dropdown stays populated
  const portfolios = useMemo(() => {
    return [...new Set((allBuildings || []).map((b) => b.portfolio).filter(Boolean))].sort() as string[];
  }, [allBuildings]);

  if (isLoading || !metrics) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        {portfolios.length > 0 && (
          <select
            value={selectedPortfolio || ""}
            onChange={(e) => setSelectedPortfolio(e.target.value || null)}
            className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="">All Portfolios</option>
            {portfolios.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Units" value={metrics.totalUnits} icon={Building2} color="#C9A84C" subtext={`${pct(metrics.occupancyRate)} occupied`} href="/data" />
        <StatCard
          label="Occupied"
          value={metrics.occupied}
          icon={Users}
          color="#C9A84C"
          onClick={() => { setArrearsFilter("current"); router.push("/alerts"); }}
        />
        <StatCard label="Vacant" value={metrics.vacant} icon={Building2} color="#C9A84C" subtext={metrics.lostRent > 0 ? `${fmt$(metrics.lostRent)} lost/mo` : undefined} href="/vacancies" />
        <StatCard label="Total Balance" value={fmt$(metrics.totalBalance)} icon={DollarSign} color="#C9A84C" href="/alerts" />
        <StatCard label="Legal Cases" value={metrics.legalCaseCount} icon={Scale} color="#C9A84C" href="/legal" />
        <StatCard
          label="Expiring Leases"
          value={metrics.expiringSoon}
          icon={FileText}
          color="#C9A84C"
          subtext={`${metrics.expiredLease} expired`}
          onClick={() => { setLeaseFilter("expiring-soon"); router.push("/leases"); }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card-gradient border border-border rounded-xl p-5 chart-container">
          <h3 className="text-sm font-medium text-text-muted mb-4">Arrears Distribution</h3>
          <ArrearsChart
            current={metrics.totalUnits - metrics.arrears30 - metrics.arrears60 - metrics.arrears90Plus - metrics.vacant}
            d30={metrics.arrears30}
            d60={metrics.arrears60}
            d90plus={metrics.arrears90Plus}
          />
        </div>
        <div className="bg-card-gradient border border-border rounded-xl p-5 chart-container">
          <h3 className="text-sm font-medium text-text-muted mb-4">Lease Status</h3>
          <LeaseChart
            active={metrics.occupied - metrics.noLease - metrics.expiredLease - metrics.expiringSoon}
            expiringSoon={metrics.expiringSoon}
            expired={metrics.expiredLease}
            noLease={metrics.noLease}
          />
        </div>
      </div>

      <ComplianceWidget />

      {selectedBuilding && (
        <BuildingInfo building={selectedBuilding} onClose={() => setSelectedBuildingId(null)} />
      )}

      {buildings && buildings.length > 0 && (
        <>
          <div className="bg-card-gradient border border-border rounded-xl p-5 chart-container">
            <h3 className="text-sm font-medium text-text-muted mb-4">Top Balances by Property</h3>
            <BalanceChart buildings={buildings.sort((a, b) => b.totalBalance - a.totalBalance).slice(0, 15)} />
          </div>

          <div className="bg-card-gradient border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium text-text-muted mb-4">Properties Overview</h3>
            <PropertiesTable buildings={buildings} />
          </div>
        </>
      )}
    </div>
  );
}

function ComplianceWidget() {
  const { data: stats } = useViolationStats();
  const { data: items } = useComplianceItems();
  const overdueCount = items?.filter((i) => i.status === "OVERDUE").length || 0;
  const openViolations = stats?.totalOpen || 0;

  return (
    <Link href="/compliance" className="block">
      <div className="bg-card-gradient border border-border rounded-xl p-4 hover:bg-card-hover transition-colors card-hover-lift">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-accent" />
          <div className="flex items-center gap-4 text-sm">
            <span className="text-text-primary">
              Open Violations: <span className="font-semibold text-red-400">{openViolations}</span>
            </span>
            <span className="text-border">|</span>
            <span className="text-text-primary">
              Overdue Compliance: <span className="font-semibold text-orange-400">{overdueCount}</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
