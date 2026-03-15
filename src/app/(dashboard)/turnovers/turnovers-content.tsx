"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ClipboardList, ArrowRight } from "lucide-react";
import { useTurnovers } from "@/hooks/use-turnovers";
import { useBuildings } from "@/hooks/use-buildings";
import { PageSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import ExportButton from "@/components/ui/export-button";
import { fmt$ } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  PENDING_INSPECTION: "Pending Inspection",
  INSPECTION_DONE: "Inspection Done",
  SCOPE_CREATED: "Scope Created",
  VENDORS_ASSIGNED: "Vendors Assigned",
  READY_TO_LIST: "Ready to List",
  LISTED: "Listed",
  COMPLETE: "Complete",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_INSPECTION: "bg-amber-500/20 text-amber-400",
  INSPECTION_DONE: "bg-blue-500/20 text-blue-400",
  SCOPE_CREATED: "bg-purple-500/20 text-purple-400",
  VENDORS_ASSIGNED: "bg-indigo-500/20 text-indigo-400",
  READY_TO_LIST: "bg-cyan-500/20 text-cyan-400",
  LISTED: "bg-green-500/20 text-green-400",
  COMPLETE: "bg-green-600/20 text-green-300",
};

export default function TurnoversContent() {
  const { data: turnovers, isLoading } = useTurnovers();
  const { data: buildings } = useBuildings();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterBuilding, setFilterBuilding] = useState<string>("");

  const filtered = useMemo(() => {
    if (!turnovers) return [];
    return turnovers.filter((t) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterBuilding && t.buildingId !== filterBuilding) return false;
      return true;
    });
  }, [turnovers, filterStatus, filterBuilding]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of turnovers || []) {
      counts[t.status] = (counts[t.status] || 0) + 1;
    }
    return counts;
  }, [turnovers]);

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Turnover Workflows</h1>
        <ExportButton
          data={filtered.map((t) => ({
            address: t.building.address,
            unit: t.unit.unitNumber,
            status: STATUS_LABELS[t.status] || t.status,
            daysActive: Math.ceil((Date.now() - new Date(t.createdAt).getTime()) / 86400000),
            estimatedCost: t.estimatedCost ? fmt$(t.estimatedCost) : "—",
            assignedTo: t.assignedTo?.name || "—",
          }))}
          filename="turnover-report"
          columns={[
            { key: "address", label: "Property" },
            { key: "unit", label: "Unit" },
            { key: "status", label: "Status" },
            { key: "daysActive", label: "Days Active" },
            { key: "estimatedCost", label: "Est. Cost" },
            { key: "assignedTo", label: "Assigned To" },
          ]}
          pdfConfig={{
            title: "Turnover Workflow Report",
            stats: [
              { label: "Active Turnovers", value: String(turnovers?.length || 0) },
              { label: "Pending Inspection", value: String(statusCounts["PENDING_INSPECTION"] || 0) },
              { label: "In Progress", value: String((turnovers?.length || 0) - (statusCounts["PENDING_INSPECTION"] || 0) - (statusCounts["COMPLETE"] || 0)) },
              { label: "Complete", value: String(statusCounts["COMPLETE"] || 0) },
            ],
          }}
        />
      </div>

      {/* Status pipeline */}
      {turnovers && turnovers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterStatus(filterStatus === key ? "all" : key)}
              className={`rounded-lg p-3 text-center border transition-colors ${
                filterStatus === key ? "border-accent bg-accent/10" : "border-border bg-atlas-navy-3 hover:bg-card-hover"
              }`}
            >
              <p className="text-lg font-bold font-mono tabular-nums text-text-primary">{statusCounts[key] || 0}</p>
              <p className="text-[10px] text-text-dim uppercase tracking-wider mt-0.5">{label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        {buildings && buildings.length > 1 && (
          <select
            value={filterBuilding}
            onChange={(e) => setFilterBuilding(e.target.value)}
            className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="">All Properties</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.address}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Property</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Unit</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Status</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Days</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Est. Cost</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Assigned</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-text-dim uppercase">Vendors</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const daysActive = Math.ceil((Date.now() - new Date(t.createdAt).getTime()) / 86400000);
                const urgencyColor = daysActive >= 60 ? "text-red-400" : daysActive >= 30 ? "text-orange-400" : "text-amber-400";
                return (
                  <tr key={t.id} className={`border-b border-border/50 last:border-0 hover:bg-card-hover transition-colors ${i % 2 === 1 ? "bg-white/[0.02]" : ""}`}>
                    <td className="px-3 py-2 text-text-primary">{t.building.address}</td>
                    <td className="px-3 py-2 text-text-muted font-mono">{t.unit.unitNumber}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] || ""}`}>
                        {STATUS_LABELS[t.status] || t.status}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-right font-mono tabular-nums ${urgencyColor}`}>{daysActive}</td>
                    <td className="px-3 py-2 text-right text-text-muted font-mono tabular-nums">{t.estimatedCost ? fmt$(t.estimatedCost) : "—"}</td>
                    <td className="px-3 py-2 text-text-muted">{t.assignedTo?.name || "—"}</td>
                    <td className="px-3 py-2 text-center text-text-muted font-mono">{t.vendorAssignments.length}</td>
                    <td className="px-3 py-2">
                      <Link href={`/turnovers/${t.id}`} className="text-accent hover:text-accent-light">
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No turnovers"
          description={filterStatus !== "all" ? "No turnovers match the selected filter" : "No active turnover workflows. Start one from the Vacancies page."}
          icon={ClipboardList}
        />
      )}
    </div>
  );
}
