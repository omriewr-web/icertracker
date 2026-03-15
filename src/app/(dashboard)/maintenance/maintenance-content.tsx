"use client";

import { useMemo, useState } from "react";
import { Wrench, Plus, List, LayoutGrid, X } from "lucide-react";
import { useWorkOrders, useBulkUpdateWorkOrders } from "@/hooks/use-work-orders";
import { useVendors } from "@/hooks/use-vendors";
import KpiCard from "@/components/ui/kpi-card";
import { TablePageSkeleton } from "@/components/ui/skeleton";
import Button from "@/components/ui/button";
import KanbanBoard from "@/components/maintenance/kanban-board";
import WorkOrderDetailModal from "@/components/maintenance/work-order-detail-modal";
import CreateWorkOrderModal from "@/components/maintenance/create-work-order-modal";
import PriorityBadge from "@/components/maintenance/priority-badge";
import CategoryBadge from "@/components/maintenance/category-badge";
import DueDateBadge from "@/components/maintenance/due-date-badge";
import SourceBadge from "@/components/maintenance/source-badge";
import VendorManagement from "@/components/maintenance/vendor-management";
import ScheduleManagement from "@/components/maintenance/schedule-management";
import EmptyState from "@/components/ui/empty-state";
import { WorkOrderView } from "@/types";
import { formatDate, fmt$ } from "@/lib/utils";
import { cn } from "@/lib/utils";
import ExportButton from "@/components/ui/export-button";

export default function MaintenanceContent() {
  const { data: workOrders, isLoading } = useWorkOrders();
  const { data: vendors } = useVendors();
  const bulkUpdate = useBulkUpdateWorkOrders();
  const [selectedWO, setSelectedWO] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [tab, setTab] = useState<"orders" | "vendors" | "schedules">("orders");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkValue, setBulkValue] = useState("");

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
    if (filterStatus === "OVERDUE") {
      const now = new Date();
      wos = wos.filter((w) => w.dueDate && new Date(w.dueDate) < now && w.status !== "COMPLETED");
    } else if (filterStatus !== "all") {
      wos = wos.filter((w) => w.status === filterStatus);
    }
    if (filterPriority !== "all") wos = wos.filter((w) => w.priority === filterPriority);
    return wos;
  }, [workOrders, filterStatus, filterPriority]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((w) => w.id)));
    }
  }

  function handleBulkApply() {
    if (!bulkAction || !bulkValue || selectedIds.size === 0) return;
    bulkUpdate.mutate(
      { ids: Array.from(selectedIds), action: bulkAction, value: bulkValue },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
          setBulkAction("");
          setBulkValue("");
        },
      }
    );
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBulkAction("");
    setBulkValue("");
  }

  if (isLoading) return <TablePageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-display tracking-wide">Maintenance</h1>
          <span className="text-[10px] text-text-dim tracking-[0.2em] uppercase hidden sm:inline">Operations — Work Orders</span>
        </div>
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

      <div className="flex gap-1 bg-atlas-navy-3 border border-border rounded-lg p-1">
        {(["orders", "vendors", "schedules"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium tracking-wide uppercase rounded-md transition-colors",
              tab === t ? "bg-accent/90 text-atlas-navy-1 font-semibold" : "text-text-dim hover:text-text-muted hover:bg-atlas-navy-4/50"
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
            <KpiCard label="Total" value={stats.total} icon={Wrench} />
            <KpiCard label="Open" value={stats.open} color="#3B82F6" />
            <KpiCard label="In Progress" value={stats.inProgress} color="#F59E0B" />
            <KpiCard label="Urgent" value={stats.urgent} color="#EF4444" />
            <KpiCard label="Costs (Completed)" value={fmt$(stats.totalCost)} color="#10B981" />
          </div>

          {view === "list" && (
            <div className="flex gap-3">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
                <option value="all">All Status</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="OVERDUE">Overdue</option>
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

          {/* Bulk action toolbar */}
          {view === "list" && selectedIds.size > 0 && (
            <div className="flex items-center gap-3 bg-accent/10 border border-accent/30 rounded-lg px-4 py-2">
              <span className="text-sm text-text-primary font-medium">{selectedIds.size} selected</span>
              <select
                value={bulkAction}
                onChange={(e) => { setBulkAction(e.target.value); setBulkValue(""); }}
                className="bg-bg border border-border rounded-lg px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">Select action…</option>
                <option value="change_status">Change Status</option>
                <option value="change_priority">Change Priority</option>
                <option value="assign_vendor">Assign Vendor</option>
              </select>
              {bulkAction === "change_status" && (
                <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="bg-bg border border-border rounded-lg px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent">
                  <option value="">Select status…</option>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              )}
              {bulkAction === "change_priority" && (
                <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="bg-bg border border-border rounded-lg px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent">
                  <option value="">Select priority…</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              )}
              {bulkAction === "assign_vendor" && (
                <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="bg-bg border border-border rounded-lg px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent">
                  <option value="">Select vendor…</option>
                  {vendors?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              )}
              <Button onClick={handleBulkApply} disabled={!bulkAction || !bulkValue || bulkUpdate.isPending}>
                {bulkUpdate.isPending ? "Applying…" : "Apply"}
              </Button>
              <button onClick={clearSelection} className="text-text-dim hover:text-text-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {view === "kanban" ? (
            <KanbanBoard workOrders={workOrders || []} onSelect={(wo) => setSelectedWO(wo.id)} />
          ) : (
            <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-2 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Title</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Building</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Priority</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Category</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Due</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Source</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Assigned</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((wo) => (
                    <tr key={wo.id} className="border-b border-border/50 hover:bg-card-hover cursor-pointer transition-colors">
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(wo.id)}
                          onChange={() => toggleSelect(wo.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2 text-text-primary" onClick={() => setSelectedWO(wo.id)}>{wo.title}</td>
                      <td className="px-3 py-2 text-text-muted text-xs" onClick={() => setSelectedWO(wo.id)}>{wo.buildingAddress}{wo.unitNumber ? ` #${wo.unitNumber}` : ""}</td>
                      <td className="px-3 py-2" onClick={() => setSelectedWO(wo.id)}><PriorityBadge priority={wo.priority} /></td>
                      <td className="px-3 py-2" onClick={() => setSelectedWO(wo.id)}><CategoryBadge category={wo.category} /></td>
                      <td className="px-3 py-2 text-xs text-text-muted" onClick={() => setSelectedWO(wo.id)}>{wo.status.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2" onClick={() => setSelectedWO(wo.id)}><DueDateBadge dueDate={wo.dueDate} status={wo.status} /></td>
                      <td className="px-3 py-2" onClick={() => setSelectedWO(wo.id)}><SourceBadge sourceType={wo.sourceType} /></td>
                      <td className="px-3 py-2 text-xs text-text-muted" onClick={() => setSelectedWO(wo.id)}>{wo.assignedToName || "—"}</td>
                      <td className="px-3 py-2 text-xs text-text-dim" onClick={() => setSelectedWO(wo.id)}>{formatDate(wo.createdAt)}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={10}><EmptyState icon={Wrench} title="No work orders found" description="Create a work order to start tracking maintenance tasks." /></td></tr>
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
