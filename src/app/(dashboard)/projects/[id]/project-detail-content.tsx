"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Plus, Link2 } from "lucide-react";
import { useProject, useUpdateProject, useLinkWorkOrder, useLinkViolation } from "@/hooks/use-projects";
import KpiCard from "@/components/ui/kpi-card";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { TablePageSkeleton } from "@/components/ui/skeleton";
import { formatDate, fmt$ } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toNumber } from "@/lib/utils/decimal";
import toast from "react-hot-toast";

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-gray-500/20 text-gray-400", ESTIMATING: "bg-blue-500/20 text-blue-400",
  PENDING_APPROVAL: "bg-yellow-500/20 text-yellow-400", APPROVED: "bg-teal-500/20 text-teal-400",
  IN_PROGRESS: "bg-blue-500/20 text-blue-400", PAUSED: "bg-orange-500/20 text-orange-400",
  SUBSTANTIALLY_COMPLETE: "bg-purple-500/20 text-purple-400", COMPLETED: "bg-green-500/20 text-green-400",
  CLOSED: "bg-gray-500/20 text-gray-400", CANCELLED: "bg-red-500/20 text-red-400",
};
const PRIORITY_COLORS: Record<string, string> = { CRITICAL: "bg-red-500/20 text-red-400", HIGH: "bg-orange-500/20 text-orange-400", MEDIUM: "bg-blue-500/20 text-blue-400", LOW: "bg-gray-500/20 text-gray-400" };
const HEALTH_CONFIG: Record<string, { color: string; dot: string }> = {
  ON_TRACK: { color: "text-green-400", dot: "bg-green-400" }, AT_RISK: { color: "text-orange-400", dot: "bg-orange-400" },
  DELAYED: { color: "text-red-400", dot: "bg-red-400" }, OVER_BUDGET: { color: "text-red-400", dot: "bg-red-400" }, BLOCKED: { color: "text-red-400", dot: "bg-red-400" },
};
const MILESTONE_COLORS: Record<string, string> = { PENDING: "text-gray-400", IN_PROGRESS: "text-blue-400", COMPLETED: "text-green-400", BLOCKED: "text-red-400" };

function label(s: string) { return s.replace(/_/g, " "); }

