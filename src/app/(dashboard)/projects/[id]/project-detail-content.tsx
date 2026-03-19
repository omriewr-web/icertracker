"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle, Plus, Link2, Eye, EyeOff,
  Loader, Circle, AlertTriangle, Pause, X,
  DollarSign, Shield, Calendar, Zap, ChevronDown, ChevronUp,
  Clock, Target, TrendingUp, TrendingDown, Wrench, AlertOctagon,
} from "lucide-react";
import { useProject, useUpdateProject, useLinkWorkOrder, useLinkViolation } from "@/hooks/use-projects";
import Button from "@/components/ui/button";
import { TablePageSkeleton } from "@/components/ui/skeleton";
import { formatDate, fmt$ } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toNumber } from "@/lib/utils/decimal";
import toast from "react-hot-toast";
import type { ProjectStats } from "@/lib/project-health";

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-gray-500/20 text-gray-400", ESTIMATING: "bg-blue-500/20 text-blue-400",
  PENDING_APPROVAL: "bg-yellow-500/20 text-yellow-400", APPROVED: "bg-teal-500/20 text-teal-400",
  IN_PROGRESS: "bg-blue-500/20 text-blue-400", PAUSED: "bg-orange-500/20 text-orange-400",
  SUBSTANTIALLY_COMPLETE: "bg-purple-500/20 text-purple-400", COMPLETED: "bg-green-500/20 text-green-400",
  CLOSED: "bg-gray-500/20 text-gray-400", CANCELLED: "bg-red-500/20 text-red-400",
};
const PRIORITY_COLORS: Record<string, string> = { CRITICAL: "bg-red-500/20 text-red-400", HIGH: "bg-orange-500/20 text-orange-400", MEDIUM: "bg-blue-500/20 text-blue-400", LOW: "bg-gray-500/20 text-gray-400" };

const HEALTH_HEX: Record<string, string> = {
  ON_TRACK: "#22c55e", AT_RISK: "#f59e0b", DELAYED: "#ef4444", OVER_BUDGET: "#ef4444", BLOCKED: "#7c3aed",
};

const PHASE_PIPELINE = ["PLANNED", "ESTIMATING", "PENDING_APPROVAL", "APPROVED", "IN_PROGRESS", "SUBSTANTIALLY_COMPLETE", "COMPLETED"] as const;

function label(s: string) { return s.replace(/_/g, " "); }

function MilestoneIcon({ status, className }: { status: string; className?: string }) {
  switch (status) {
    case "COMPLETED": return <CheckCircle className={cn("w-4 h-4 text-green-400", className)} />;
    case "IN_PROGRESS": return <Loader className={cn("w-4 h-4 text-blue-400", className)} />;
    case "BLOCKED": return <AlertTriangle className={cn("w-4 h-4 text-red-400", className)} />;
    default: return <Circle className={cn("w-4 h-4 text-gray-400", className)} />;
  }
}

