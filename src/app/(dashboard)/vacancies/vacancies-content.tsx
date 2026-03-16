"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  DoorOpen, Wrench, CheckCircle, Clock, Tag, AlertTriangle,
  ChevronDown, MoreHorizontal, Key, User, Package, HelpCircle,
  ArrowRight, Hammer, ClipboardList, DollarSign,
} from "lucide-react";
import { useVacancies, useUpdateVacancyStatus, useVacancyRent, VacancyUnitView } from "@/hooks/use-vacancies";
import { useBuildings } from "@/hooks/use-buildings";
import { useMetrics } from "@/hooks/use-metrics";
import KpiCard from "@/components/ui/kpi-card";
import { PageSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import { fmt$, pct } from "@/lib/utils";
import ExportButton from "@/components/ui/export-button";

// ── Status Config ─────────────────────────────────────────────

const VACANCY_STATUSES = [
  { value: "VACANT",        label: "Vacant",         bg: "bg-white/5",        text: "text-text-dim",   icon: DoorOpen },
  { value: "PRE_TURNOVER",  label: "Pre-Turnover",   bg: "bg-amber-500/10",   text: "text-amber-400",  icon: Clock },
  { value: "TURNOVER",      label: "Turnover",       bg: "bg-blue-500/10",    text: "text-blue-400",   icon: Wrench },
  { value: "READY_TO_SHOW", label: "Ready to Show",  bg: "bg-teal-500/10",    text: "text-teal-400",   icon: CheckCircle },
  { value: "RENT_PROPOSED", label: "Rent Proposed",   bg: "bg-amber-500/10",   text: "text-amber-400",  icon: Clock },
  { value: "RENT_APPROVED", label: "Rent Approved",   bg: "bg-green-500/10",   text: "text-green-400",  icon: CheckCircle },
  { value: "LISTED",        label: "Listed",          bg: "bg-purple-500/10",  text: "text-purple-400", icon: Tag },
  { value: "LEASED",        label: "Leased",          bg: "bg-accent/10",      text: "text-accent",     icon: Key },
  { value: "OCCUPIED",      label: "Occupied",        bg: "bg-green-500/10",   text: "text-green-400",  icon: CheckCircle },
];

function getStatusConfig(status: string) {
  return VACANCY_STATUSES.find((s) => s.value === status) || VACANCY_STATUSES[0];
}

function getDaysColor(days: number | null): string {
  if (days === null) return "text-text-dim";
  if (days > 90) return "text-red-400 font-bold";
  if (days > 60) return "text-orange-400";
  if (days > 30) return "text-amber-400";
  return "text-text-dim";
}

const ACCESS_ICONS: Record<string, typeof Key> = {
  MASTER_KEY: Key,
  SUPER: User,
  LOCKBOX: Package,
  COMBINATION: Package,
};

// ── Dropdown wrapper ──────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose]);
}

// ── Status Badge ──────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = getStatusConfig(status);
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ── Status Selector ───────────────────────────────────────────