export default function ProjectDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: project, isLoading, refetch } = useProject(id);
  const updateProject = useUpdateProject();
  const linkWO = useLinkWorkOrder();
  const linkViolation = useLinkViolation();

  const [tab, setTab] = useState<"overview" | "milestones" | "budget" | "work-orders" | "violations" | "activity">("overview");
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

  if (isLoading) return <TablePageSkeleton />;
  if (!project) return <div className="p-8 text-text-dim">Project not found</div>;

  const p = project;
  const approved = toNumber(p.approvedBudget);
  const actual = toNumber(p.actualCost);
  const variance = approved - actual;
  const hc = HEALTH_CONFIG[p.health] || HEALTH_CONFIG.ON_TRACK;
  const daysLeft = p.targetEndDate ? Math.ceil((new Date(p.targetEndDate).getTime() - Date.now()) / 86400000) : null;

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

  const tabs = ["overview", "milestones", "budget", "work-orders", "violations", "activity"] as const;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/projects" className="flex items-center gap-1 text-xs text-text-dim hover:text-accent mb-2"><ArrowLeft className="w-3 h-3" /> Back to Projects</Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary font-display tracking-wide">{p.name}</h1>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium uppercase", STATUS_COLORS[p.status])}>{label(p.status)}</span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", PRIORITY_COLORS[p.priority])}>{p.priority}</span>
            <span className={cn("flex items-center gap-1 text-xs", hc.color)}><span className={cn("w-1.5 h-1.5 rounded-full", hc.dot)} />{label(p.health)}</span>
          </div>
          <p className="text-xs text-text-dim mt-1">{p.building?.address || ""} — {label(p.category)}</p>
        </div>
        <div className="flex items-center gap-2">
          {p.status === "PENDING_APPROVAL" && <Button onClick={handleApprove} className="bg-[#c9a84c] text-[#060c17] hover:bg-[#d4b95e]"><CheckCircle className="w-4 h-4" /> Approve</Button>}
          {!["COMPLETED", "CLOSED", "CANCELLED"].includes(p.status) && <Button variant="outline" onClick={handleMarkComplete}>Mark Complete</Button>}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard label="Approved Budget" value={approved ? fmt$(approved) : "—"} />
        <KpiCard label="Actual Cost" value={actual ? fmt$(actual) : "—"} />
        <KpiCard label="Variance" value={approved ? fmt$(Math.abs(variance)) : "—"} color={variance >= 0 ? "#10B981" : "#EF4444"} subtext={variance >= 0 ? "Under budget" : "Over budget"} subtextColor={variance >= 0 ? "#10B981" : "#EF4444"} />
        <KpiCard label="% Complete" value={`${p.percentComplete}%`} color="#C9A84C" />
        <KpiCard label={daysLeft !== null && daysLeft < 0 ? "Days Overdue" : "Days Remaining"} value={daysLeft !== null ? `${Math.abs(daysLeft)}` : "—"} color={daysLeft !== null && daysLeft < 0 ? "#EF4444" : "#3B82F6"} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-atlas-navy-3 border border-border rounded-lg p-1">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-3 py-1.5 text-xs font-medium tracking-wide uppercase rounded-md transition-colors", tab === t ? "bg-accent/90 text-atlas-navy-1 font-semibold" : "text-text-dim hover:text-text-muted hover:bg-atlas-navy-4/50")}>
            {t === "work-orders" ? "Work Orders" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && (
        <div className="bg-atlas-navy-3 border border-border rounded-xl p-5 space-y-4">
          {p.description && <div><p className="text-xs text-text-dim uppercase mb-1">Description</p><p className="text-sm text-text-primary whitespace-pre-wrap">{p.description}</p></div>}
          {p.scopeOfWork && <div><p className="text-xs text-text-dim uppercase mb-1">Scope of Work</p><p className="text-sm text-text-primary whitespace-pre-wrap">{p.scopeOfWork}</p></div>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div><p className="text-xs text-text-dim">Start Date</p><p className="text-sm text-text-primary">{formatDate(p.startDate)}</p></div>
            <div><p className="text-xs text-text-dim">Target End</p><p className="text-sm text-text-primary">{formatDate(p.targetEndDate)}</p></div>
            <div><p className="text-xs text-text-dim">Actual End</p><p className="text-sm text-text-primary">{formatDate(p.actualEndDate)}</p></div>
            <div><p className="text-xs text-text-dim">Code</p><p className="text-sm text-text-primary">{p.code || "—"}</p></div>
          </div>
          <div className="flex gap-3 pt-2">
            {p.ownerVisible && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent uppercase">Owner Visible</span>}
            {p.requiresApproval && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 uppercase">Requires Approval</span>}
            {p.approvedAt && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 uppercase">Approved {formatDate(p.approvedAt)}</span>}
          </div>
        </div>
      )}

      {tab === "milestones" && (
        <div className="space-y-4">
          {p.milestones?.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-atlas-navy-1 rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${p.percentComplete}%` }} />
              </div>
              <span className="text-sm text-text-muted">{p.milestones.filter((m: any) => m.status === "COMPLETED").length}/{p.milestones.length} completed</span>
            </div>
          )}
          <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Milestone</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Due Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Completed</th>
              </tr></thead>
              <tbody>
                {p.milestones?.map((m: any) => (
                  <tr key={m.id} className="border-b border-border/50">
                    <td className="px-3 py-2 text-text-primary">{m.name}</td>
                    <td className="px-3 py-2">
                      <select value={m.status} onChange={(e) => handleMilestoneStatusChange(m.id, e.target.value)} className="bg-bg border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent">
                        {["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-xs text-text-dim">{formatDate(m.dueDate)}</td>
                    <td className="px-3 py-2 text-xs text-text-dim">{formatDate(m.completedAt)}</td>
                  </tr>
                ))}
                {(!p.milestones || p.milestones.length === 0) && <tr><td colSpan={4} className="px-3 py-6 text-center text-text-dim text-sm">No milestones yet</td></tr>}
              </tbody>
            </table>
          </div>
          {showMilestoneForm ? (
            <div className="flex items-end gap-3 bg-atlas-navy-3 border border-border rounded-xl p-4">
              <div className="flex-1"><label className="block text-xs text-text-dim mb-1">Name</label><input value={milestoneName} onChange={(e) => setMilestoneName(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" /></div>
              <div><label className="block text-xs text-text-dim mb-1">Due Date</label><input type="date" value={milestoneDue} onChange={(e) => setMilestoneDue(e.target.value)} className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" /></div>
              <Button onClick={handleMilestoneCreate} disabled={!milestoneName}>Add</Button>
              <Button variant="outline" onClick={() => setShowMilestoneForm(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowMilestoneForm(true)}><Plus className="w-4 h-4" /> Add Milestone</Button>
          )}
        </div>
      )}

      {tab === "budget" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { l: "Estimated", v: toNumber(p.estimatedBudget) },
              { l: "Approved", v: approved },
              { l: "Actual", v: actual },
              { l: "Contingency", v: toNumber(p.contingency) },
              { l: "Variance", v: Math.abs(variance), c: variance >= 0 },
            ].map((item) => (
              <div key={item.l} className="bg-atlas-navy-3 border border-border rounded-xl p-3">
                <p className="text-[10px] text-text-dim uppercase">{item.l}</p>
                <p className={cn("text-lg font-bold font-data tabular-nums", item.c !== undefined ? (item.c ? "text-green-400" : "text-red-400") : "text-text-primary")}>{item.v ? fmt$(item.v) : "—"}</p>
              </div>
            ))}
          </div>
          <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Category</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Description</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Estimated</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Actual</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Variance</th>
              </tr></thead>
              <tbody>
                {p.budgetLines?.map((bl: any) => {
                  const est = toNumber(bl.estimated);
                  const act = toNumber(bl.actual);
                  const v = est - act;
                  return (
                    <tr key={bl.id} className="border-b border-border/50">
                      <td className="px-3 py-2 text-text-primary">{bl.category}</td>
                      <td className="px-3 py-2 text-xs text-text-muted">{bl.description || "—"}</td>
                      <td className="px-3 py-2 text-right text-xs text-text-muted tabular-nums">{fmt$(est)}</td>
                      <td className="px-3 py-2 text-right text-xs text-text-muted tabular-nums">{act ? fmt$(act) : "—"}</td>
                      <td className={cn("px-3 py-2 text-right text-xs tabular-nums", v >= 0 ? "text-green-400" : "text-red-400")}>{act ? fmt$(Math.abs(v)) : "—"}</td>
                    </tr>
                  );
                })}
                {(!p.budgetLines || p.budgetLines.length === 0) && <tr><td colSpan={5} className="px-3 py-6 text-center text-text-dim text-sm">No budget lines yet</td></tr>}
              </tbody>
            </table>
          </div>
          {showBudgetForm ? (
            <div className="flex items-end gap-3 bg-atlas-navy-3 border border-border rounded-xl p-4">
              <div><label className="block text-xs text-text-dim mb-1">Category</label><input value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)} className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" placeholder="e.g. Labor" /></div>
              <div className="flex-1"><label className="block text-xs text-text-dim mb-1">Description</label><input value={budgetDesc} onChange={(e) => setBudgetDesc(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" /></div>
              <div><label className="block text-xs text-text-dim mb-1">Estimated $</label><input type="number" value={budgetEstimated} onChange={(e) => setBudgetEstimated(e.target.value)} className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent w-28" /></div>
              <Button onClick={handleBudgetCreate} disabled={!budgetCategory || !budgetEstimated}>Add</Button>
              <Button variant="outline" onClick={() => setShowBudgetForm(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowBudgetForm(true)}><Plus className="w-4 h-4" /> Add Budget Line</Button>
          )}

          {/* Change Orders */}
          <h3 className="text-sm font-semibold text-text-primary pt-4">Change Orders</h3>
          <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Title</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Amount</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Requested</th>
              </tr></thead>
              <tbody>
                {p.changeOrders?.map((co: any) => (
                  <tr key={co.id} className="border-b border-border/50">
                    <td className="px-3 py-2 text-text-primary">{co.title}</td>
                    <td className="px-3 py-2 text-right text-xs text-text-muted tabular-nums">{fmt$(toNumber(co.amount))}</td>
                    <td className="px-3 py-2"><span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium uppercase", co.status === "APPROVED" ? "bg-green-500/20 text-green-400" : co.status === "REJECTED" ? "bg-red-500/20 text-red-400" : "bg-gray-500/20 text-gray-400")}>{co.status}</span></td>
                    <td className="px-3 py-2 text-xs text-text-dim">{formatDate(co.requestedAt)}</td>
                  </tr>
                ))}
                {(!p.changeOrders || p.changeOrders.length === 0) && <tr><td colSpan={4} className="px-3 py-6 text-center text-text-dim text-sm">No change orders yet</td></tr>}
              </tbody>
            </table>
          </div>
          {showCOForm ? (
            <div className="flex items-end gap-3 bg-atlas-navy-3 border border-border rounded-xl p-4">
              <div className="flex-1"><label className="block text-xs text-text-dim mb-1">Title</label><input value={coTitle} onChange={(e) => setCOTitle(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" /></div>
              <div><label className="block text-xs text-text-dim mb-1">Amount $</label><input type="number" value={coAmount} onChange={(e) => setCOAmount(e.target.value)} className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent w-28" /></div>
              <Button onClick={handleCOCreate} disabled={!coTitle || !coAmount}>Add</Button>
              <Button variant="outline" onClick={() => setShowCOForm(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowCOForm(true)}><Plus className="w-4 h-4" /> Add Change Order</Button>
          )}
        </div>
      )}

      {tab === "work-orders" && (
        <div className="space-y-4">
          <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Work Order ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Linked</th>
              </tr></thead>
              <tbody>
                {p.workOrders?.map((wo: any) => (
                  <tr key={wo.workOrderId} className="border-b border-border/50">
                    <td className="px-3 py-2 text-text-primary font-mono text-xs">{wo.workOrderId}</td>
                    <td className="px-3 py-2 text-xs text-text-dim">{formatDate(wo.linkedAt)}</td>
                  </tr>
                ))}
                {(!p.workOrders || p.workOrders.length === 0) && <tr><td colSpan={2} className="px-3 py-6 text-center text-text-dim text-sm">No linked work orders</td></tr>}
              </tbody>
            </table>
          </div>
          {showLinkWO ? (
            <div className="flex items-end gap-3 bg-atlas-navy-3 border border-border rounded-xl p-4">
              <div className="flex-1"><label className="block text-xs text-text-dim mb-1">Work Order ID</label><input value={linkWOId} onChange={(e) => setLinkWOId(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" placeholder="Paste work order ID" /></div>
              <Button onClick={() => { linkWO.mutate({ projectId: id, workOrderId: linkWOId }, { onSuccess: () => { setLinkWOId(""); setShowLinkWO(false); refetch(); } }); }} disabled={!linkWOId || linkWO.isPending}>Link</Button>
              <Button variant="outline" onClick={() => setShowLinkWO(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowLinkWO(true)}><Link2 className="w-4 h-4" /> Link Work Order</Button>
          )}
        </div>
      )}

      {tab === "violations" && (
        <div className="space-y-4">
          <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Violation ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Linked</th>
              </tr></thead>
              <tbody>
                {p.violations?.map((v: any) => (
                  <tr key={v.violationId} className="border-b border-border/50">
                    <td className="px-3 py-2 text-text-primary font-mono text-xs">{v.violationId}</td>
                    <td className="px-3 py-2 text-xs text-text-dim">{formatDate(v.linkedAt)}</td>
                  </tr>
                ))}
                {(!p.violations || p.violations.length === 0) && <tr><td colSpan={2} className="px-3 py-6 text-center text-text-dim text-sm">No linked violations</td></tr>}
              </tbody>
            </table>
          </div>
          {showLinkViol ? (
            <div className="flex items-end gap-3 bg-atlas-navy-3 border border-border rounded-xl p-4">
              <div className="flex-1"><label className="block text-xs text-text-dim mb-1">Violation ID</label><input value={linkViolId} onChange={(e) => setLinkViolId(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" placeholder="Paste violation ID" /></div>
              <Button onClick={() => { linkViolation.mutate({ projectId: id, violationId: linkViolId }, { onSuccess: () => { setLinkViolId(""); setShowLinkViol(false); refetch(); } }); }} disabled={!linkViolId || linkViolation.isPending}>Link</Button>
              <Button variant="outline" onClick={() => setShowLinkViol(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowLinkViol(true)}><Link2 className="w-4 h-4" /> Link Violation</Button>
          )}
        </div>
      )}

      {tab === "activity" && (
        <div className="bg-atlas-navy-3 border border-border rounded-xl divide-y divide-border/50">
          {p.activity?.map((a: any) => (
            <div key={a.id} className="px-4 py-3 flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text-primary"><span className="font-medium">{label(a.action)}</span>{a.detail ? ` — ${a.detail}` : ""}</p>
                <p className="text-[10px] text-text-dim mt-0.5">{formatDate(a.createdAt)}</p>
              </div>
            </div>
          ))}
          {(!p.activity || p.activity.length === 0) && <div className="px-4 py-8 text-center text-text-dim text-sm">No activity yet</div>}
        </div>
      )}
    </div>
  );
}
