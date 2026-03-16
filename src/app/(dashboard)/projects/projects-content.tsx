"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { useProjects } from "@/hooks/use-projects";
import { useBuildings } from "@/hooks/use-buildings";
import KpiCard from "@/components/ui/kpi-card";
import { TablePageSkeleton } from "@/components/ui/skeleton";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import CreateProjectModal from "@/components/projects/create-project-modal";
import { formatDate, fmt$ } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-gray-500/20 text-gray-400",
  ESTIMATING: "bg-blue-500/20 text-blue-400",
  PENDING_APPROVAL: "bg-yellow-500/20 text-yellow-400",
  APPROVED: "bg-teal-500/20 text-teal-400",
  IN_PROGRESS: "bg-blue-500/20 text-blue-400",
  PAUSED: "bg-orange-500/20 text-orange-400",
  SUBSTANTIALLY_COMPLETE: "bg-purple-500/20 text-purple-400",
  COMPLETED: "bg-green-500/20 text-green-400",
  CLOSED: "bg-gray-500/20 text-gray-400",
  CANCELLED: "bg-red-500/20 text-red-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-400",
  HIGH: "bg-orange-500/20 text-orange-400",
  MEDIUM: "bg-blue-500/20 text-blue-400",
  LOW: "bg-gray-500/20 text-gray-400",
};

const HEALTH_CONFIG: Record<string, { color: string; dot: string }> = {
  ON_TRACK: { color: "text-green-400", dot: "bg-green-400" },
  AT_RISK: { color: "text-orange-400", dot: "bg-orange-400" },
  DELAYED: { color: "text-red-400", dot: "bg-red-400" },
  OVER_BUDGET: { color: "text-red-400", dot: "bg-red-400" },
  BLOCKED: { color: "text-red-400", dot: "bg-red-400" },
};

const STATUSES = ["PLANNED", "ESTIMATING", "PENDING_APPROVAL", "APPROVED", "IN_PROGRESS", "PAUSED", "SUBSTANTIALLY_COMPLETE", "COMPLETED", "CLOSED", "CANCELLED"];
const CATEGORIES = ["TURNOVER", "CAPITAL_IMPROVEMENT", "VIOLATION_REMEDIATION", "LOCAL_LAW", "FACADE", "ROOF", "BOILER", "PLUMBING", "ELECTRICAL", "APARTMENT_RENO", "COMMON_AREA", "EMERGENCY", "OTHER"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const HEALTHS = ["ON_TRACK", "AT_RISK", "DELAYED", "OVER_BUDGET", "BLOCKED"];

function label(s: string) {
  return s.replace(/_/g, " ");
}

export default function ProjectsContent() {
  const { data: projects, isLoading } = useProjects();
  const { data: buildings } = useBuildings();
  const [showCreate, setShowCreate] = useState(false);
  const [filterBuilding, setFilterBuilding] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterHealth, setFilterHealth] = useState("all");

  const stats = useMemo(() => {
    const ps = projects || [];
    return {
      total: ps.length,
      inProgress: ps.filter((p: any) => p.status === "IN_PROGRESS").length,
      atRisk: ps.filter((p: any) => ["AT_RISK", "DELAYED"].includes(p.health)).length,
      overBudget: ps.filter((p: any) => p.health === "OVER_BUDGET").length,
    };
  }, [projects]);

  const filtered = useMemo(() => {
    let ps = projects || [];
    if (filterBuilding !== "all") ps = ps.filter((p: any) => p.buildingId === filterBuilding);
    if (filterStatus !== "all") ps = ps.filter((p: any) => p.status === filterStatus);
    if (filterCategory !== "all") ps = ps.filter((p: any) => p.category === filterCategory);
    if (filterPriority !== "all") ps = ps.filter((p: any) => p.priority === filterPriority);
    if (filterHealth !== "all") ps = ps.filter((p: any) => p.health === filterHealth);
    return ps;
  }, [projects, filterBuilding, filterStatus, filterCategory, filterPriority, filterHealth]);

  if (isLoading) return <TablePageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-display tracking-wide">Projects</h1>
          <span className="text-[10px] text-text-dim tracking-[0.2em] uppercase hidden sm:inline">// Building Project Command Center</span>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#c9a84c] text-[#060c17] hover:bg-[#d4b95e]">
          <Plus className="w-4 h-4" /> New Project
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Projects" value={stats.total} icon={FolderKanban} />
        <KpiCard label="In Progress" value={stats.inProgress} color="#3B82F6" />
        <KpiCard label="At Risk / Delayed" value={stats.atRisk} color="#F59E0B" />
        <KpiCard label="Over Budget" value={stats.overBudget} color="#EF4444" />
      </div>

      <div className="flex gap-3 flex-wrap">
        <select value={filterBuilding} onChange={(e) => setFilterBuilding(e.target.value)} className="bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="all">All Buildings</option>
          {buildings?.map((b: any) => <option key={b.id} value={b.id}>{b.address}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="all">All Status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="all">All Priority</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterHealth} onChange={(e) => setFilterHealth(e.target.value)} className="bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="all">All Health</option>
          {HEALTHS.map((h) => <option key={h} value={h}>{label(h)}</option>)}
        </select>
      </div>

      <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Code</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Building</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Category</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Status</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Priority</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Health</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Budget</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Actual</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">% Done</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Target</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p: any) => {
              const isOverdue = p.targetEndDate && new Date(p.targetEndDate) < new Date() && !["COMPLETED", "CLOSED", "CANCELLED"].includes(p.status);
              const hc = HEALTH_CONFIG[p.health] || HEALTH_CONFIG.ON_TRACK;
              return (
                <tr key={p.id} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                  <td className="px-3 py-2 text-xs text-text-dim font-mono">{p.code || "—"}</td>
                  <td className="px-3 py-2">
                    <Link href={`/projects/${p.id}`} className="text-text-primary hover:text-accent transition-colors">{p.name}</Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-text-muted">{p.buildingAddress}</td>
                  <td className="px-3 py-2"><span className="text-xs text-text-muted">{label(p.category)}</span></td>
                  <td className="px-3 py-2"><span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium uppercase", STATUS_COLORS[p.status])}>{label(p.status)}</span></td>
                  <td className="px-3 py-2"><span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", PRIORITY_COLORS[p.priority])}>{p.priority}</span></td>
                  <td className="px-3 py-2">
                    <span className={cn("flex items-center gap-1.5 text-xs", hc.color)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", hc.dot)} />
                      {label(p.health)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-text-muted tabular-nums">{p.approvedBudget ? fmt$(p.approvedBudget) : "—"}</td>
                  <td className="px-3 py-2 text-right text-xs text-text-muted tabular-nums">{p.actualCost ? fmt$(p.actualCost) : "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-atlas-navy-1 rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${p.percentComplete}%` }} />
                      </div>
                      <span className="text-[10px] text-text-dim w-7 text-right">{p.percentComplete}%</span>
                    </div>
                  </td>
                  <td className={cn("px-3 py-2 text-xs tabular-nums", isOverdue ? "text-red-400" : "text-text-dim")}>{p.targetEndDate ? formatDate(p.targetEndDate) : "—"}</td>
                  <td className="px-3 py-2">
                    <Link href={`/projects/${p.id}`}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={12}><EmptyState icon={FolderKanban} title="No projects found" description="Create a project to start tracking building work." /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
