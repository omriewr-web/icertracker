"use client";

import { useMemo, useState } from "react";
import { Wrench, Plus, List, LayoutGrid } from "lucide-react";
import { useWorkOrders } from "@/hooks/use-work-orders";
import StatCard from "@/components/ui/stat-card";
import { PageSkeleton } from "@/components/ui/skeleton";
import Button from "@/components/ui/button";
import KanbanBoard from "@/components/maintenance/kanban-board";
import WorkOrderDetailModal from "@/components/maintenance/work-order-detail-modal";
import CreateWorkOrderModal from "@/components/maintenance/create-work-order-modal";
import PriorityBadge from "@/components/maintenance/priority-badge";
import CategoryBadge from "@/components/maintenance/category-badge";
import VendorManagement from "@/components/maintenance/vendor-management";
import ScheduleManagement from "@/components/maintenance/schedule-management";
import { WorkOrderView } from "@/types";
import { formatDate, fmt$ } from "@/lib/utils";
import { cn } from "@/lib/utils";
import ExportButton from "@/components/ui/export-button";

export default function MaintenanceContent() {
  const { data: workOrders, isLoading } = useWorkOrders();
  const [selectedWO, setSelectedWO] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [tab, setTab] = useState<"orders" | "vendors" | "schedules">("orders");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  const stats = useMemo(() => {
    const wos = workOrders || [];
    return {
      total: wos.length,
      open: wos.filter((w) => w.status === "OPEN").length,
      inProgress: wos.filter((w) => w.status === "IN_PROGRESS").length,
      urgent: wos.filter((w) => w.priority === "URGENT" && w.status !== "COMPLETED").length,
      totalCost: wos.filter((w) => w.status === "COMPLETED").reduce((s, w) => s + (w.actualCost || 0), 0),
    };
  }, [workOrders]);

  const filtered = useMemo(() => {
    let wos = workOrders || [];
    if (filterStatus !== "all") wos = wos.filter((w) => w.status === filterStatus);
    if (filterPriority !== "all") wos = wos.filter((w) => w.priority === filterPriority);
    return wos;
  }, [workOrders, filterStatus, filterPriority]);

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Maintenance</h1>
        <div className="flex items-center gap-2">
          {tab === "orders" && (
            <>
              <div className="flex bg-card border border-border rounded-lg overflow-hidden">
                <button onClick={() => setView("kanban")} className={cn("px-2.5 py-1.5 text-xs", view === "kanban" ? "bg-accent text-white" : "text-text-dim hover:text-text-muted")}>
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setView("list")} className={cn("px-2.5 py-1.5 text-xs", view === "list" ? "bg-accent text-white" : "text-text-dim hover:text-text-muted")}>
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4" /> New Work Order
              </Button>
              <ExportButton
                data={filtered.map((wo) => ({
                  title: wo.title,
                  buildingAddress: wo.buildingAddress,
                  unitNumber: wo.unitNumber || "",
                  priority: wo.priority,
                  category: wo.category,
                  status: wo.status.replace(/_/g, " "),
                  assignedToName: wo.assignedToName || "",
                  createdAt: wo.createdAt,
                }))}
                filename="work-orders"
                columns={[
                  { key: "title", label: "Title" },
                  { key: "buildingAddress", label: "Building" },
                  { key: "unitNumber", label: "Unit" },
                  { key: "priority", label: "Priority" },
                  { key: "category", label: "Category" },
                  { key: "status", label: "Status" },
                  { key: "assignedToName", label: "Assigned To" },
                  { key: "createdAt", label: "Created" },
                ]}
                pdfConfig={{
                  title: "Work Orders Report",
                  stats: [
                    { label: "Total", value: String(stats.total) },
                    { label: "Open", value: String(stats.open) },
                    { label: "In Progress", value: String(stats.inProgress) },
                    { label: "Urgent", value: String(stats.urgent) },
                  ],
                }}
              />
            </>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
        {(["orders", "vendors", "schedules"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              tab === t ? "bg-accent text-white" : "text-text-dim hover:text-text-muted"
            )}
          >
            {t === "orders" ? "Work Orders" : t === "vendors" ? "Vendors" : "Schedules"}
          </button>
        ))}
      </div>

      {tab === "vendors" && <VendorManagement />}
      {tab === "schedules" && <ScheduleManagement />}

      {tab === "orders" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Total" value={stats.total} icon={Wrench} />
            <StatCard label="Open" value={stats.open} color="#3B82F6" />
            <StatCard label="In Progress" value={stats.inProgress} color="#F59E0B" />
            <StatCard label="Urgent" value={stats.urgent} color="#EF4444" />
            <StatCard label="Costs (Completed)" value={fmt$(stats.totalCost)} color="#10B981" />
          </div>

          {view === "list" && (
            <div className="flex gap-3">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
                <option value="all">All Status</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
              </select>
              <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
                <option value="all">All Priority</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          )}

          {view === "kanban" ? (
            <KanbanBoard workOrders={workOrders || []} onSelect={(wo) => setSelectedWO(wo.id)} />
          ) : (
            <div className="bg-card-gradient border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Title</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Building</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Priority</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Category</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Assigned</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((wo) => (
                    <tr key={wo.id} className="border-b border-border/50 hover:bg-card-hover cursor-pointer transition-colors" onClick={() => setSelectedWO(wo.id)}>
                      <td className="px-3 py-2 text-text-primary">{wo.title}</td>
                      <td className="px-3 py-2 text-text-muted text-xs">{wo.buildingAddress}{wo.unitNumber ? ` #${wo.unitNumber}` : ""}</td>
                      <td className="px-3 py-2"><PriorityBadge priority={wo.priority} /></td>
                      <td className="px-3 py-2"><CategoryBadge category={wo.category} /></td>
                      <td className="px-3 py-2 text-xs text-text-muted">{wo.status.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2 text-xs text-text-muted">{wo.assignedToName || "—"}</td>
                      <td className="px-3 py-2 text-xs text-text-dim">{formatDate(wo.createdAt)}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-text-dim">No work orders found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <WorkOrderDetailModal workOrderId={selectedWO} onClose={() => setSelectedWO(null)} />
      <CreateWorkOrderModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