export default function ProjectDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: project, isLoading, refetch } = useProject(id);
  const updateProject = useUpdateProject();
  const linkWO = useLinkWorkOrder();
  const linkViolation = useLinkViolation();

  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [milestoneName, setMilestoneName] = useState("");
  const [milestoneDue, setMilestoneDue] = useState("");
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState("");
  const [budgetDesc, setBudgetDesc] = useState("");
  const [budgetEstimated, setBudgetEstimated] = useState("");
  const [showCOForm, setShowCOForm] = useState(false);
  const [coTitle, setCOTitle] = useState("");
  const [coAmount, setCOAmount] = useState("");
  const [showLinkWO, setShowLinkWO] = useState(false);
  const [linkWOId, setLinkWOId] = useState("");
  const [showLinkViol, setShowLinkViol] = useState(false);
  const [linkViolId, setLinkViolId] = useState("");
  const [descExpanded, setDescExpanded] = useState(false);

  if (isLoading) return <TablePageSkeleton />;
  if (!project) return <div className="p-8 text-text-dim">Project not found</div>;

  const p = project;
  const stats: ProjectStats = p.stats ?? { health: "ON_TRACK", isOverdue: false, daysElapsed: null, daysRemaining: null, nextAction: null, budgetUsedPct: 0, milestoneProgress: "0 / 0" };
  const healthColor = HEALTH_HEX[stats.health] || HEALTH_HEX.ON_TRACK;

  // Phase pipeline logic
  const currentPhaseIndex = (() => {
    if (p.status === "CANCELLED") return -1;
    if (p.status === "CLOSED") return PHASE_PIPELINE.length - 1;
    if (p.status === "PAUSED") {
      // Map paused to the last active phase
      const idx = PHASE_PIPELINE.indexOf(p.previousStatus || "IN_PROGRESS");
      return idx >= 0 ? idx : PHASE_PIPELINE.indexOf("IN_PROGRESS");
    }
    const idx = PHASE_PIPELINE.indexOf(p.status);
    return idx >= 0 ? idx : 0;
  })();
  const isPaused = p.status === "PAUSED";
  const isCancelled = p.status === "CANCELLED";

  // Handlers
  async function handleMilestoneCreate() {
    if (!milestoneName) return;
    await fetch(`/api/projects/${id}/milestones`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: milestoneName, dueDate: milestoneDue || null }) });
    setMilestoneName(""); setMilestoneDue(""); setShowMilestoneForm(false);
    toast.success("Milestone added"); refetch();
  }

  async function handleMilestoneStatusChange(milestoneId: string, status: string) {
    await fetch(`/api/projects/${id}/milestones/${milestoneId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    toast.success("Milestone updated"); refetch();
  }

  async function handleBudgetCreate() {
    if (!budgetCategory || !budgetEstimated) return;
    await fetch(`/api/projects/${id}/budget-lines`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: budgetCategory, description: budgetDesc || null, estimated: parseFloat(budgetEstimated) }) });
    setBudgetCategory(""); setBudgetDesc(""); setBudgetEstimated(""); setShowBudgetForm(false);
    toast.success("Budget line added"); refetch();
  }

  async function handleCOCreate() {
    if (!coTitle || !coAmount) return;
    await fetch(`/api/projects/${id}/change-orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: coTitle, amount: parseFloat(coAmount) }) });
    setCOTitle(""); setCOAmount(""); setShowCOForm(false);
    toast.success("Change order created"); refetch();
  }

  function handleApprove() {
    fetch(`/api/projects/${id}/approve`, { method: "POST" }).then(() => { toast.success("Project approved"); refetch(); });
  }

  function handleMarkComplete() {
    updateProject.mutate({ id, data: { status: "COMPLETED", actualEndDate: new Date().toISOString() } }, { onSuccess: () => refetch() });
  }

  const descriptionText = p.description || "";
  const descTruncated = descriptionText.length > 200 && !descExpanded;
  const displayDesc = descTruncated ? descriptionText.slice(0, 200) + "..." : descriptionText;

  const budgetBase = stats.totalApprovedBudget || stats.totalEstimatedBudget;
  const budgetUsedPct = budgetBase > 0 ? Math.min(Math.round(stats.totalActualCost / budgetBase * 100), 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* === HEADER === */}
      <div>
        <Link href="/projects" className="flex items-center gap-1 text-xs text-text-dim hover:text-accent mb-2">
          <ArrowLeft className="w-3 h-3" /> Back to Projects
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-text-primary font-display tracking-wide">{p.name}</h1>
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium uppercase", STATUS_COLORS[p.status])}>{label(p.status)}</span>
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", PRIORITY_COLORS[p.priority])}>{p.priority}</span>
              <span className="flex items-center gap-1 text-xs font-medium" style={{ color: healthColor }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: healthColor }} />
                {label(stats.health)}
              </span>
            </div>
            <p className="text-xs text-text-dim mt-1">{p.building?.address || ""} — {label(p.category)}{p.code ? ` — ${p.code}` : ""}</p>
            {descriptionText && (
              <div className="mt-2 max-w-2xl">
                <p className="text-sm text-text-muted whitespace-pre-wrap">{displayDesc}</p>
                {descriptionText.length > 200 && (
                  <button onClick={() => setDescExpanded(!descExpanded)} className="text-xs text-accent hover:underline mt-0.5 flex items-center gap-0.5">
                    {descExpanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show more</>}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => updateProject.mutate({ id, data: { ownerVisible: !p.ownerVisible } }, { onSuccess: () => refetch() })}
              className={cn("flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full uppercase font-medium transition-colors cursor-pointer", p.ownerVisible ? "bg-[#c9a84c]/20 text-[#c9a84c]" : "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30")}
            >
              {p.ownerVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              {p.ownerVisible ? "Owner Visible" : "Hidden"}
            </button>
            {p.status === "PENDING_APPROVAL" && <Button onClick={handleApprove} className="bg-[#c9a84c] text-[#060c17] hover:bg-[#d4b95e]"><CheckCircle className="w-4 h-4" /> Approve</Button>}
            {!["COMPLETED", "CLOSED", "CANCELLED"].includes(p.status) && <Button variant="outline" onClick={handleMarkComplete}>Mark Complete</Button>}
          </div>
        </div>

        {/* Next Action Banner */}
        <div className="mt-3 px-4 py-2.5 rounded-lg border flex items-center gap-2" style={{ backgroundColor: `${healthColor}10`, borderColor: `${healthColor}30` }}>
          <Zap className="w-4 h-4 shrink-0" style={{ color: healthColor }} />
          <span className="text-sm font-medium" style={{ color: healthColor }}>{stats.nextAction}</span>
        </div>
      </div>

      {/* === 2-COLUMN LAYOUT === */}
      <div className="lg:flex lg:gap-6">
        {/* LEFT COLUMN */}
        <div className="lg:w-[65%] space-y-6">
          {/* Phase Pipeline */}
          <div className="bg-atlas-navy-3 border border-border rounded-xl p-4">
            <p className="text-[10px] text-text-dim uppercase tracking-[0.15em] font-medium mb-3">Phase Pipeline</p>
            <div className="flex items-center gap-1">
              {PHASE_PIPELINE.map((phase, i) => {
                const isActive = i === currentPhaseIndex;
                const isCompleted = i < currentPhaseIndex;
                const dimmed = isCancelled;
                return (
                  <div key={phase} className="flex items-center flex-1 min-w-0">
                    <div className={cn(
                      "flex-1 relative rounded-md px-2 py-1.5 text-center text-[9px] font-medium uppercase tracking-wider transition-all truncate",
                      dimmed && "opacity-30",
                      isCompleted && !dimmed && "bg-[#22c55e]/20 text-[#22c55e]",
                      isActive && !dimmed && isPaused && "bg-orange-500/20 text-orange-400 ring-1 ring-orange-400/50",
                      isActive && !dimmed && !isPaused && "bg-[#c9a84c]/20 text-[#c9a84c] ring-1 ring-[#c9a84c]/50",
                      !isActive && !isCompleted && !dimmed && "bg-atlas-navy-1/50 text-text-dim",
                    )}>
                      {isActive && isPaused && <Pause className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
                      {isCompleted && <CheckCircle className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
                      <span className="hidden sm:inline">{label(phase)}</span>
                      <span className="sm:hidden">{i + 1}</span>
                    </div>
                    {i < PHASE_PIPELINE.length - 1 && (
                      <div className={cn("w-2 h-0.5 shrink-0", isCompleted && !dimmed ? "bg-[#22c55e]/50" : "bg-border")} />
                    )}
                  </div>
                );
              })}
            </div>
            {isCancelled && <p className="text-xs text-red-400 mt-2 flex items-center gap-1"><X className="w-3 h-3" /> Project cancelled</p>}
          </div>

          {/* Milestones */}
          <div className="bg-atlas-navy-3 border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <p className="text-[10px] text-text-dim uppercase tracking-[0.15em] font-medium">Milestones</p>
                <span className="text-xs text-text-muted">{stats.completedMilestones}/{stats.totalMilestones} completed</span>
              </div>
              {!showMilestoneForm && (
                <button onClick={() => setShowMilestoneForm(true)} className="text-xs text-accent hover:text-accent/80 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>

            {stats.totalMilestones > 0 && (
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-2 bg-atlas-navy-1 rounded-full overflow-hidden">
                  <div className="h-full bg-[#c9a84c] rounded-full transition-all" style={{ width: `${stats.percentComplete}%` }} />
                </div>
                <span className="text-sm font-bold font-data tabular-nums text-text-primary">{stats.percentComplete}%</span>
              </div>
            )}

            <div className="divide-y divide-border/50">
              {p.milestones?.map((m: any) => {
                const isOverdue = m.status !== "COMPLETED" && m.dueDate && new Date(m.dueDate) < new Date();
                return (
                  <div key={m.id} className="flex items-center gap-3 py-2.5 group">
                    <MilestoneIcon status={m.status} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm text-text-primary truncate", m.status === "COMPLETED" && "line-through opacity-60")}>{m.name}</p>
                      {m.dueDate && (
                        <p className={cn("text-[10px]", isOverdue ? "text-red-400" : "text-text-dim")}>
                          Due {formatDate(m.dueDate)}{isOverdue ? " (overdue)" : ""}
                        </p>
                      )}
                    </div>
                    <select
                      value={m.status}
                      onChange={(e) => handleMilestoneStatusChange(m.id, e.target.value)}
                      className="bg-bg border border-border rounded px-2 py-1 text-[10px] text-text-primary focus:outline-none focus:border-accent opacity-60 group-hover:opacity-100 transition-opacity"
                    >
                      {["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
                    </select>
                  </div>
                );
              })}
              {(!p.milestones || p.milestones.length === 0) && (
                <div className="py-6 text-center text-text-dim text-sm">No milestones yet. Add milestones to track progress.</div>
              )}
            </div>

            {showMilestoneForm && (
              <div className="flex items-end gap-3 mt-3 pt-3 border-t border-border/50">
                <div className="flex-1"><label className="block text-xs text-text-dim mb-1">Name</label><input value={milestoneName} onChange={(e) => setMilestoneName(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" /></div>
                <div><label className="block text-xs text-text-dim mb-1">Due Date</label><input type="date" value={milestoneDue} onChange={(e) => setMilestoneDue(e.target.value)} className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" /></div>
                <Button onClick={handleMilestoneCreate} disabled={!milestoneName}>Add</Button>
                <Button variant="outline" onClick={() => setShowMilestoneForm(false)}>Cancel</Button>
              </div>
            )}
          </div>

          {/* Linked Items: WOs + Violations side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Work Orders */}
            <div className="bg-atlas-navy-3 border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-text-dim uppercase tracking-[0.15em] font-medium flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" /> Work Orders ({p.workOrders?.length || 0})
                </p>
                {!showLinkWO && (
                  <button onClick={() => setShowLinkWO(true)} className="text-xs text-accent hover:text-accent/80 flex items-center gap-1">
                    <Link2 className="w-3 h-3" /> Link
                  </button>
                )}
              </div>
              <div className="divide-y divide-border/50">
                {p.workOrders?.map((wo: any) => (
                  <div key={wo.workOrderId} className="py-2 flex items-center justify-between">
                    <span className="text-xs text-text-primary font-mono">{wo.workOrderId}</span>
                    <span className="text-[10px] text-text-dim">{formatDate(wo.linkedAt)}</span>
                  </div>
                ))}
                {(!p.workOrders || p.workOrders.length === 0) && (
                  <div className="py-4 text-center text-text-dim text-xs">No linked work orders</div>
                )}
              </div>
              {showLinkWO && (
                <div className="flex items-end gap-2 mt-3 pt-3 border-t border-border/50">
                  <div className="flex-1"><input value={linkWOId} onChange={(e) => setLinkWOId(e.target.value)} placeholder="Work Order ID" className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent" /></div>
                  <Button size="sm" onClick={() => { linkWO.mutate({ projectId: id, workOrderId: linkWOId }, { onSuccess: () => { setLinkWOId(""); setShowLinkWO(false); refetch(); } }); }} disabled={!linkWOId || linkWO.isPending}>Link</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowLinkWO(false)}>Cancel</Button>
                </div>
              )}
            </div>

            {/* Violations */}
            <div className="bg-atlas-navy-3 border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-text-dim uppercase tracking-[0.15em] font-medium flex items-center gap-1.5">
                  <AlertOctagon className="w-3.5 h-3.5" /> Violations ({p.violations?.length || 0})
                </p>
                {!showLinkViol && (
                  <button onClick={() => setShowLinkViol(true)} className="text-xs text-accent hover:text-accent/80 flex items-center gap-1">
                    <Link2 className="w-3 h-3" /> Link
                  </button>
                )}
              </div>
              <div className="divide-y divide-border/50">
                {p.violations?.map((v: any) => (
                  <div key={v.violationId} className="py-2 flex items-center justify-between">
                    <span className="text-xs text-text-primary font-mono">{v.violationId}</span>
                    <span className="text-[10px] text-text-dim">{formatDate(v.linkedAt)}</span>
                  </div>
                ))}
                {(!p.violations || p.violations.length === 0) && (
                  <div className="py-4 text-center text-text-dim text-xs">No linked violations</div>
                )}
              </div>
              {showLinkViol && (
                <div className="flex items-end gap-2 mt-3 pt-3 border-t border-border/50">
                  <div className="flex-1"><input value={linkViolId} onChange={(e) => setLinkViolId(e.target.value)} placeholder="Violation ID" className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent" /></div>
                  <Button size="sm" onClick={() => { linkViolation.mutate({ projectId: id, violationId: linkViolId }, { onSuccess: () => { setLinkViolId(""); setShowLinkViol(false); refetch(); } }); }} disabled={!linkViolId || linkViolation.isPending}>Link</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowLinkViol(false)}>Cancel</Button>
                </div>
              )}
            </div>
          </div>

          {/* Activity Feed (last 10) */}
          <div className="bg-atlas-navy-3 border border-border rounded-xl p-4">
            <p className="text-[10px] text-text-dim uppercase tracking-[0.15em] font-medium mb-3">Recent Activity</p>
            <div className="divide-y divide-border/50">
              {p.activity?.slice(0, 10).map((a: any) => (
                <div key={a.id} className="py-2.5 flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] mt-1.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary"><span className="font-medium">{label(a.action)}</span>{a.detail ? ` — ${a.detail}` : ""}</p>
                    <p className="text-[10px] text-text-dim mt-0.5">{formatDate(a.createdAt)}</p>
                  </div>
                </div>
              ))}
              {(!p.activity || p.activity.length === 0) && <div className="py-6 text-center text-text-dim text-sm">No activity yet</div>}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — Sticky Sidebar */}
        <div className="lg:w-[35%] mt-6 lg:mt-0">
          <div className="lg:sticky lg:top-24 space-y-4">
            {/* Budget Intelligence */}
            <div className="bg-atlas-navy-3 border border-border rounded-xl p-4">
              <p className="text-[10px] text-text-dim uppercase tracking-[0.15em] font-medium flex items-center gap-1.5 mb-3">
                <DollarSign className="w-3.5 h-3.5" /> Budget Intelligence
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-text-dim">Estimated</p>
                    <p className="text-sm font-bold font-data tabular-nums text-text-primary">{stats.totalEstimatedBudget ? fmt$(stats.totalEstimatedBudget) : "---"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-dim">Approved</p>
                    <p className="text-sm font-bold font-data tabular-nums text-text-primary">{stats.totalApprovedBudget ? fmt$(stats.totalApprovedBudget) : "---"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-dim">Actual Cost</p>
                    <p className="text-sm font-bold font-data tabular-nums text-text-primary">{stats.totalActualCost ? fmt$(stats.totalActualCost) : "---"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-dim">Variance</p>
                    <p className={cn("text-sm font-bold font-data tabular-nums flex items-center gap-1", stats.variance >= 0 ? "text-green-400" : "text-red-400")}>
                      {stats.variance >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {budgetBase ? fmt$(Math.abs(stats.variance)) : "---"}
                      {budgetBase > 0 && <span className="text-[10px] font-normal">({stats.variancePct}%)</span>}
                    </p>
                  </div>
                </div>

                {/* Budget usage bar */}
                {budgetBase > 0 && (
                  <div>
                    <div className="flex justify-between text-[10px] text-text-dim mb-1">
                      <span>Budget Used</span>
                      <span>{budgetUsedPct}%</span>
                    </div>
                    <div className="h-2.5 bg-atlas-navy-1 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${budgetUsedPct}%`, backgroundColor: budgetUsedPct > 100 ? "#ef4444" : "#c9a84c" }}
                      />
                    </div>
                  </div>
                )}

                {/* Budget Lines */}
                {p.budgetLines && p.budgetLines.length > 0 && (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-[10px] text-text-dim uppercase mb-2">Line Items</p>
                    {p.budgetLines.map((bl: any) => {
                      const est = toNumber(bl.estimated);
                      const act = toNumber(bl.actual);
                      return (
                        <div key={bl.id} className="flex items-center justify-between py-1">
                          <span className="text-xs text-text-muted truncate flex-1">{bl.category}</span>
                          <div className="text-right">
                            <span className="text-xs text-text-muted tabular-nums">{fmt$(est)}</span>
                            {act > 0 && <span className="text-[10px] text-text-dim ml-1">/ {fmt$(act)}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {showBudgetForm ? (
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <div><label className="block text-xs text-text-dim mb-1">Category</label><input value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" placeholder="e.g. Labor" /></div>
                    <div><label className="block text-xs text-text-dim mb-1">Description</label><input value={budgetDesc} onChange={(e) => setBudgetDesc(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" /></div>
                    <div><label className="block text-xs text-text-dim mb-1">Estimated $</label><input type="number" value={budgetEstimated} onChange={(e) => setBudgetEstimated(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" /></div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleBudgetCreate} disabled={!budgetCategory || !budgetEstimated}>Add</Button>
                      <Button variant="outline" size="sm" onClick={() => setShowBudgetForm(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowBudgetForm(true)} className="text-xs text-accent hover:text-accent/80 flex items-center gap-1 pt-1">
                    <Plus className="w-3 h-3" /> Add Budget Line
                  </button>
                )}

                {/* Change Orders */}
                {p.changeOrders && p.changeOrders.length > 0 && (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-[10px] text-text-dim uppercase mb-2">Change Orders</p>
                    {p.changeOrders.map((co: any) => (
                      <div key={co.id} className="flex items-center justify-between py-1">
                        <span className="text-xs text-text-muted truncate flex-1">{co.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs tabular-nums text-text-muted">{fmt$(toNumber(co.amount))}</span>
                          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase", co.status === "APPROVED" ? "bg-green-500/20 text-green-400" : co.status === "REJECTED" ? "bg-red-500/20 text-red-400" : "bg-gray-500/20 text-gray-400")}>{co.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {showCOForm ? (
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <div><label className="block text-xs text-text-dim mb-1">Title</label><input value={coTitle} onChange={(e) => setCOTitle(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" /></div>
                    <div><label className="block text-xs text-text-dim mb-1">Amount $</label><input type="number" value={coAmount} onChange={(e) => setCOAmount(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" /></div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleCOCreate} disabled={!coTitle || !coAmount}>Add</Button>
                      <Button variant="outline" size="sm" onClick={() => setShowCOForm(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowCOForm(true)} className="text-xs text-accent hover:text-accent/80 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Change Order
                  </button>
                )}
              </div>
            </div>

            {/* Health Scorecard */}
            <div className="bg-atlas-navy-3 border border-border rounded-xl p-4">
              <p className="text-[10px] text-text-dim uppercase tracking-[0.15em] font-medium flex items-center gap-1.5 mb-3">
                <Shield className="w-3.5 h-3.5" /> Health Scorecard
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Overall Health</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${healthColor}20`, color: healthColor }}>{label(stats.health)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Completion</span>
                  <span className="text-xs font-bold font-data tabular-nums text-text-primary">{stats.percentComplete}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Milestones</span>
                  <span className="text-xs text-text-primary">{stats.completedMilestones}/{stats.totalMilestones}</span>
                </div>
                {stats.blockedMilestones > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">Blocked</span>
                    <span className="text-xs font-bold text-[#7c3aed]">{stats.blockedMilestones}</span>
                  </div>
                )}
                {stats.overdueMilestones > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">Overdue Milestones</span>
                    <span className="text-xs font-bold text-red-400">{stats.overdueMilestones}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Budget Variance</span>
                  <span className={cn("text-xs font-bold font-data tabular-nums", stats.variance >= 0 ? "text-green-400" : "text-red-400")}>
                    {budgetBase ? `${stats.variancePct}%` : "---"}
                  </span>
                </div>
                {stats.isOverdue && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">Schedule</span>
                    <span className="text-xs font-bold text-red-400">Overdue</span>
                  </div>
                )}
              </div>
            </div>

            {/* Key Dates */}
            <div className="bg-atlas-navy-3 border border-border rounded-xl p-4">
              <p className="text-[10px] text-text-dim uppercase tracking-[0.15em] font-medium flex items-center gap-1.5 mb-3">
                <Calendar className="w-3.5 h-3.5" /> Key Dates
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Start Date</span>
                  <span className="text-xs text-text-primary">{formatDate(p.startDate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Target End</span>
                  <span className={cn("text-xs", stats.isOverdue ? "text-red-400 font-bold" : "text-text-primary")}>{formatDate(p.targetEndDate)}</span>
                </div>
                {p.actualEndDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">Actual End</span>
                    <span className="text-xs text-text-primary">{formatDate(p.actualEndDate)}</span>
                  </div>
                )}
                {stats.daysElapsed !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">Days Elapsed</span>
                    <span className="text-xs font-data tabular-nums text-text-primary">{stats.daysElapsed}</span>
                  </div>
                )}
                {stats.daysRemaining !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">{stats.daysRemaining < 0 ? "Days Overdue" : "Days Remaining"}</span>
                    <span className={cn("text-xs font-bold font-data tabular-nums", stats.daysRemaining < 0 ? "text-red-400" : "text-text-primary")}>{Math.abs(stats.daysRemaining)}</span>
                  </div>
                )}
                {p.approvedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">Approved</span>
                    <span className="text-xs text-green-400">{formatDate(p.approvedAt)}</span>
                  </div>
                )}
                {p.requiresApproval && !p.approvedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">Approval</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 uppercase font-medium">Required</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-atlas-navy-3 border border-border rounded-xl p-4">
              <p className="text-[10px] text-text-dim uppercase tracking-[0.15em] font-medium flex items-center gap-1.5 mb-3">
                <Zap className="w-3.5 h-3.5" /> Quick Actions
              </p>
              <div className="space-y-2">
                {p.status === "PENDING_APPROVAL" && (
                  <Button onClick={handleApprove} className="w-full bg-[#c9a84c] text-[#060c17] hover:bg-[#d4b95e]" size="sm">
                    <CheckCircle className="w-3.5 h-3.5" /> Approve Project
                  </Button>
                )}
                {!["COMPLETED", "CLOSED", "CANCELLED"].includes(p.status) && (
                  <>
                    <Button variant="outline" size="sm" className="w-full" onClick={handleMarkComplete}>
                      <CheckCircle className="w-3.5 h-3.5" /> Mark Complete
                    </Button>
                    {p.status !== "PAUSED" && (
                      <Button variant="outline" size="sm" className="w-full" onClick={() => updateProject.mutate({ id, data: { status: "PAUSED" } }, { onSuccess: () => refetch() })}>
                        <Pause className="w-3.5 h-3.5" /> Pause Project
                      </Button>
                    )}
                    {p.status === "PAUSED" && (
                      <Button variant="outline" size="sm" className="w-full" onClick={() => updateProject.mutate({ id, data: { status: "IN_PROGRESS" } }, { onSuccess: () => refetch() })}>
                        <Target className="w-3.5 h-3.5" /> Resume Project
                      </Button>
                    )}
                  </>
                )}
                {p.status === "COMPLETED" && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => updateProject.mutate({ id, data: { status: "CLOSED" } }, { onSuccess: () => refetch() })}>
                    <Clock className="w-3.5 h-3.5" /> Close Project
                  </Button>
                )}
                {p.scopeOfWork && (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-[10px] text-text-dim uppercase mb-1">Scope of Work</p>
                    <p className="text-xs text-text-muted whitespace-pre-wrap">{p.scopeOfWork}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
