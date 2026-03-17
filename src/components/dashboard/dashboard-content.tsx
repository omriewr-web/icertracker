"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Users, AlertTriangle, DollarSign, Scale, FileText, Shield, Radio } from "lucide-react";
import { useMetrics } from "@/hooks/use-metrics";
import { useBuildings } from "@/hooks/use-buildings";
import { useViolationStats } from "@/hooks/use-violations";
import { useComplianceItems } from "@/hooks/use-compliance";
import { useSignals } from "@/hooks/use-signals";
import KpiCard from "@/components/ui/kpi-card";
import { PageSkeleton } from "@/components/ui/skeleton";
import { fmt$, pct } from "@/lib/utils";
import BalanceChart from "./balance-chart";
import PropertiesTable from "./properties-table";
import BuildingInfo from "./building-info";
import { useAppStore } from "@/stores/app-store";
import ExportButton from "@/components/ui/export-button";
import { ArgusThreatMap, type RiskBuilding } from "./argus-threat-map";
import { BuildingIntelPanel } from "./building-intel-panel";
import { ArrearsBarPanel } from "./arrears-bar-panel";
import { LegalPipelinePanel } from "./legal-pipeline-panel";
import { LiveAlertsPanel } from "./live-alerts-panel";

export default function DashboardContent() {
  const router = useRouter();
  const { selectedBuildingId, setSelectedBuildingId, selectedPortfolio, setSelectedPortfolio, setArrearsFilter, setLeaseFilter } = useAppStore();
  const [mapBuilding, setMapBuilding] = useState<RiskBuilding | null>(null);
  const { data: metrics, isLoading } = useMetrics();
  const { data: buildings } = useBuildings();
  const selectedBuilding = buildings?.find((b) => b.id === selectedBuildingId);

  // Capture portfolio list from unfiltered buildings; persists across portfolio filter changes
  const portfolioRef = useRef<string[]>([]);
  useEffect(() => {
    if (!selectedPortfolio && buildings && buildings.length > 0) {
      portfolioRef.current = [...new Set(buildings.map((b) => b.portfolio).filter(Boolean))].sort() as string[];
    }
  }, [buildings, selectedPortfolio]);
  const portfolios = portfolioRef.current;

  if (isLoading || !metrics) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-display tracking-wide">Argus</h1>
          <span className="text-[10px] text-text-dim tracking-[0.2em] uppercase hidden sm:inline">Portfolio Overview</span>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={(buildings || []).map((b) => ({
              address: b.address,
              totalUnits: b.totalUnits,
              occupied: b.occupied,
              vacant: b.vacant,
              totalBalance: b.totalBalance,
              occupancy: b.totalUnits > 0 ? ((b.occupied / b.totalUnits) * 100).toFixed(1) + "%" : "0%",
            }))}
            filename="portfolio-summary"
            columns={[
              { key: "address", label: "Property" },
              { key: "totalUnits", label: "Units" },
              { key: "occupied", label: "Occupied" },
              { key: "vacant", label: "Vacant" },
              { key: "totalBalance", label: "Balance" },
              { key: "occupancy", label: "Occupancy" },
            ]}
            pdfConfig={{
              title: "Portfolio Summary",
              stats: [
                { label: "Total Units", value: String(metrics.totalUnits) },
                { label: "Occupied", value: String(metrics.occupied) },
                { label: "Vacant", value: String(metrics.vacant) },
                { label: "Total Balance", value: fmt$(metrics.totalBalance) },
                { label: "Legal Cases", value: String(metrics.legalCaseCount) },
                { label: "Expiring Leases", value: String(metrics.expiringSoon) },
              ],
            }}
          />
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
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Units" value={metrics.totalUnits} icon={Building2} color="#C9A84C" subtext={`${pct(metrics.occupancyRate)} occupied`} href="/data" />
        <KpiCard
          label="Occupied"
          value={metrics.occupied}
          icon={Users}
          color="#C9A84C"
          onClick={() => { setArrearsFilter("current"); router.push("/alerts"); }}
        />
        <KpiCard label="Vacant" value={metrics.vacant} icon={Building2} color="#C9A84C" subtext={metrics.lostRent > 0 ? `${fmt$(metrics.lostRent)} lost/mo` : undefined} href="/vacancies" />
        <KpiCard label="Total Balance" value={fmt$(metrics.totalBalance)} icon={DollarSign} color={metrics.totalBalance >= 500000 ? "#e05c5c" : "#C9A84C"} href="/collections" />
        <KpiCard label="Legal Cases" value={metrics.legalCaseCount} icon={Scale} color="#C9A84C" href="/legal" />
        <KpiCard
          label="Expiring Leases"
          value={metrics.expiringSoon}
          icon={FileText}
          color="#C9A84C"
          subtext={metrics.expiredLease > 0 ? `${metrics.expiredLease} expired` : undefined}
          subtextColor={metrics.expiredLease > 0 ? "#e05c5c" : undefined}
          onClick={() => { setLeaseFilter("expiring-soon"); router.push("/leases"); }}
        />
      </div>

      <CoeusWidget />

      {/* === WAR ROOM: MAP + INTEL === */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">
        {/* Left: Argus map */}
        <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-hidden">
          <div className="px-3.5 pt-2.5 pb-2 flex items-center justify-between">
            <div>
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "8px",
                  letterSpacing: ".15em",
                  textTransform: "uppercase",
                }}
                className="text-text-dim mb-0.5"
              >
                Argus Threat Map
              </div>
              <div className="text-xs font-semibold text-text-primary">NYC Portfolio — Live</div>
            </div>
            <Link
              href="/coeus"
              className="text-[9px] no-underline"
              style={{
                fontFamily: "JetBrains Mono, monospace",
                letterSpacing: ".05em",
                color: "#00b8d4",
                border: "1px solid rgba(0,184,212,.3)",
                background: "rgba(0,184,212,.08)",
                borderRadius: "4px",
                padding: "4px 10px",
              }}
            >
              Run Argus Scan →
            </Link>
          </div>
          <ArgusThreatMap onSelect={setMapBuilding} selected={mapBuilding} />
        </div>

        {/* Right column: intel + alerts */}
        <div className="flex flex-col gap-3">
          <BuildingIntelPanel building={mapBuilding} />
          <LiveAlertsPanel />
        </div>
      </div>

      {/* === BOTTOM ROW: ARREARS + LEGAL === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ArrearsBarPanel buildings={(buildings || []).map((b) => ({ address: b.address, totalBalance: b.totalBalance }))} />
        <LegalPipelinePanel />
      </div>

      <ComplianceWidget />

      {selectedBuilding && (
        <BuildingInfo building={selectedBuilding} onClose={() => setSelectedBuildingId(null)} />
      )}

      {buildings && buildings.length > 0 && (
        <>
          <div className="bg-atlas-navy-3 border border-border rounded-xl p-5 chart-container">
            <h3 className="text-sm font-medium text-text-muted mb-4">Arrears by Building — Legal vs. Non-Legal Exposure</h3>
            <BalanceChart buildings={buildings.sort((a, b) => b.totalBalance - a.totalBalance).slice(0, 10)} />
          </div>

          <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium text-text-muted mb-4">Properties Overview</h3>
            <PropertiesTable buildings={buildings} />
          </div>
        </>
      )}
    </div>
  );
}

function CoeusWidget() {
  const { data } = useSignals({ status: "active" });
  const counts = data?.counts;
  if (!counts || counts.total === 0) return null;

  const critical = counts.critical;
  const high = counts.high;

  return (
    <Link href="/coeus" className="block">
      <div className="bg-atlas-navy-3 border border-border rounded-xl p-4 hover:bg-card-hover transition-colors card-hover-lift">
        <div className="flex items-center gap-3">
          <Radio className="w-5 h-5 text-accent" />
          <span className="text-xs font-semibold text-accent uppercase tracking-wider">Coeus Intelligence</span>
          <div className="flex items-center gap-4 text-sm">
            {critical > 0 && (
              <span className="text-text-primary">
                Critical: <span className="font-semibold text-red-400">{critical}</span>
              </span>
            )}
            {critical > 0 && high > 0 && <span className="text-border">|</span>}
            {high > 0 && (
              <span className="text-text-primary">
                High: <span className="font-semibold text-orange-400">{high}</span>
              </span>
            )}
            {(critical > 0 || high > 0) && <span className="text-border">|</span>}
            <span className="text-text-muted">
              {counts.total} active insight{counts.total !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ComplianceWidget() {
  const { data: stats } = useViolationStats();
  const { data: items } = useComplianceItems();
  const overdueCount = items?.filter((i) => i.status === "OVERDUE").length || 0;
  const openViolations = stats?.totalOpen || 0;

  return (
    <Link href="/compliance" className="block">
      <div className="bg-atlas-navy-3 border border-border rounded-xl p-4 hover:bg-card-hover transition-colors card-hover-lift">
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
