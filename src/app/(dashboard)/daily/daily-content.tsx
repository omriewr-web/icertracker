"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarClock, AlertTriangle, Shield, Scale, DollarSign,
  Building2, Wrench, Users, TrendingUp, CheckCircle, Clock,
  FileText, ExternalLink,
} from "lucide-react";
import KpiCard from "@/components/ui/kpi-card";
import { Skeleton, StatCardSkeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/stores/app-store";
import { fmt$, formatDate } from "@/lib/utils";
import type { PortfolioMetrics } from "@/types";

// ── Helpers ───────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "GOOD MORNING";
  if (h < 17) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

function todayHeader(): string {
  const d = new Date();
  const day = d.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const month = d.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
  const date = d.getDate();
  return `// ${day}, ${month} ${date} — ${getGreeting()}`;
}

// ── Section wrapper ──────────────────────────────────────────

function Section({
  title, icon: Icon, iconColor, children, className,
}: {
  title: string; icon: React.ElementType; iconColor: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-atlas-navy-3 border border-border rounded-xl ${className || ""}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function SectionError({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-4 text-sm text-red-400">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>Unable to load {label}</span>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-3 p-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function DailyBriefingContent() {
  const { selectedBuildingId } = useAppStore();

  // Independent data fetching per section
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState(false);

  const [signals, setSignals] = useState<any[]>([]);
  const [signalCount, setSignalCount] = useState(0);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [signalsError, setSignalsError] = useState(false);

  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantsError, setTenantsError] = useState(false);

  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [workOrdersLoading, setWorkOrdersLoading] = useState(true);
  const [workOrdersError, setWorkOrdersError] = useState(false);

  const [legalCases, setLegalCases] = useState<any[]>([]);
  const [legalLoading, setLegalLoading] = useState(true);
  const [legalError, setLegalError] = useState(false);

  const [compliance, setCompliance] = useState<any[]>([]);
  const [complianceLoading, setComplianceLoading] = useState(true);
  const [complianceError, setComplianceError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedBuildingId) params.set("buildingId", selectedBuildingId);
    const qs = params.toString();

    // Metrics
    setMetricsLoading(true);
    fetch(`/api/metrics${qs ? `?${qs}` : ""}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setMetrics(d); setMetricsError(false); })
      .catch(() => setMetricsError(true))
      .finally(() => setMetricsLoading(false));

    // Signals (critical, active)
    setSignalsLoading(true);
    fetch(`/api/signals?severity=critical&status=active&limit=10${selectedBuildingId ? `&buildingId=${selectedBuildingId}` : ""}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => {
        setSignals(d.signals || []);
        setSignalCount(d.counts?.critical ?? (d.signals?.length ?? 0));
        setSignalsError(false);
      })
      .catch(() => setSignalsError(true))
      .finally(() => setSignalsLoading(false));

    // Collections tenants (top by balance)
    setTenantsLoading(true);
    fetch(`/api/collections/tenants?pageSize=8${selectedBuildingId ? `&buildingId=${selectedBuildingId}` : ""}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        const list = d.tenants || d.data || d || [];
        const sorted = Array.isArray(list) ? [...list].sort((a: any, b: any) => Number(b.balance ?? 0) - Number(a.balance ?? 0)).slice(0, 8) : [];
        setTenants(sorted);
        setTenantsError(false);
      })
      .catch(() => setTenantsError(true))
      .finally(() => setTenantsLoading(false));

    // Work orders (open, urgent first)
    setWorkOrdersLoading(true);
    fetch(`/api/work-orders?status=OPEN&priority=URGENT${selectedBuildingId ? `&buildingId=${selectedBuildingId}` : ""}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (Array.isArray(d) && d.length > 0) return d.slice(0, 8);
        // Fallback: fetch all open
        const r2 = await fetch(`/api/work-orders?status=OPEN${selectedBuildingId ? `&buildingId=${selectedBuildingId}` : ""}`);
        if (!r2.ok) return [];
        const d2 = await r2.json();
        return Array.isArray(d2) ? d2.slice(0, 8) : [];
      })
      .then((d) => { setWorkOrders(d); setWorkOrdersError(false); })
      .catch(() => setWorkOrdersError(true))
      .finally(() => setWorkOrdersLoading(false));

    // Legal cases
    setLegalLoading(true);
    fetch(`/api/legal?limit=5${selectedBuildingId ? `&buildingId=${selectedBuildingId}` : ""}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setLegalCases(Array.isArray(d) ? d.slice(0, 5) : []); setLegalError(false); })
      .catch(() => setLegalError(true))
      .finally(() => setLegalLoading(false));

    // Compliance
    setComplianceLoading(true);
    fetch(`/api/compliance?status=OVERDUE&limit=3${selectedBuildingId ? `&buildingId=${selectedBuildingId}` : ""}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d = await r.json();
        const list = d.items || d.data || d || [];
        return Array.isArray(list) ? list.slice(0, 3) : [];
      })
      .then((d) => { setCompliance(d); setComplianceError(false); })
      .catch(() => setComplianceError(true))
      .finally(() => setComplianceLoading(false));
  }, [selectedBuildingId]);

  const m = metrics;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <CalendarClock className="w-5 h-5 text-accent" />
          <h1 className="text-2xl font-bold text-text-primary font-display tracking-wide">
            Daily Briefing
          </h1>
        </div>
        <p className="text-xs text-text-dim tracking-[0.15em] mt-1 font-mono">
          {todayHeader()}
        </p>
      </div>

      {/* SECTION 1 — TODAY AT A GLANCE */}
      {metricsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : metricsError || !m ? (
        <div className="bg-atlas-navy-3 border border-border rounded-xl p-4">
          <SectionError label="metrics" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard
            label="Portfolio Occupancy"
            value={`${Number(m.occupancyRate ?? 0).toFixed(1)}%`}
            icon={Building2}
            color={m.occupancyRate > 95 ? "#22c55e" : m.occupancyRate >= 90 ? "#f59e0b" : "#ef4444"}
          />
          <KpiCard
            label="Total AR Balance"
            value={fmt$(Number(m.totalBalance ?? 0))}
            icon={DollarSign}
            color="#C9A84C"
          />
          <KpiCard
            label="Critical Signals"
            value={signalsLoading ? "..." : signalCount}
            icon={AlertTriangle}
            color={signalCount > 0 ? "#ef4444" : "#22c55e"}
          />
          <KpiCard
            label="Open Legal Cases"
            value={Number(m.legalCaseCount ?? 0)}
            icon={Scale}
            color={m.legalCaseCount > 0 ? "#ef4444" : "#C9A84C"}
          />
          <KpiCard
            label="Expiring Leases"
            value={Number(m.expiringSoon ?? 0)}
            icon={FileText}
            color={m.expiringSoon > 0 ? "#f59e0b" : "#C9A84C"}
          />
          <KpiCard
            label="Vacant Units"
            value={Number(m.vacant ?? 0)}
            icon={Users}
            color={m.vacant > 0 ? "#f59e0b" : "#C9A84C"}
          />
        </div>
      )}

      {/* SECTION 2 — CRITICAL ALERTS */}
      <Section title="Critical Alerts" icon={AlertTriangle} iconColor="text-red-400">
        {signalsLoading ? (
          <SectionSkeleton />
        ) : signalsError ? (
          <SectionError label="critical alerts" />
        ) : signals.length === 0 ? (
          <div className="flex items-center gap-3 px-3 py-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
            <span className="text-sm text-green-300">No critical alerts today — portfolio is clear</span>
          </div>
        ) : (
          <div className="space-y-2">
            {signals.slice(0, 10).map((s: any) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg border-l-4 border-l-red-500 bg-red-500/5 hover:bg-red-500/10 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{s.title || s.type}</p>
                  <p className="text-xs text-text-dim truncate mt-0.5">{s.description || ""}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {s.buildingAddress && (
                    <span className="text-xs text-text-dim hidden sm:inline">{s.buildingAddress}</span>
                  )}
                  <span className="text-xs text-text-dim">
                    {s.lastTriggeredAt ? timeAgo(s.lastTriggeredAt) : s.createdAt ? timeAgo(s.createdAt) : ""}
                  </span>
                  <Link href="/signals" className="text-xs text-accent hover:underline whitespace-nowrap">
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* SECTION 3 — THREE COLUMNS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — Collections Priority */}
        <Section title="Collections Priority" icon={DollarSign} iconColor="text-red-400">
          {tenantsLoading ? (
            <SectionSkeleton />
          ) : tenantsError ? (
            <SectionError label="collections" />
          ) : tenants.length === 0 ? (
            <p className="text-sm text-text-dim text-center py-6">No tenants with outstanding balances</p>
          ) : (
            <>
              <div className="space-y-1">
                {tenants.map((t: any) => (
                  <div key={t.id || t.tenantId} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-card-hover transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary truncate">{t.name || t.tenantName}</p>
                      <p className="text-xs text-text-dim truncate">{t.buildingAddress || t.building || ""}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-sm font-mono font-medium text-red-400">{fmt$(Number(t.balance ?? 0))}</p>
                      {t.arrearsDays != null && t.arrearsDays > 0 && (
                        <p className="text-[10px] text-text-dim">{t.arrearsDays}d overdue</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/collections" className="flex items-center gap-1 mt-3 text-xs text-accent hover:underline">
                View all in Collections → <ExternalLink className="w-3 h-3" />
              </Link>
            </>
          )}
        </Section>

        {/* MIDDLE — Urgent Work Orders */}
        <Section title="Urgent Work Orders" icon={Wrench} iconColor="text-amber-400">
          {workOrdersLoading ? (
            <SectionSkeleton />
          ) : workOrdersError ? (
            <SectionError label="work orders" />
          ) : workOrders.length === 0 ? (
            <p className="text-sm text-text-dim text-center py-6">No urgent work orders</p>
          ) : (
            <>
              <div className="space-y-1">
                {workOrders.map((wo: any) => {
                  const daysOpen = daysSince(wo.createdAt);
                  return (
                    <div key={wo.id} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-card-hover transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm text-text-primary truncate">{wo.title}</p>
                        <p className="text-xs text-text-dim truncate">{wo.buildingAddress || ""}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          wo.priority === "URGENT" ? "bg-red-500/20 text-red-400" :
                          wo.priority === "HIGH" ? "bg-orange-500/20 text-orange-400" :
                          "bg-blue-500/20 text-blue-400"
                        }`}>
                          {wo.priority}
                        </span>
                        <span className={`text-xs font-mono ${daysOpen > 7 ? "text-red-400" : "text-text-dim"}`}>
                          {daysOpen}d
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Link href="/maintenance" className="flex items-center gap-1 mt-3 text-xs text-accent hover:underline">
                View all Work Orders → <ExternalLink className="w-3 h-3" />
              </Link>
            </>
          )}
        </Section>

        {/* RIGHT — Legal & Compliance */}
        <Section title="Legal & Compliance" icon={Scale} iconColor="text-purple-400">
          {legalLoading && complianceLoading ? (
            <SectionSkeleton />
          ) : legalError && complianceError ? (
            <SectionError label="legal & compliance" />
          ) : (
            <>
              {/* Legal Cases */}
              {legalError ? (
                <p className="text-xs text-red-400 mb-3">Unable to load legal cases</p>
              ) : legalCases.length === 0 ? (
                <p className="text-sm text-text-dim text-center py-3">No active legal cases</p>
              ) : (
                <div className="space-y-1 mb-4">
                  {legalCases.map((c: any) => {
                    const daysInStage = daysSince(c.createdAt);
                    return (
                      <div key={c.id} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-card-hover transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm text-text-primary truncate">
                            {c.tenant?.unit?.building?.address || c.tenant?.name || "Case"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">
                            {(c.stage || "").replace(/_/g, " ").replace(/-/g, " ")}
                          </span>
                          <span className="text-xs text-text-dim font-mono">{daysInStage}d</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Compliance Items */}
              {complianceError ? (
                <p className="text-xs text-red-400">Unable to load compliance items</p>
              ) : compliance.length === 0 ? (
                <p className="text-sm text-text-dim text-center py-3">No overdue compliance items</p>
              ) : (
                <div className="space-y-1 border-t border-border pt-3">
                  <p className="text-[10px] text-text-dim uppercase tracking-[0.15em] mb-2">Compliance</p>
                  {compliance.map((item: any) => {
                    const overdue = item.daysUntilDue != null && item.daysUntilDue < 0;
                    return (
                      <div key={item.id} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-card-hover transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm text-text-primary truncate">{item.name}</p>
                          <p className="text-xs text-text-dim truncate">{item.buildingAddress || ""}</p>
                        </div>
                        <span className={`text-xs font-mono shrink-0 ml-2 ${overdue ? "text-red-400" : "text-text-dim"}`}>
                          {item.nextDueDate ? formatDate(item.nextDueDate) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3 mt-3">
                <Link href="/legal" className="text-xs text-accent hover:underline">Legal →</Link>
                <Link href="/compliance" className="text-xs text-accent hover:underline">Compliance →</Link>
              </div>
            </>
          )}
        </Section>
      </div>

      {/* SECTION 4 — QUICK STATS ROW */}
      {metricsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : metricsError || !m ? null : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickStat label="Arrears 30-60 Days" value={fmt$(Number(m["arrears30$"] ?? 0))} />
          <QuickStat label="Arrears 60-90 Days" value={fmt$(Number(m["arrears60$"] ?? 0))} />
          <QuickStat label="Arrears 90+ Days" value={fmt$(Number(m["arrears90Plus$"] ?? 0))} color="#ef4444" />
          <QuickStat label="No Lease" value={String(Number(m.noLease ?? 0))} color="#f59e0b" />
        </div>
      )}
    </div>
  );
}

// ── Quick Stat Box ───────────────────────────────────────────

function QuickStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-atlas-navy-3 border border-border rounded-lg p-4">
      <p className="text-[10px] text-text-dim uppercase tracking-[0.15em] font-medium">{label}</p>
      <p
        className="text-xl font-bold font-data mt-1 tabular-nums"
        style={color ? { color } : { color: "var(--atlas-text)" }}
      >
        {value}
      </p>
    </div>
  );
}
