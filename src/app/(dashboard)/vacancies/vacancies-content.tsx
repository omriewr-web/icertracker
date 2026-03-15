"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DoorOpen, ArrowRight, ClipboardList, Plus, MessageSquare } from "lucide-react";
import { useBuildings } from "@/hooks/use-buildings";
import { useMetrics } from "@/hooks/use-metrics";
import { useTurnovers, useCreateTurnover } from "@/hooks/use-turnovers";
import { useUnits, useUpdateUnit } from "@/hooks/use-units";
import { useLeasingActivities, useCreateLeasingActivity } from "@/hooks/use-leasing-activities";
import KpiCard from "@/components/ui/kpi-card";
import { PageSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import VacancyChart from "@/components/dashboard/vacancy-chart";
import { fmt$, pct } from "@/lib/utils";
import ExportButton from "@/components/ui/export-button";

const TURNOVER_STATUS_LABELS: Record<string, string> = {
  PENDING_INSPECTION: "Pending Inspection",
  INSPECTION_DONE: "Inspection Done",
  SCOPE_CREATED: "Scope Created",
  VENDORS_ASSIGNED: "Vendors Assigned",
  READY_TO_LIST: "Ready to List",
  LISTED: "Listed",
  COMPLETE: "Complete",
};

const ACTIVITY_TYPES = [
  { value: "showing", label: "Showing" },
  { value: "inquiry", label: "Inquiry" },
  { value: "application", label: "Application" },
  { value: "offer_sent", label: "Offer Sent" },
  { value: "follow_up", label: "Follow Up" },
  { value: "lease_signed", label: "Lease Signed" },
  { value: "note", label: "Note" },
];

function InlineRentEditor({ unitId, currentRent }: { unitId: string; currentRent: number | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentRent?.toString() || "");
  const updateUnit = useUpdateUnit();

  if (!editing) {
    return (
      <button
        onClick={() => { setValue(currentRent?.toString() || ""); setEditing(true); }}
        className="text-right font-mono tabular-nums text-text-muted hover:text-accent transition-colors cursor-pointer"
      >
        {currentRent ? fmt$(currentRent) : "Set rent"}
      </button>
    );
  }

  return (
    <input
      type="number"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0) {
          updateUnit.mutate({ id: unitId, data: { askingRent: num } });
        }
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
      autoFocus
      className="w-24 px-1.5 py-0.5 text-right font-mono text-sm bg-card-hover border border-accent/50 rounded text-text-primary outline-none"
    />
  );
}

