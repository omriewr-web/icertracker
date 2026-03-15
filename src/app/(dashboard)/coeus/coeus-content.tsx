"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Radio,
  RefreshCw,
  CheckCircle,
  Eye,
  DollarSign,
  Scale,
  DoorOpen,
  Shield,
  Wrench,
  FileText,
  Gauge,
  ChevronDown,
  ChevronUp,
  Clock,
  UserCheck,
  CalendarClock,
  ArrowUpDown,
  BarChart3,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  useSignals,
  useRunScan,
  useAcknowledgeSignal,
  useResolveSignal,
  useUpdateSignal,
  type Signal,
} from "@/hooks/use-signals";
import { useBuildings } from "@/hooks/use-buildings";
import { PageSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import Button from "@/components/ui/button";
import TitanAction from "@/components/ui/titan-action";
import ExportButton from "@/components/ui/export-button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

// ── Config ─────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; chartColor: string }> = {
  critical: { color: "text-atlas-red", bg: "bg-atlas-red/10", border: "border-atlas-red/30", label: "Critical", chartColor: "#e05c5c" },
  high: { color: "text-atlas-amber", bg: "bg-atlas-amber/10", border: "border-atlas-amber/30", label: "High", chartColor: "#e09a3e" },
  medium: { color: "text-accent", bg: "bg-accent/10", border: "border-accent/30", label: "Medium", chartColor: "#c9a84c" },
  low: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "Low", chartColor: "#3b82f6" },
};

const TYPE_CONFIG: Record<string, { icon: typeof AlertTriangle; label: string }> = {
  collections_risk: { icon: DollarSign, label: "Collections" },
  legal_escalation: { icon: Scale, label: "Legal" },
  vacancy_risk: { icon: DoorOpen, label: "Vacancy" },
  violation_risk: { icon: Shield, label: "Violations" },
  maintenance_failure: { icon: Wrench, label: "Maintenance" },
  lease_expiration: { icon: FileText, label: "Lease" },
  utility_problem: { icon: Gauge, label: "Utility" },
};

