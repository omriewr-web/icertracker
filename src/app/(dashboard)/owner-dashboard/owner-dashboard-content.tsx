"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Building2, Users, DollarSign, Scale, DoorOpen, FolderKanban,
  AlertTriangle, Shield, ChevronUp, ChevronDown, ExternalLink,
} from "lucide-react";
import KpiCard from "@/components/ui/kpi-card";
import ExportButton from "@/components/ui/export-button";
import { Skeleton, StatCardSkeleton } from "@/components/ui/skeleton";
import { fmt$, formatDate } from "@/lib/utils";
import type { PortfolioMetrics, BuildingView, ViolationStats } from "@/types";
import type { UserRole } from "@/types";

// ── Helpers ───────────────────────────────────────────────────

function pctColor(rate: number): string {
  if (rate > 95) return "#22c55e";
  if (rate >= 90) return "#f59e0b";
  return "#ef4444";
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function isOwnerRole(role: string): boolean {
  return role === "OWNER";
}

function isAdminOrPM(role: string): boolean {
  return ["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN", "PM", "APM"].includes(role);
}

// ── Section wrapper ──────────────────────────────────────────

function SectionCard({
  title, icon: Icon, children, className,
}: {
  title: string; icon?: React.ElementType; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-atlas-navy-3 border border-border rounded-xl ${className || ""}`}>
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
        {Icon && <Icon className="w-4 h-4 text-accent" />}
        <h3 className="text-sm font-medium text-text-muted">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function SectionError({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-400 py-4">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>Unable to load {label}</span>
    </div>
  );
}

function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function OwnerDashboardContent() {
  const { data: session } = useSession();
  const role = (session?.user?.role || "OWNER") as UserRole;
  const isOwner = isOwnerRole(role);

  // Independent data sections
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState(false);

  const [buildings, setBuildings] = useState<BuildingView[]>([]);
  const [buildingsLoading, setBuildingsLoading] = useState(true);
  const [buildingsError, setBuildingsError] = useState(false);

  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState(false);

  const [vacancies, setVacancies] = useState<any[]>([]);
  const [vacanciesLoading, setVacanciesLoading] = useState(true);
  const [vacanciesError, setVacanciesError] = useState(false);

  const [collDash, setCollDash] = useState<any>(null);
  const [collLoading, setCollLoading] = useState(true);
  const [collError, setCollError] = useState(false);

  const [violStats, setViolStats] = useState<ViolationStats | null>(null);
  const [violLoading, setViolLoading] = useState(true);
  const [violError, setViolError] = useState(false);

  useEffect(() => {
    // Metrics
    setMetricsLoading(true);
    fetch("/api/metrics")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setMetrics(d); setMetricsError(false); })
      .catch(() => setMetricsError(true))
      .finally(() => setMetricsLoading(false));

    // Buildings
    setBuildingsLoading(true);
    fetch("/api/buildings?limit=200")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setBuildings(Array.isArray(d) ? d : []); setBuildingsError(false); })
      .catch(() => setBuildingsError(true))
      .finally(() => setBuildingsLoading(false));

    // Projects (owner-visible for OWNER, all for admin/PM)
    setProjectsLoading(true);
    const projectUrl = isOwner ? "/api/projects" : "/api/projects";
    fetch(projectUrl)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => {
        const list = Array.isArray(d) ? d : [];
        // Client-side filter for owner-visible if needed (API already filters for OWNER role)
        setProjects(list);
        setProjectsError(false);
      })
      .catch(() => setProjectsError(true))
      .finally(() => setProjectsLoading(false));

    // Vacancies — use units API with isVacant filter
    setVacanciesLoading(true);
    fetch("/api/units?isVacant=true")
      .then(async (r) => {
        if (!r.ok) {
          // Fallback: try building data for vacancy info
          return [];
        }
        return r.json();
      })
      .then((d) => { setVacancies(Array.isArray(d) ? d : []); setVacanciesError(false); })
      .catch(() => setVacanciesError(true))
      .finally(() => setVacanciesLoading(false));

    // Collections dashboard
    setCollLoading(true);
    fetch("/api/collections/dashboard")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setCollDash(d); setCollError(false); })
      .catch(() => setCollError(true))
      .finally(() => setCollLoading(false));

    // Violation stats
    setViolLoading(true);
    fetch("/api/violations/stats")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setViolStats(d); setViolError(false); })
      .catch(() => setViolError(true))
      .finally(() => setViolLoading(false));
  }, [isOwner]);

  // Sort buildings by issues
  const [sortKey, setSortKey] = useState<string>("totalBalance");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedBuildings = useMemo(() => {
    return [...buildings].sort((a: any, b: any) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [buildings, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const m = metrics;

  // Aggregate vacancy data from buildings if direct vacancy API failed
  const vacancySummary = useMemo(() => {
    if (vacancies.length > 0) {
      return {
        total: vacancies.length,
        topLongest: vacancies
          .sort((a: any, b: any) => (Number(b.daysVacant ?? 0)) - (Number(a.daysVacant ?? 0)))
          .slice(0, 5),
      };
    }
    // Fallback from buildings
    const totalVacant = buildings.reduce((s, b) => s + (b.vacant || 0), 0);
    return { total: totalVacant, topLongest: [] };
  }, [vacancies, buildings]);

  const projectCount = projects.length;

  return (
    <div className="space-y-6 animate-fade-in print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between print:mb-2">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-display tracking-wide">
            Owner Dashboard
          </h1>
          <p className="text-xs text-text-dim tracking-[0.15em] mt-1 font-mono">
            // PORTFOLIO PERFORMANCE OVERVIEW
          </p>
        </div>
        <div className="print:hidden">
          <ExportButton
            data={sortedBuildings.map((b) => ({
              address: b.address,
              totalUnits: b.totalUnits,
              occupied: b.occupied,
              vacant: b.vacant,
              occupancy: b.totalUnits > 0 ? `${((b.occupied / b.totalUnits) * 100).toFixed(1)}%` : "N/A",
              arrears: fmt$(b.totalBalance),
              legalCases: b.legalCount,
            }))}
            filename="owner-portfolio-report"
            columns={[
              { key: "address", label: "Property" },
              { key: "totalUnits", label: "Units" },
              { key: "occupied", label: "Occupied" },
              { key: "vacant", label: "Vacant" },
              { key: "occupancy", label: "Occupancy %" },
              { key: "arrears", label: "Arrears" },
              { key: "legalCases", label: "Legal" },
            ]}
            pdfConfig={{
              title: "Owner Portfolio Report",
              subtitle: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
              stats: m
                ? [
                    { label: "Total Units", value: String(m.totalUnits) },
                    { label: "Occupancy", value: `${Number(m.occupancyRate).toFixed(1)}%` },
                    { label: "Total AR", value: fmt$(m.totalBalance) },
                    { label: "Legal Cases", value: String(m.legalCaseCount) },
                  ]
                : [],
            }}
          />
        </div>
      </div>

      {/* SECTION 1 — PORTFOLIO HEALTH KPIs */}
      {metricsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : metricsError || !m ? (
        <div className="bg-atlas-navy-3 border border-border rounded-xl p-4">
          <SectionError label="portfolio metrics" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard label="Total Units" value={Number(m.totalUnits ?? 0)} icon={Building2} color="#C9A84C" />
          <KpiCard
            label="Occupancy Rate"
            value={`${Number(m.occupancyRate ?? 0).toFixed(1)}%`}
            icon={Users}
            color={pctColor(Number(m.occupancyRate ?? 0))}
          />
          <KpiCard
            label="Vacant Units"
            value={Number(m.vacant ?? 0)}
            icon={DoorOpen}
            color={m.vacant > 0 ? "#f59e0b" : "#C9A84C"}
            subtext={m.lostRent > 0 ? `${fmt$(m.lostRent)}/mo lost` : undefined}
            subtextColor="#ef4444"
          />
          <KpiCard
            label="Lost Rent/Mo"
            value={fmt$(Number(m.lostRent ?? 0))}
            icon={DollarSign}
            color="#ef4444"
          />
          <KpiCard
            label="Active Projects"
            value={projectsLoading ? "..." : projectCount}
            icon={FolderKanban}
            color="#C9A84C"
          />
          <KpiCard
            label="Open Legal Cases"
            value={Number(m.legalCaseCount ?? 0)}
            icon={Scale}
            color={m.legalCaseCount > 0 ? "#ef4444" : "#C9A84C"}
          />
        </div>
      )}

      {/* SECTION 2 — PORTFOLIO BY BUILDING */}
      <SectionCard title="Portfolio by Building" icon={Building2}>
        {buildingsLoading ? (
          <SectionSkeleton rows={6} />
        ) : buildingsError ? (
          <SectionError label="building data" />
        ) : sortedBuildings.length === 0 ? (
          <p className="text-sm text-text-dim text-center py-6">No buildings in portfolio</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-dim border-b border-border text-xs">
                  <SortTh label="Address" col="address" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh label="Units" col="totalUnits" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <SortTh label="Occupied" col="occupied" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <SortTh label="Vacant" col="vacant" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <th className="py-2 text-right font-medium px-2">Occupancy %</th>
                  <SortTh label="Violations" col="arrearsCount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <SortTh label="Legal" col="legalCount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedBuildings.map((b, i) => {
                  const occ = b.totalUnits > 0 ? (b.occupied / b.totalUnits) * 100 : 0;
                  return (
                    <tr
                      key={b.id}
                      className={`border-b border-border/50 last:border-0 hover:bg-card-hover transition-colors ${i % 2 === 1 ? "bg-white/[0.02]" : ""}`}
                    >
                      <td className="py-2.5 text-text-primary font-medium px-2">{b.address}</td>
                      <td className="py-2.5 text-right text-text-muted tabular-nums px-2">{b.totalUnits}</td>
                      <td className="py-2.5 text-right text-text-muted tabular-nums px-2">{b.occupied}</td>
                      <td className="py-2.5 text-right tabular-nums px-2">
                        <span className={b.vacant > 0 ? "text-amber-400" : "text-text-muted"}>{b.vacant}</span>
                      </td>
                      <td className="py-2.5 text-right px-2">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${Math.min(occ, 100)}%`, backgroundColor: pctColor(occ) }}
                            />
                          </div>
                          <span className="text-xs tabular-nums" style={{ color: pctColor(occ) }}>
                            {occ.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums px-2">
                        {b.arrearsCount > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400">
                            {b.arrearsCount}
                          </span>
                        ) : (
                          <span className="text-text-dim">0</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right tabular-nums px-2">
                        <span className={b.legalCount > 0 ? "text-orange-400" : "text-text-dim"}>
                          {b.legalCount}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* SECTION 3 — TWO COLUMNS: Projects + Vacancies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Projects */}
        <SectionCard title="Active Projects" icon={FolderKanban}>
          {projectsLoading ? (
            <SectionSkeleton rows={4} />
          ) : projectsError ? (
            <SectionError label="projects" />
          ) : projects.length === 0 ? (
            <div className="text-center py-8">
              <FolderKanban className="w-8 h-8 text-text-dim mx-auto mb-2" />
              <p className="text-sm text-text-dim">
                {isOwner
                  ? "No owner-visible projects. Ask your PM to mark projects as owner-visible."
                  : "No active projects"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.slice(0, 8).map((p: any) => {
                const pct = Number(p.percentComplete ?? 0);
                const approved = Number(p.approvedBudget ?? 0);
                const actual = Number(p.actualCost ?? 0);
                const variance = approved - actual;
                const overdue = p.targetEndDate && new Date(p.targetEndDate) < new Date();
                return (
                  <div key={p.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{p.name}</p>
                        <p className="text-xs text-text-dim truncate">{p.buildingAddress || ""}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          p.status === "IN_PROGRESS" ? "bg-blue-500/20 text-blue-400" :
                          p.status === "COMPLETED" ? "bg-green-500/20 text-green-400" :
                          p.status === "ON_HOLD" ? "bg-amber-500/20 text-amber-400" :
                          "bg-white/10 text-text-muted"
                        }`}>
                          {(p.status || "").replace(/_/g, " ")}
                        </span>
                        {p.health && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            p.health === "ON_TRACK" ? "bg-green-500/20 text-green-400" :
                            p.health === "AT_RISK" ? "bg-amber-500/20 text-amber-400" :
                            p.health === "OFF_TRACK" ? "bg-red-500/20 text-red-400" :
                            "bg-white/10 text-text-muted"
                          }`}>
                            {(p.health || "").replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: "#C9A84C" }}
                        />
                      </div>
                      <span className="text-xs text-accent font-mono">{pct}%</span>
                    </div>
                    {/* Budget */}
                    {approved > 0 && (
                      <div className="flex items-center gap-4 text-xs text-text-dim">
                        <span>Approved: <span className="text-text-primary">{fmt$(approved)}</span></span>
                        <span>Actual: <span className="text-text-primary">{fmt$(actual)}</span></span>
                        <span>
                          Variance:{" "}
                          <span className={variance >= 0 ? "text-green-400" : "text-red-400"}>
                            {variance >= 0 ? "+" : ""}{fmt$(variance)}
                          </span>
                        </span>
                      </div>
                    )}
                    {p.targetEndDate && (
                      <p className={`text-xs mt-1 ${overdue ? "text-red-400" : "text-text-dim"}`}>
                        Target: {formatDate(p.targetEndDate)} {overdue ? "(OVERDUE)" : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Vacancy Summary */}
        <SectionCard title="Vacancy Summary" icon={DoorOpen}>
          {vacanciesLoading && buildingsLoading ? (
            <SectionSkeleton rows={5} />
          ) : (
            <>
              {/* Aggregate */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <MiniStat label="Total Vacant" value={m ? Number(m.vacant ?? 0) : vacancySummary.total} />
                <MiniStat label="Lost Rent/Mo" value={m ? fmt$(Number(m.lostRent ?? 0)) : "—"} color="#ef4444" />
              </div>

              {/* Top longest vacant */}
              {vacancySummary.topLongest.length > 0 ? (
                <>
                  <p className="text-xs text-text-dim mb-2">Longest vacant units</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-text-dim border-b border-border">
                          <th className="text-left py-1.5 font-medium">Building</th>
                          <th className="text-left py-1.5 font-medium">Unit</th>
                          <th className="text-right py-1.5 font-medium">Days</th>
                          <th className="text-right py-1.5 font-medium">Asking</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vacancySummary.topLongest.map((v: any, i: number) => (
                          <tr key={v.id || i} className="border-b border-border/50 last:border-0">
                            <td className="py-1.5 text-text-primary truncate max-w-[160px]">
                              {v.buildingAddress || v.building?.address || "—"}
                            </td>
                            <td className="py-1.5 text-text-muted">{v.unitNumber || v.unit || "—"}</td>
                            <td className="py-1.5 text-right text-text-muted tabular-nums">
                              {Number(v.daysVacant ?? 0)}
                            </td>
                            <td className="py-1.5 text-right text-text-primary tabular-nums">
                              {v.askingRent ? fmt$(Number(v.askingRent)) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-text-dim text-center py-4">
                  {m && m.vacant === 0 ? "No vacant units — full occupancy!" : "Vacancy details not available"}
                </p>
              )}
            </>
          )}
        </SectionCard>
      </div>

      {/* SECTION 4 — COLLECTIONS SUMMARY */}
      <SectionCard title="Collections Summary" icon={DollarSign}>
        {collLoading && metricsLoading ? (
          <SectionSkeleton rows={4} />
        ) : collError && metricsError ? (
          <SectionError label="collections" />
        ) : (
          <>
            {/* Big AR number */}
            <div className="text-center mb-6">
              <p className="text-[10px] text-text-dim uppercase tracking-[0.15em]">Total AR Balance</p>
              <p className="text-4xl font-bold font-data text-accent tabular-nums mt-1">
                {m ? fmt$(Number(m.totalBalance ?? 0)) : "—"}
              </p>
            </div>

            {/* Aging bars */}
            {m && (
              <div className="space-y-3">
                <AgingBar label="Current" amount={Number(m.current$ ?? 0)} total={Number(m.totalBalance ?? 1)} color="#22c55e" />
                <AgingBar label="30-60 Days" amount={Number(m["arrears30$"] ?? 0)} total={Number(m.totalBalance ?? 1)} color="#f59e0b" />
                <AgingBar label="60-90 Days" amount={Number(m["arrears60$"] ?? 0)} total={Number(m.totalBalance ?? 1)} color="#f97316" />
                <AgingBar label="90+ Days" amount={Number(m["arrears90Plus$"] ?? 0)} total={Number(m.totalBalance ?? 1)} color="#ef4444" />
              </div>
            )}

            {/* Tenant count for ADMIN/PM only */}
            {isAdminOrPM(role) && m && (
              <p className="text-xs text-text-dim mt-4">
                {Number(m.arrears30 ?? 0) + Number(m.arrears60 ?? 0) + Number(m.arrears90Plus ?? 0)} tenants with outstanding balance
              </p>
            )}
          </>
        )}
      </SectionCard>

      {/* SECTION 5 — COMPLIANCE SNAPSHOT */}
      <SectionCard title="Compliance Snapshot" icon={Shield}>
        {violLoading ? (
          <SectionSkeleton rows={4} />
        ) : violError || !violStats ? (
          <SectionError label="violation stats" />
        ) : (
          <>
            {/* Violation class counts */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <p className="text-xs text-text-dim mb-1">Class C (Hazardous)</p>
                <p className="text-2xl font-bold font-data tabular-nums" style={{ color: violStats.classCCount > 0 ? "#ef4444" : "var(--atlas-text)" }}>
                  {violStats.classCCount}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-text-dim mb-1">Class B (Hazardous)</p>
                <p className="text-2xl font-bold font-data tabular-nums" style={{ color: violStats.classBCount > 0 ? "#f97316" : "var(--atlas-text)" }}>
                  {violStats.classBCount}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-text-dim mb-1">Class A (Non-Haz)</p>
                <p className="text-2xl font-bold font-data tabular-nums" style={{ color: violStats.classACount > 0 ? "#f59e0b" : "var(--atlas-text)" }}>
                  {violStats.classACount}
                </p>
              </div>
            </div>

            {/* Top buildings by violation (from buildings data) */}
            {!buildingsLoading && buildings.length > 0 && (
              <>
                <p className="text-xs text-text-dim mb-2">Top buildings by violations</p>
                <div className="space-y-1">
                  {[...buildings]
                    .sort((a, b) => (b.arrearsCount ?? 0) - (a.arrearsCount ?? 0))
                    .slice(0, 5)
                    .filter((b) => b.arrearsCount > 0)
                    .map((b) => (
                      <div key={b.id} className="flex items-center justify-between py-1.5 text-xs">
                        <span className="text-text-primary truncate max-w-[260px]">{b.address}</span>
                        <span className="text-text-muted font-mono">{b.arrearsCount}</span>
                      </div>
                    ))}
                </div>
              </>
            )}

            {violStats.totalOpen === 0 && (
              <p className="text-sm text-text-dim text-center py-4">No open violations</p>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <p className="text-xs text-text-dim">{label}</p>
      <p className="text-lg font-bold font-mono tabular-nums mt-0.5" style={color ? { color } : undefined}>{value}</p>
    </div>
  );
}

function AgingBar({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min((amount / total) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-dim">{label}</span>
        <span className="text-xs font-mono tabular-nums text-text-primary">{fmt$(amount)}</span>
      </div>
      <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function SortTh({
  label, col, sortKey, sortDir, onSort, align = "left",
}: {
  label: string; col: string; sortKey: string; sortDir: "asc" | "desc"; onSort: (col: string) => void; align?: "left" | "right";
}) {
  const active = sortKey === col;
  return (
    <th
      className={`py-2 font-medium cursor-pointer select-none hover:text-text-primary transition-colors px-2 ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => onSort(col)}
    >
      <span className={active ? "text-accent" : ""}>
        {label}
        {active && (sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />)}
      </span>
    </th>
  );
}