export default function VacanciesContent() {
  const { data: buildings, isLoading } = useBuildings();
  const { data: metrics } = useMetrics();
  const { data: turnovers } = useTurnovers();
  const createTurnover = useCreateTurnover();
  const { data: allUnits } = useUnits();
  const { data: activities } = useLeasingActivities();
  const createActivity = useCreateLeasingActivity();

  const [activityForm, setActivityForm] = useState<{ unitId: string; buildingId: string } | null>(null);
  const [actType, setActType] = useState("showing");
  const [actDesc, setActDesc] = useState("");
  const [actContact, setActContact] = useState("");

  const buildingsWithVacancies = useMemo(
    () => (buildings || []).filter((b) => b.vacant > 0).sort((a, b) => b.vacant - a.vacant),
    [buildings]
  );

  const vacantUnits = useMemo(
    () => (allUnits || []).filter((u) => u.isVacant),
    [allUnits]
  );

  const totalVacantRent = useMemo(
    () => metrics?.lostRent || 0,
    [metrics]
  );

  // Build a map of unitId → turnover for quick lookup
  const turnoverByUnit = useMemo(() => {
    const map = new Map<string, (typeof turnovers extends (infer T)[] | undefined ? T : never)>();
    for (const t of turnovers || []) {
      map.set(t.unitId, t);
    }
    return map;
  }, [turnovers]);

  // Count activities per unit
  const activityCountByUnit = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of activities || []) {
      map.set(a.unitId, (map.get(a.unitId) || 0) + 1);
    }
    return map;
  }, [activities]);

  const activeTurnoverCount = turnovers?.filter((t) => t.status !== "COMPLETE").length || 0;

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Vacancy Tracking</h1>
        <div className="flex items-center gap-2">
          <ExportButton
            data={buildingsWithVacancies.map((b) => ({
              address: b.address,
              totalUnits: b.totalUnits,
              occupied: b.occupied,
              vacant: b.vacant,
              vacancyRate: b.totalUnits > 0 ? ((b.vacant / b.totalUnits) * 100).toFixed(1) + "%" : "0%",
              totalMarketRent: b.totalMarketRent,
            }))}
            filename="vacancy-report"
            columns={[
              { key: "address", label: "Property" },
              { key: "totalUnits", label: "Total Units" },
              { key: "occupied", label: "Occupied" },
              { key: "vacant", label: "Vacant" },
              { key: "vacancyRate", label: "Vacancy Rate" },
              { key: "totalMarketRent", label: "Market Rent" },
            ]}
            pdfConfig={{
              title: "Vacancy Report",
              stats: [
                { label: "Vacant Units", value: String(metrics?.vacant || 0) },
                { label: "Vacancy Rate", value: metrics?.totalUnits ? pct(((metrics?.vacant || 0) / metrics.totalUnits) * 100) : "0%" },
                { label: "Lost Rent/Mo", value: fmt$(totalVacantRent) },
              ],
            }}
          />
          <Link
            href="/turnovers"
            className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-light transition-colors bg-accent/10 px-3 py-1.5 rounded-lg"
          >
            <ClipboardList className="w-4 h-4" />
            {activeTurnoverCount > 0 ? `${activeTurnoverCount} Active Turnovers` : "Turnovers"}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Vacant Units" value={metrics?.vacant || 0} icon={DoorOpen} color="#F59E0B" />
        <KpiCard label="Total Units" value={metrics?.totalUnits || 0} />
        <KpiCard label="Vacancy Rate" value={metrics?.totalUnits ? pct(((metrics?.vacant || 0) / metrics.totalUnits) * 100) : "0%"} color="#F59E0B" />
        <KpiCard label="Lost Rent/Mo" value={fmt$(totalVacantRent)} color="#EF4444" />
      </div>

      {buildingsWithVacancies.length > 0 && (
        <div className="bg-card-gradient border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-muted mb-4">Vacancies by Property</h3>
          <VacancyChart buildings={buildingsWithVacancies} />
        </div>
      )}

      {/* Vacant Units Detail Table */}
      {vacantUnits.length > 0 && (
        <div className="bg-card-gradient border border-border rounded-xl overflow-x-auto">
          <div className="px-3 py-2 border-b border-border">
            <h3 className="text-sm font-medium text-text-muted">Vacant Units</h3>
          </div>
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Property</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Unit</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Type</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Asking Rent</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Activity</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {vacantUnits.map((u, i) => (
                <tr key={u.id} className={`border-b border-border/50 last:border-0 hover:bg-card-hover transition-colors ${i % 2 === 1 ? "bg-white/[0.02]" : ""}`}>
                  <td className="px-3 py-2 text-text-primary">{u.buildingAddress}</td>
                  <td className="px-3 py-2 text-text-muted font-mono">{u.unitNumber}</td>
                  <td className="px-3 py-2 text-text-dim text-xs">{u.unitType || "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <InlineRentEditor unitId={u.id} currentRent={u.askingRent} />
                  </td>
                  <td className="px-3 py-2 text-right text-text-muted font-mono tabular-nums">
                    {activityCountByUnit.get(u.id) || 0}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setActivityForm({ unitId: u.id, buildingId: u.buildingId })}
                      className="text-accent hover:text-accent-light"
                      title="Log activity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Activity Form Modal */}
      {activityForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setActivityForm(null)}>
          <div className="bg-card border border-border rounded-xl p-5 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-text-primary">Log Leasing Activity</h3>
            <select
              value={actType}
              onChange={(e) => setActType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-card-hover border border-border text-text-primary text-sm"
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              placeholder="Contact name (optional)"
              value={actContact}
              onChange={(e) => setActContact(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-card-hover border border-border text-text-primary text-sm"
            />
            <textarea
              placeholder="Notes (optional)"
              value={actDesc}
              onChange={(e) => setActDesc(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-card-hover border border-border text-text-primary text-sm resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setActivityForm(null)} className="px-3 py-1.5 text-sm text-text-muted hover:text-text-primary">
                Cancel
              </button>
              <button
                onClick={() => {
                  createActivity.mutate({
                    unitId: activityForm.unitId,
                    buildingId: activityForm.buildingId,
                    type: actType,
                    description: actDesc || undefined,
                    contactName: actContact || undefined,
                  });
                  setActivityForm(null);
                  setActType("showing");
                  setActDesc("");
                  setActContact("");
                }}
                className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent-light"
              >
                Log Activity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Leasing Activity */}
      {activities && activities.length > 0 && (
        <div className="bg-card-gradient border border-border rounded-xl overflow-x-auto">
          <div className="px-3 py-2 border-b border-border">
            <h3 className="text-sm font-medium text-text-muted flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Recent Leasing Activity
            </h3>
          </div>
          <table className="w-full text-sm min-w-[650px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Property</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Unit</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Contact</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Notes</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">By</th>
              </tr>
            </thead>
            <tbody>
              {activities.slice(0, 20).map((a, i) => (
                <tr key={a.id} className={`border-b border-border/50 last:border-0 hover:bg-card-hover transition-colors ${i % 2 === 1 ? "bg-white/[0.02]" : ""}`}>
                  <td className="px-3 py-2 text-text-dim text-xs whitespace-nowrap">{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-text-primary">{a.buildingAddress}</td>
                  <td className="px-3 py-2 text-text-muted font-mono">{a.unitNumber}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                      {ACTIVITY_TYPES.find((t) => t.value === a.type)?.label || a.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-muted text-xs">{a.contactName || "—"}</td>
                  <td className="px-3 py-2 text-text-dim text-xs max-w-[200px] truncate">{a.description || "—"}</td>
                  <td className="px-3 py-2 text-text-dim text-xs">{a.userName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Active turnovers summary */}
      {turnovers && turnovers.length > 0 && (
        <div className="bg-card-gradient border border-border rounded-xl overflow-x-auto">
          <div className="px-3 py-2 border-b border-border">
            <h3 className="text-sm font-medium text-text-muted">Active Turnover Workflows</h3>
          </div>
          <table className="w-full text-sm min-w-[650px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Property</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Unit</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Status</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Days</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Est. Cost</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {turnovers.filter((t) => t.status !== "COMPLETE").slice(0, 10).map((t, i) => {
                const days = Math.ceil((Date.now() - new Date(t.createdAt).getTime()) / 86400000);
                const urgencyColor = days >= 60 ? "text-red-400" : days >= 30 ? "text-orange-400" : "text-amber-400";
                return (
                  <tr key={t.id} className={`border-b border-border/50 last:border-0 hover:bg-card-hover transition-colors ${i % 2 === 1 ? "bg-white/[0.02]" : ""}`}>
                    <td className="px-3 py-2 text-text-primary">{t.building.address}</td>
                    <td className="px-3 py-2 text-text-muted font-mono">{t.unit.unitNumber}</td>
                    <td className="px-3 py-2 text-xs text-text-muted">{TURNOVER_STATUS_LABELS[t.status] || t.status}</td>
                    <td className={`px-3 py-2 text-right font-mono tabular-nums ${urgencyColor}`}>{days}</td>
                    <td className="px-3 py-2 text-right text-text-muted font-mono tabular-nums">{t.estimatedCost ? fmt$(t.estimatedCost) : "—"}</td>
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
      )}

      {buildingsWithVacancies.length > 0 ? (
        <div className="bg-card-gradient border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Property</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Total</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Occupied</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Vacant</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Vacancy Rate</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Market Rent</th>
              </tr>
            </thead>
            <tbody>
              {buildingsWithVacancies.map((b) => (
                <tr key={b.id} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                  <td className="px-3 py-2 text-text-primary">{b.address}</td>
                  <td className="px-3 py-2 text-right text-text-muted font-mono">{b.totalUnits}</td>
                  <td className="px-3 py-2 text-right text-green-400 font-mono">{b.occupied}</td>
                  <td className="px-3 py-2 text-right text-amber-400 font-bold font-mono">{b.vacant}</td>
                  <td className="px-3 py-2 text-right text-amber-400 font-mono">
                    {b.totalUnits > 0 ? pct((b.vacant / b.totalUnits) * 100) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-text-muted font-mono">{fmt$(b.totalMarketRent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No vacancies" description="All units are currently occupied" icon={DoorOpen} />
      )}
    </div>
  );
}