type SortField = "severity" | "createdAt" | "dueAt" | "lastTriggeredAt";

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function getEntityLink(signal: Signal): string {
  if (signal.tenantId) return `/collections`;
  if (signal.entityType === "building" && signal.buildingId) return `/compliance`;
  if (signal.entityType === "workorder") return `/maintenance`;
  if (signal.entityType === "violation" || signal.entityType === "complaint") return `/compliance`;
  if (signal.entityType === "meter") return `/utilities`;
  return "/";
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const chartTooltipStyle = {
  background: "linear-gradient(135deg, #141A24, #1A2232)",
  border: "1px solid #2A3441",
  borderRadius: 12,
  color: "#E8ECF1",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};

// ── Main Component ─────────────────────────────────────────────

export default function CoeusContent() {
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [filterBuilding, setFilterBuilding] = useState("");
  const [sortField, setSortField] = useState<SortField>("severity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [groupBy, setGroupBy] = useState<"severity" | "type" | "building">("severity");
  const [resolveModal, setResolveModal] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  const { data, isLoading } = useSignals({
    severity: filterSeverity || undefined,
    type: filterType || undefined,
    status: filterStatus,
    buildingId: filterBuilding || undefined,
  });
  const scan = useRunScan();
  const acknowledge = useAcknowledgeSignal();
  const resolve = useResolveSignal();
  const update = useUpdateSignal();
  const { data: buildings } = useBuildings();

  // Fetch all signals for analytics (unfiltered active)
  const { data: allData } = useSignals({ status: "active" });

  const signals = data?.signals || [];
  const counts = data?.counts || { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
  const lastScan = data?.lastScan;
  const allSignals = allData?.signals || [];

  // Sort signals
  const sorted = useMemo(() => {
    const arr = [...signals];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortField === "severity") {
        cmp = (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4);
      } else if (sortField === "createdAt") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === "dueAt") {
        const aDate = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
        const bDate = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
        cmp = aDate - bDate;
      } else if (sortField === "lastTriggeredAt") {
        cmp = new Date(a.lastTriggeredAt).getTime() - new Date(b.lastTriggeredAt).getTime();
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return arr;
  }, [signals, sortField, sortDir]);

  // Group
  const grouped = useMemo(() => groupSignals(sorted, groupBy, buildings), [sorted, groupBy, buildings]);

  // Analytics: by type
  const byType = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of allSignals) {
      m.set(s.type, (m.get(s.type) || 0) + 1);
    }
    return Object.entries(TYPE_CONFIG)
      .map(([k, v]) => ({ type: k, label: v.label, count: m.get(k) || 0 }))
      .filter((d) => d.count > 0);
  }, [allSignals]);

  // Analytics: overdue
  const overdueCount = useMemo(() => {
    const now = new Date();
    return allSignals.filter((s) => s.dueAt && new Date(s.dueAt) < now && s.status === "active").length;
  }, [allSignals]);

  // Export data
  const exportData = useMemo(() =>
    sorted.map((s) => ({
      severity: s.severity,
      type: TYPE_CONFIG[s.type]?.label || s.type,
      title: s.title,
      description: s.description,
      status: s.status,
      recommendedAction: s.recommendedAction || "",
      createdAt: s.createdAt,
      lastTriggeredAt: s.lastTriggeredAt,
      dueAt: s.dueAt || "",
    })),
    [sorted]
  );

  // Severity chart data
  const severityChartData = useMemo(() =>
    (["critical", "high", "medium", "low"] as const).map((sev) => ({
      name: SEVERITY_CONFIG[sev].label,
      count: allSignals.filter((s) => s.severity === sev).length,
      fill: SEVERITY_CONFIG[sev].chartColor,
    })),
    [allSignals]
  );

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function handleResolve(id: string) {
    setResolveModal(id);
    setResolveNote("");
  }

  function submitResolve() {
    if (!resolveModal) return;
    resolve.mutate({ id: resolveModal, resolutionNote: resolveNote || undefined });
    setResolveModal(null);
    setResolveNote("");
  }

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-accent" />
            <h1 className="text-2xl font-bold text-text-primary font-display tracking-wide">Coeus</h1>
          </div>
          <span className="text-[10px] text-text-dim tracking-[0.2em] uppercase ml-8">Coeus — Pattern Recognition Engine</span>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={exportData}
            filename="coeus-insights"
            columns={[
              { key: "severity", label: "Severity" },
              { key: "type", label: "Type" },
              { key: "title", label: "Title" },
              { key: "description", label: "Description" },
              { key: "status", label: "Status" },
              { key: "recommendedAction", label: "Recommended Action" },
              { key: "createdAt", label: "Created" },
              { key: "dueAt", label: "Due" },
            ]}
            pdfConfig={{
              title: "Coeus Intelligence Report",
              stats: [
                { label: "Critical", value: String(counts.critical) },
                { label: "High", value: String(counts.high) },
                { label: "Medium", value: String(counts.medium) },
                { label: "Total", value: String(counts.total) },
              ],
            }}
          />
          <TitanAction
            label={scan.isPending ? "Analyzing..." : "Run Analysis"}
            icon={RefreshCw}
            onClick={() => scan.mutate()}
            loading={scan.isPending}
            variant="gold"
            size="sm"
          />
        </div>
      </div>

      {/* Last Scan Bar */}
      {lastScan && (
        <div className="flex items-center gap-3 text-xs text-text-dim bg-atlas-navy-3 border border-border rounded-lg px-4 py-2">
          <Clock className="w-3.5 h-3.5" />
          <span>
            Last {lastScan.scanType} scan: {timeAgo(lastScan.startedAt)}
            {lastScan.durationMs != null && ` (${lastScan.durationMs}ms)`}
          </span>
          {lastScan.success ? (
            <span className="text-green-400">
              {lastScan.createdSignals} new, {lastScan.resolvedSignals} resolved
            </span>
          ) : (
            <span className="text-red-400">Failed: {lastScan.errorMessage}</span>
          )}
        </div>
      )}

      {/* Analytics Section */}
      {allSignals.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Severity Chart */}
          <div className="bg-atlas-navy-3 border border-border rounded-xl p-4">
            <h3 className="text-xs font-medium text-text-dim uppercase tracking-wider mb-3">By Severity</h3>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={severityChartData} layout="vertical" margin={{ left: 0, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fill: "#8899AA", fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [v, "Insights"]} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                  {severityChartData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* By Type */}
          <div className="bg-atlas-navy-3 border border-border rounded-xl p-4">
            <h3 className="text-xs font-medium text-text-dim uppercase tracking-wider mb-3">By Type</h3>
            <div className="space-y-1.5">
              {byType.map((d) => {
                const Icon = TYPE_CONFIG[d.type]?.icon || AlertTriangle;
                return (
                  <div key={d.type} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-text-dim" />
                      <span className="text-text-muted">{d.label}</span>
                    </div>
                    <span className="text-text-primary font-semibold">{d.count}</span>
                  </div>
                );
              })}
              {byType.length === 0 && <p className="text-xs text-text-dim">No active insights</p>}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="bg-atlas-navy-3 border border-border rounded-xl p-4">
            <h3 className="text-xs font-medium text-text-dim uppercase tracking-wider mb-3">Key Metrics</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <TrendingUp className="w-3.5 h-3.5 text-text-dim" />
                  Active Insights
                </div>
                <span className="text-text-primary font-semibold">{allSignals.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  Critical
                </div>
                <span className="text-red-400 font-semibold">{allSignals.filter((s) => s.severity === "critical").length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
                  Overdue
                </div>
                <span className={cn("font-semibold", overdueCount > 0 ? "text-amber-400" : "text-text-primary")}>{overdueCount}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Badges */}
      <div className="flex flex-wrap items-center gap-3">
        {(["critical", "high", "medium", "low"] as const).map((sev) => {
          const cfg = SEVERITY_CONFIG[sev];
          const count = counts[sev];
          return (
            <button
              key={sev}
              onClick={() => setFilterSeverity(filterSeverity === sev ? "" : sev)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors",
                filterSeverity === sev ? `${cfg.bg} ${cfg.color} ${cfg.border}` : "border-border text-text-muted hover:bg-card-hover"
              )}
            >
              <span className="w-2 h-2 rounded-full" style={count > 0 ? { backgroundColor: cfg.chartColor } : undefined} />
              <span className="font-semibold">{count}</span>
              <span>{cfg.label}</span>
            </button>
          );
        })}
        <span className="text-xs text-text-dim ml-auto">
          {counts.total} insight{counts.total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filters + Sort */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="active">Active</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
        <select
          value={filterBuilding}
          onChange={(e) => setFilterBuilding(e.target.value)}
          className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent min-w-[160px]"
        >
          <option value="">All Buildings</option>
          {(buildings || []).map((b) => (
            <option key={b.id} value={b.id}>{b.address}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-text-dim mr-1">Sort:</span>
          {(
            [
              { field: "severity" as const, label: "Severity" },
              { field: "lastTriggeredAt" as const, label: "Age" },
              { field: "createdAt" as const, label: "Created" },
              { field: "dueAt" as const, label: "Due" },
            ] as const
          ).map((s) => (
            <button
              key={s.field}
              onClick={() => handleSort(s.field)}
              className={cn(
                "text-xs px-2 py-1 rounded-md transition-colors flex items-center gap-1",
                sortField === s.field ? "bg-accent/10 text-accent" : "text-text-dim hover:text-text-muted"
              )}
            >
              {s.label}
              {sortField === s.field && <ArrowUpDown className="w-3 h-3" />}
            </button>
          ))}
        </div>
      </div>

      {/* Group by */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-text-dim mr-1">Group:</span>
        {(["severity", "type", "building"] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGroupBy(g)}
            className={cn(
              "text-xs px-2 py-1 rounded-md transition-colors",
              groupBy === g ? "bg-accent/10 text-accent" : "text-text-dim hover:text-text-muted"
            )}
          >
            {g.charAt(0).toUpperCase() + g.slice(1)}
          </button>
        ))}
      </div>

      {/* Insight Groups */}
      {sorted.length > 0 ? (
        <div className="space-y-4">
          {grouped.map((group) => (
            <InsightGroup
              key={group.label}
              label={group.label}
              signals={group.signals}
              onAcknowledge={(id) => acknowledge.mutate(id)}
              onResolve={handleResolve}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No insights"
          description={filterSeverity || filterType || filterBuilding ? "No insights match your filters." : "Run an analysis to detect operational issues across your portfolio."}
          icon={Radio}
        />
      )}

      {/* Resolve Modal */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setResolveModal(null)}>
          <div className="bg-atlas-navy-3 border border-border rounded-xl p-5 w-full max-w-md mx-4 space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-text-primary">Resolve Insight</h3>
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="Resolution note (optional)..."
              rows={3}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setResolveModal(null)}>Cancel</Button>
              <Button size="sm" onClick={submitResolve} disabled={resolve.isPending}>
                <CheckCircle className="w-3.5 h-3.5" />
                {resolve.isPending ? "Resolving..." : "Resolve"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────

interface GroupedSignals {
  label: string;
  signals: Signal[];
}

function groupSignals(signals: Signal[], groupBy: string, buildings?: any[]): GroupedSignals[] {
  const groups = new Map<string, Signal[]>();

  for (const s of signals) {
    let key: string;
    if (groupBy === "severity") {
      key = SEVERITY_CONFIG[s.severity]?.label || s.severity;
    } else if (groupBy === "type") {
      key = TYPE_CONFIG[s.type]?.label || s.type;
    } else {
      const building = buildings?.find((b) => b.id === s.buildingId);
      key = building?.address || "Other";
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  const entries = [...groups.entries()].map(([label, sigs]) => ({ label, signals: sigs }));

  if (groupBy === "severity") {
    const order = ["Critical", "High", "Medium", "Low"];
    entries.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  }

  return entries;
}

// ── Signal Group ────────────────────────────────────────────────

function InsightGroup({
  label,
  signals,
  onAcknowledge,
  onResolve,
}: {
  label: string;
  signals: Signal[];
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-card-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-text-primary">{label}</h3>
          <span className="text-xs text-text-dim">({signals.length})</span>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-text-dim" /> : <ChevronUp className="w-4 h-4 text-text-dim" />}
      </button>
      {!collapsed && (
        <div className="divide-y divide-border/50">
          {signals.map((s) => (
            <InsightCard key={s.id} signal={s} onAcknowledge={onAcknowledge} onResolve={onResolve} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Signal Card ─────────────────────────────────────────────────

function InsightCard({
  signal,
  onAcknowledge,
  onResolve,
}: {
  signal: Signal;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  const sev = SEVERITY_CONFIG[signal.severity] || SEVERITY_CONFIG.medium;
  const typeInfo = TYPE_CONFIG[signal.type] || { icon: AlertTriangle, label: signal.type };
  const TypeIcon = typeInfo.icon;
  const link = getEntityLink(signal);
  const isOverdue = signal.dueAt && new Date(signal.dueAt) < new Date() && signal.status === "active";
  const isOverdueCritical = isOverdue && signal.severity === "critical";

  return (
    <div className={cn(
      "flex items-start gap-3 px-4 py-3 hover:bg-card-hover transition-colors",
      isOverdueCritical && "border-l-2 border-l-red-500 bg-red-500/5"
    )}>
      <div className={cn("p-1.5 rounded-lg mt-0.5", sev.bg)}>
        <TypeIcon className={cn("w-3.5 h-3.5", sev.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase", sev.bg, sev.color)}>
            {signal.severity}
          </span>
          <span className="text-[10px] text-text-dim uppercase">{typeInfo.label}</span>
          {isOverdue && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-red-500/20 text-red-400 uppercase">Overdue</span>
          )}
          {signal.assignedToUserId && (
            <span className="text-[10px] text-text-dim flex items-center gap-1">
              <UserCheck className="w-3 h-3" /> Assigned
            </span>
          )}
          <span className="text-[10px] text-text-dim ml-auto">{timeAgo(signal.lastTriggeredAt)}</span>
        </div>
        <p className="text-sm text-text-primary font-medium">{signal.title}</p>
        <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{signal.description}</p>
        {signal.recommendedAction && (
          <p className="text-xs text-accent mt-1 flex items-center gap-1">
            <BarChart3 className="w-3 h-3 shrink-0" />
            {signal.recommendedAction}
          </p>
        )}
        {signal.resolutionNote && (
          <p className="text-xs text-green-400 mt-1">Resolution: {signal.resolutionNote}</p>
        )}
        {signal.dueAt && (
          <p className={cn("text-[10px] mt-1", isOverdue ? "text-red-400" : "text-text-dim")}>
            Due: {formatDate(signal.dueAt)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 mt-1">
        {signal.status === "active" && (
          <button
            onClick={(e) => { e.stopPropagation(); onAcknowledge(signal.id); }}
            className="p-1 text-text-dim hover:text-blue-400 transition-colors"
            title="Acknowledge"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
        {signal.status !== "resolved" && (
          <button
            onClick={(e) => { e.stopPropagation(); onResolve(signal.id); }}
            className="p-1 text-text-dim hover:text-green-400 transition-colors"
            title="Resolve"
          >
            <CheckCircle className="w-3.5 h-3.5" />
          </button>
        )}
        <a
          href={link}
          className="p-1 text-text-dim hover:text-accent transition-colors"
          title="View"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
