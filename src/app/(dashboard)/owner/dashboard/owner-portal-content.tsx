"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  DoorOpen,
  DollarSign,
  AlertTriangle,
  Wrench,
  Scale,
  Users,
  Home,
} from "lucide-react";
import KpiCard from "@/components/ui/kpi-card";
import { PageSkeleton } from "@/components/ui/skeleton";
import { fmt$ } from "@/lib/utils";

interface OwnerSummary {
  portfolio: {
    totalUnits: number;
    occupied: number;
    vacant: number;
    occupancyRate: number;
  };
  collections: {
    totalAR: number;
    tenantsCurrent: number;
    tenantsWithBalance: number;
    tenantsInLegal: number;
  };
  topBuildings: {
    buildingId: string;
    address: string;
    totalAR: number;
  }[];
  violations: {
    classA: number;
    classB: number;
    classC: number;
  };
  workOrders: {
    open: number;
    inProgress: number;
    completed: number;
  };
  legal: {
    activeCases: number;
  };
}

function useOwnerSummary() {
  return useQuery<OwnerSummary>({
    queryKey: ["owner", "summary"],
    queryFn: async () => {
      const res = await fetch("/api/owner/summary");
      if (!res.ok) throw new Error("Failed to fetch owner summary");
      return res.json();
    },
  });
}

export default function OwnerPortalContent() {
  const { data, isLoading } = useOwnerSummary();

  if (isLoading || !data) return <PageSkeleton />;

  const { portfolio, collections, topBuildings, violations, workOrders, legal } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary font-display tracking-wide">
          Owner Portal
        </h1>
        <span className="text-[10px] text-text-dim tracking-[0.2em] uppercase">
          Portfolio Overview — Read Only
        </span>
      </div>

      {/* Portfolio KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Units" value={portfolio.totalUnits} icon={Home} href="/data" />
        <KpiCard label="Occupied" value={portfolio.occupied} icon={Users} color="#4caf82" href="/data" />
        <KpiCard label="Vacant" value={portfolio.vacant} icon={DoorOpen} color="#e05c5c" href="/vacancies" />
        <KpiCard label="Occupancy" value={`${portfolio.occupancyRate}%`} icon={Building2} color="#c9a84c" href="/vacancies" />
        <KpiCard label="Total AR" value={fmt$(collections.totalAR)} icon={DollarSign} color="#e09a3e" href="/collections" />
        <KpiCard label="In Legal" value={collections.tenantsInLegal} icon={Scale} color="#e05c5c" href="/legal" />
      </div>

      {/* Collections Summary */}
      <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-text-primary font-display tracking-wide mb-4">
          Collections Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">Current Tenants</p>
            <p className="text-xl font-bold text-green-400 font-data mt-1">{collections.tenantsCurrent}</p>
          </div>
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">With Balance</p>
            <p className="text-xl font-bold text-amber-400 font-data mt-1">{collections.tenantsWithBalance}</p>
          </div>
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">Total AR</p>
            <p className="text-xl font-bold text-orange-400 font-data mt-1">{fmt$(collections.totalAR)}</p>
          </div>
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">In Legal</p>
            <p className="text-xl font-bold text-red-400 font-data mt-1">{collections.tenantsInLegal}</p>
          </div>
        </div>
      </div>

      {/* Top Buildings by AR */}
      {topBuildings.length > 0 && (
        <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h2 className="text-sm font-semibold text-text-primary font-display tracking-wide">
              Top 5 Buildings by Accounts Receivable
            </h2>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium text-text-dim uppercase">Building</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-text-dim uppercase">Total AR</th>
              </tr>
            </thead>
            <tbody>
              {topBuildings.map((b, i) => (
                <tr key={b.buildingId} className={i % 2 === 1 ? "bg-atlas-navy-2/30" : ""}>
                  <td className="px-5 py-3 text-text-primary">{b.address}</td>
                  <td className="px-5 py-3 text-right text-text-muted font-mono">{fmt$(b.totalAR)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Violations + Work Orders + Legal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Violations */}
        <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-primary font-display tracking-wide mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Open Violations
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Class A</span>
              <span className="text-sm font-bold text-yellow-400 font-data">{violations.classA}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Class B</span>
              <span className="text-sm font-bold text-orange-400 font-data">{violations.classB}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Class C (Critical)</span>
              <span className="text-sm font-bold text-red-400 font-data">{violations.classC}</span>
            </div>
            <div className="border-t border-border pt-2 flex items-center justify-between">
              <span className="text-sm text-text-dim">Total</span>
              <span className="text-sm font-bold text-text-primary font-data">
                {violations.classA + violations.classB + violations.classC}
              </span>
            </div>
          </div>
        </div>

        {/* Work Orders */}
        <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-primary font-display tracking-wide mb-4 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-400" />
            Work Orders
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Open</span>
              <span className="text-sm font-bold text-blue-400 font-data">{workOrders.open}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">In Progress</span>
              <span className="text-sm font-bold text-amber-400 font-data">{workOrders.inProgress}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Completed</span>
              <span className="text-sm font-bold text-green-400 font-data">{workOrders.completed}</span>
            </div>
            <div className="border-t border-border pt-2 flex items-center justify-between">
              <span className="text-sm text-text-dim">Total</span>
              <span className="text-sm font-bold text-text-primary font-data">
                {workOrders.open + workOrders.inProgress + workOrders.completed}
              </span>
            </div>
          </div>
        </div>

        {/* Legal */}
        <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-primary font-display tracking-wide mb-4 flex items-center gap-2">
            <Scale className="w-4 h-4 text-purple-400" />
            Legal Cases
          </h2>
          <div className="flex items-center justify-center h-24">
            <div className="text-center">
              <p className="text-3xl font-bold text-text-primary font-data">{legal.activeCases}</p>
              <p className="text-xs text-text-dim mt-1">Active Cases</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