function StatusSelector({ unitId, currentStatus }: { unitId: string; currentStatus: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const updateStatus = useUpdateVacancyStatus();
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="hover:opacity-80 transition-opacity">
        <StatusBadge status={currentStatus} />
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]">
          {VACANCY_STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => {
                if (s.value !== currentStatus) {
                  updateStatus.mutate({ unitId, status: s.value });
                }
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-card-hover transition-colors flex items-center gap-2 ${s.value === currentStatus ? "font-bold" : ""}`}
            >
              <s.icon className={`w-3 h-3 ${s.text}`} />
              <span className={s.text}>{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Rent Modal ────────────────────────────────────────────────

function RentModal({ unitId, action, currentRent, onClose }: {
  unitId: string;
  action: "propose" | "approve";
  currentRent: number | null;
  onClose: () => void;
}) {
  const [value, setValue] = useState(currentRent?.toString() || "");
  const rentMutation = useVacancyRent();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-medium text-text-primary">
          {action === "propose" ? "Propose Rent" : "Approve Rent"}
        </h3>
        <div>
          <label className="text-xs text-text-dim block mb-1">Monthly Rent ($)</label>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 rounded-lg bg-card-hover border border-border text-text-primary text-sm font-mono"
            placeholder="0.00"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-text-muted hover:text-text-primary">Cancel</button>
          <button
            onClick={() => {
              const num = parseFloat(value);
              if (!isNaN(num) && num >= 0) {
                rentMutation.mutate({ unitId, action, rent: num });
                onClose();
              }
            }}
            disabled={rentMutation.isPending}
            className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent-light disabled:opacity-50"
          >
            {action === "propose" ? "Propose" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Access Tooltip ─────────────────────────────────────────────

function AccessCell({ unit }: { unit: VacancyUnitView }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const Icon = ACCESS_ICONS[unit.accessType || ""] || HelpCircle;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-text-dim hover:text-text-muted p-1 transition-colors"
      >
        <Icon className="w-3.5 h-3.5" />
      </button>
      {show && (
        <div className="absolute z-30 bottom-full mb-1 right-0 bg-card border border-border rounded-lg shadow-xl p-3 min-w-[180px] text-xs space-y-1">
          <p className="text-text-primary font-medium">{unit.accessType || "Unknown"}</p>
          {unit.accessNotes && <p className="text-text-dim">{unit.accessNotes}</p>}
          {unit.superName && <p className="text-text-muted">Super: {unit.superName}</p>}
          {unit.superPhone && <p className="text-text-muted">Phone: {unit.superPhone}</p>}
        </div>
      )}
    </div>
  );
}

// ── Actions Dropdown ──────────────────────────────────────────

function ActionsMenu({ unit, onProposeRent, onApproveRent }: {
  unit: VacancyUnitView;
  onProposeRent: () => void;
  onApproveRent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-text-dim hover:text-text-muted p-1 rounded hover:bg-card-hover transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1 right-0 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[210px]">
          <button
            onClick={() => { onProposeRent(); setOpen(false); }}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-text-muted hover:bg-card-hover hover:text-text-primary transition-colors"
          >
            <DollarSign className="w-3.5 h-3.5" />
            Propose Rent
          </button>
          {unit.proposedRent && (
            <button
              onClick={() => { onApproveRent(); setOpen(false); }}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-text-muted hover:bg-card-hover hover:text-text-primary transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Approve Rent
            </button>
          )}
          <Link
            href={`/maintenance?unitId=${unit.id}&buildingId=${unit.buildingId}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-text-muted hover:bg-card-hover hover:text-text-primary transition-colors"
          >
            <Wrench className="w-3.5 h-3.5" />
            Create Work Order
          </Link>
          <Link
            href={`/projects?unitId=${unit.id}&buildingId=${unit.buildingId}&category=TURNOVER`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-text-muted hover:bg-card-hover hover:text-text-primary transition-colors"
          >
            <Hammer className="w-3.5 h-3.5" />
            Create Project
          </Link>
          {unit.turnover && (
            <Link
              href={`/turnovers/${unit.turnover.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-text-muted hover:bg-card-hover hover:text-text-primary transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              View Turnover Detail
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function VacanciesContent() {
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterDays, setFilterDays] = useState<string>("");
  const [filterBuilding, setFilterBuilding] = useState<string>("");

  const { data: vacancies, isLoading } = useVacancies({
    status: filterStatus || undefined,
    daysVacant: filterDays || undefined,
  });
  const { data: buildings } = useBuildings();
  const { data: metrics } = useMetrics();

  const [rentModal, setRentModal] = useState<{ unitId: string; action: "propose" | "approve"; currentRent: number | null } | null>(null);

  // Apply local building filter (global selector already applies via API, this is for the additional dropdown)
  const filtered = useMemo(() => {
    if (!vacancies) return [];
    if (!filterBuilding) return vacancies;
    return vacancies.filter((u) => u.buildingId === filterBuilding);
  }, [vacancies, filterBuilding]);

  // KPI counts from filtered data
  const kpis = useMemo(() => {
    const all = vacancies || [];
    return {
      total: all.length,
      inTurnover: all.filter((u) => u.vacancyStatus === "TURNOVER" || u.vacancyStatus === "PRE_TURNOVER").length,
      readyToShow: all.filter((u) => u.vacancyStatus === "READY_TO_SHOW").length,
      pendingApproval: all.filter((u) => u.vacancyStatus === "RENT_PROPOSED").length,
      listed: all.filter((u) => u.vacancyStatus === "LISTED").length,
      critical90: all.filter((u) => u.daysVacant !== null && u.daysVacant > 90).length,
    };
  }, [vacancies]);

  const lostRent = metrics?.lostRent || 0;

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-display tracking-wide">Vacancies</h1>
          <span className="text-[10px] text-text-dim tracking-[0.2em] uppercase hidden sm:inline">// Vacancy & Turnover Command Center</span>
        </div>
        <ExportButton
          data={filtered.map((u) => ({
            address: u.buildingAddress,
            unit: u.unitNumber,
            status: getStatusConfig(u.vacancyStatus).label,
            daysVacant: u.daysVacant ?? "—",
            legalRent: u.legalRent ?? "—",
            proposedRent: u.proposedRent ?? "—",
            approvedRent: u.approvedRent ?? "—",
            assigned: u.turnover?.assignedToName ?? "—",
            cost: u.turnover?.estimatedCost ?? "—",
          }))}
          filename="vacancy-command-center"
          columns={[
            { key: "address", label: "Property" },
            { key: "unit", label: "Unit" },
            { key: "status", label: "Status" },
            { key: "daysVacant", label: "Days Vacant" },
            { key: "legalRent", label: "Legal Rent" },
            { key: "proposedRent", label: "Proposed" },
            { key: "approvedRent", label: "Approved" },
            { key: "assigned", label: "Assigned" },
            { key: "cost", label: "Est. Cost" },
          ]}
          pdfConfig={{
            title: "Vacancy Command Center",
            stats: [
              { label: "Total Vacant", value: String(kpis.total) },
              { label: "In Turnover", value: String(kpis.inTurnover) },
              { label: "90+ Days", value: String(kpis.critical90) },
              { label: "Lost Rent/Mo", value: fmt$(lostRent) },
            ],
          }}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total Vacant" value={kpis.total} icon={DoorOpen} color="#F59E0B" />
        <KpiCard label="In Turnover" value={kpis.inTurnover} icon={Wrench} color="#3B82F6" />
        <KpiCard label="Ready to Show" value={kpis.readyToShow} icon={CheckCircle} color="#14B8A6" />
        <KpiCard label="Pending Approval" value={kpis.pendingApproval} icon={Clock} color="#EAB308" />
        <KpiCard label="Listed" value={kpis.listed} icon={Tag} color="#A855F7" />
        <KpiCard label="90+ Days" value={kpis.critical90} icon={AlertTriangle} color="#EF4444" />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {buildings && buildings.length > 1 && (
          <select
            value={filterBuilding}
            onChange={(e) => setFilterBuilding(e.target.value)}
            className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="">All Properties</option>
            {buildings.filter((b) => b.vacant > 0).map((b) => (
              <option key={b.id} value={b.id}>{b.address}</option>
            ))}
          </select>
        )}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">All Statuses</option>
          {VACANCY_STATUSES.filter((s) => s.value !== "OCCUPIED").map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={filterDays}
          onChange={(e) => setFilterDays(e.target.value)}
          className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">All Days</option>
          <option value="30">0–30 days</option>
          <option value="60">31–60 days</option>
          <option value="90">61–90 days</option>
          <option value="90plus">90+ days</option>
        </select>
        {(filterStatus || filterDays || filterBuilding) && (
          <button
            onClick={() => { setFilterStatus(""); setFilterDays(""); setFilterBuilding(""); }}
            className="text-xs text-accent hover:text-accent-light transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Main Table */}
      {filtered.length > 0 ? (
        <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[1200px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase sticky top-0 bg-atlas-navy-3">Address</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase sticky top-0 bg-atlas-navy-3">Unit</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-text-dim uppercase sticky top-0 bg-atlas-navy-3">BR</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-text-dim uppercase sticky top-0 bg-atlas-navy-3">BA</th>
                <th className="px-2 py-2 text-right text-xs font-medium text-text-dim uppercase sticky top-0 bg-atlas-navy-3">SF</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase sticky top-0 bg-atlas-navy-3">Status</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase sticky top-0 bg-atlas-navy-3">Days Vacant</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase sticky top-0 bg-atlas-navy-3">Days Ready</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase sticky top-0 bg-atlas-navy-3">Legal Rent</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase sticky top-0 bg-atlas-navy-3">Proposed</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase sticky top-0 bg-atlas-navy-3">Approved</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase sticky top-0 bg-atlas-navy-3">Assigned</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase sticky top-0 bg-atlas-navy-3">Cost</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-text-dim uppercase sticky top-0 bg-atlas-navy-3">Access</th>
                <th className="px-2 py-2 w-8 sticky top-0 bg-atlas-navy-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} className={`border-b border-border/50 last:border-0 hover:bg-card-hover transition-colors ${i % 2 === 1 ? "bg-white/[0.02]" : ""}`}>
                  <td className="px-3 py-2 text-text-primary max-w-[180px] truncate" title={u.buildingAddress}>
                    {u.buildingAddress}
                  </td>
                  <td className="px-3 py-2 text-text-primary font-mono font-bold">{u.unitNumber}</td>
                  <td className="px-2 py-2 text-center text-text-dim text-xs">
                    {u.bedroomCount != null ? `${u.bedroomCount}BR` : "—"}
                  </td>
                  <td className="px-2 py-2 text-center text-text-dim text-xs">
                    {u.bathroomCount != null ? `${u.bathroomCount}BA` : "—"}
                  </td>
                  <td className="px-2 py-2 text-right text-text-dim text-xs font-mono">
                    {u.squareFeet ? `${u.squareFeet} sf` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusSelector unitId={u.id} currentStatus={u.vacancyStatus} />
                  </td>
                  <td className={`px-3 py-2 text-right font-mono tabular-nums ${getDaysColor(u.daysVacant)}`}>
                    {u.daysVacant !== null ? `${u.daysVacant}d` : "—"}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono tabular-nums ${getDaysColor(u.daysSinceReady)}`}>
                    {u.daysSinceReady !== null ? `${u.daysSinceReady}d` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-text-muted">
                    {u.legalRent ? fmt$(u.legalRent) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {u.proposedRent ? (
                      <span className="font-mono tabular-nums">
                        <span className={u.approvedRent ? "text-green-400" : "text-accent"}>{fmt$(u.proposedRent)}</span>
                        {!u.approvedRent && (
                          <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 uppercase">Pending</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-text-dim">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {u.approvedRent ? (
                      <span className="font-mono tabular-nums text-green-400 flex items-center justify-end gap-1">
                        {fmt$(u.approvedRent)}
                        <CheckCircle className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="text-text-dim">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-muted text-xs">
                    {u.turnover?.assignedToName || <span className="text-text-dim">Unassigned</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-text-muted">
                    {u.turnover?.estimatedCost ? fmt$(u.turnover.estimatedCost) : "—"}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <AccessCell unit={u} />
                  </td>
                  <td className="px-2 py-2">
                    <ActionsMenu
                      unit={u}
                      onProposeRent={() => setRentModal({ unitId: u.id, action: "propose", currentRent: u.proposedRent || u.bestRent || null })}
                      onApproveRent={() => setRentModal({ unitId: u.id, action: "approve", currentRent: u.proposedRent })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No vacancies"
          description={filterStatus || filterDays ? "No units match the selected filters" : "All units are currently occupied"}
          icon={DoorOpen}
        />
      )}

      {/* Rent Modal */}
      {rentModal && (
        <RentModal
          unitId={rentModal.unitId}
          action={rentModal.action}
          currentRent={rentModal.currentRent}
          onClose={() => setRentModal(null)}
        />
      )}
    </div>
  );
}
