"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Gauge, Plus, AlertTriangle, Eye, CheckCircle2, XCircle, MinusCircle, ArrowRightLeft } from "lucide-react";
import { useUtilityMeters, useUtilitySummary, useCreateMeter, type UtilityMeterView } from "@/hooks/use-utilities";
import { useBuildings } from "@/hooks/use-buildings";
import { useAppStore } from "@/stores/app-store";
import StatCard from "@/components/ui/stat-card";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { PageSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import ExportButton from "@/components/ui/export-button";
import { riskFlagColor, riskFlagLabel } from "@/lib/utility-risk";
import type { UtilityRiskFlag } from "@/lib/utility-risk";
import { formatDate } from "@/lib/utils";
import MeterDetailModal from "./meter-detail-modal";

const UTILITY_TYPES = ["electric", "gas", "water", "common_electric", "common_gas"];
const PARTY_TYPES = ["tenant", "owner", "management", "unknown"];
const RISK_OPTIONS = ["ok", "transfer_needed", "unassigned", "missing_account_number", "missing_meter_number", "meter_missing_unit", "occupied_owner_paid", "vacant_tenant_account", "closed_with_balance"];
const CHECK_STATUS_OPTIONS = [
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
  { value: "not_recorded", label: "Not Recorded" },
];

function RiskBadge({ flag }: { flag: string }) {
  const color = riskFlagColor(flag as UtilityRiskFlag);
  const label = riskFlagLabel(flag as UtilityRiskFlag);
  const colorClasses: Record<string, string> = {
    red: "bg-red-500/10 text-red-400",
    amber: "bg-amber-500/10 text-amber-400",
    yellow: "bg-yellow-500/10 text-yellow-400",
    green: "bg-green-500/10 text-green-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${colorClasses[color]}`}>
      {label}
    </span>
  );
}

function CheckStatusBadge({ status }: { status: string }) {
  if (status === "paid") return <span className="inline-flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="w-3 h-3" /> Paid</span>;
  if (status === "unpaid") return <span className="inline-flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3 h-3" /> Unpaid</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-text-dim"><MinusCircle className="w-3 h-3" /> Not Recorded</span>;
}

function TransferBadge({ reason }: { reason: string | null }) {
  if (!reason) return null;
  const label = reason === "moved_out" ? "Moved Out" : "Lease Expired";
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 whitespace-nowrap">
      <ArrowRightLeft className="w-3 h-3" /> {label}
    </span>
  );
}

function utTypeLabel(t: string): string {
  const map: Record<string, string> = {
    electric: "Electric",
    gas: "Gas",
    water: "Water",
    common_electric: "Common Electric",
    common_gas: "Common Gas",
  };
  return map[t] || t;
}

export default function UtilitiesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: meters, isLoading } = useUtilityMeters();
  const { data: summary } = useUtilitySummary();
  const { data: buildings } = useBuildings();
  const { selectedBuildingId } = useAppStore();

  // Initialize filters from URL params
  const [filterType, setFilterType] = useState(searchParams.get("type") || "");
  const [filterRisk, setFilterRisk] = useState(searchParams.get("risk") || "");
  const [filterParty, setFilterParty] = useState(searchParams.get("party") || "");
  const [filterOccupancy, setFilterOccupancy] = useState(searchParams.get("occupancy") || "");
  const [filterCheckStatus, setFilterCheckStatus] = useState(searchParams.get("checkStatus") || "");
  const [filterBuildingId, setFilterBuildingId] = useState(searchParams.get("buildingId") || "");
  const [filterRiskOnly, setFilterRiskOnly] = useState(searchParams.get("riskOnly") === "1");
  const [filterTransfer, setFilterTransfer] = useState(searchParams.get("transfer") || "");
  const [showCreate, setShowCreate] = useState(false);
  const [detailMeterId, setDetailMeterId] = useState<string | null>(null);

  // Persist filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (filterRisk) params.set("risk", filterRisk);
    if (filterParty) params.set("party", filterParty);
    if (filterOccupancy) params.set("occupancy", filterOccupancy);
    if (filterCheckStatus) params.set("checkStatus", filterCheckStatus);
    if (filterBuildingId) params.set("buildingId", filterBuildingId);
    if (filterRiskOnly) params.set("riskOnly", "1");
    if (filterTransfer) params.set("transfer", filterTransfer);
    const qs = params.toString();
    router.replace(`/utilities${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [filterType, filterRisk, filterParty, filterOccupancy, filterCheckStatus, filterBuildingId, filterRiskOnly, filterTransfer, router]);

  const filtered = useMemo(() => {
    let list = meters || [];
    if (filterType) list = list.filter((m) => m.utilityType === filterType);
    if (filterRisk) list = list.filter((m) => m.riskFlag === filterRisk);
    if (filterParty) list = list.filter((m) => m.assignedPartyType === filterParty);
    if (filterOccupancy === "vacant") list = list.filter((m) => m.isVacant === true);
    if (filterOccupancy === "occupied") list = list.filter((m) => m.isVacant === false);
    if (filterOccupancy === "common") list = list.filter((m) => m.unitId === null);
    if (filterCheckStatus) list = list.filter((m) => m.currentMonthCheckStatus === filterCheckStatus);
    if (filterBuildingId) list = list.filter((m) => m.buildingId === filterBuildingId);
    if (filterRiskOnly) list = list.filter((m) => m.riskFlag !== "ok");
    if (filterTransfer === "all") list = list.filter((m) => m.transferNeeded);
    if (filterTransfer === "moved_out") list = list.filter((m) => m.transferReason === "moved_out");
    if (filterTransfer === "lease_expired") list = list.filter((m) => m.transferReason === "lease_expired");

    // Default sort: transfer needed first, then risk signals, then no-check, then oldest last check
    list = [...list].sort((a, b) => {
      const aTransfer = a.transferNeeded ? 0 : 1;
      const bTransfer = b.transferNeeded ? 0 : 1;
      if (aTransfer !== bTransfer) return aTransfer - bTransfer;

      const aHasRisk = a.riskFlag !== "ok" ? 0 : 1;
      const bHasRisk = b.riskFlag !== "ok" ? 0 : 1;
      if (aHasRisk !== bHasRisk) return aHasRisk - bHasRisk;

      const aNoCheck = a.currentMonthCheckStatus === "not_recorded" ? 0 : 1;
      const bNoCheck = b.currentMonthCheckStatus === "not_recorded" ? 0 : 1;
      if (aNoCheck !== bNoCheck) return aNoCheck - bNoCheck;

      const aDate = a.lastCheckDate ? new Date(a.lastCheckDate).getTime() : 0;
      const bDate = b.lastCheckDate ? new Date(b.lastCheckDate).getTime() : 0;
      return aDate - bDate;
    });

    return list;
  }, [meters, filterType, filterRisk, filterParty, filterOccupancy, filterCheckStatus, filterBuildingId, filterRiskOnly, filterTransfer]);

  // Export data
  const exportData = useMemo(() => {
    return filtered.map((m) => ({
      building: m.buildingAddress,
      unit: m.unitNumber || "Common",
      meterType: utTypeLabel(m.utilityType),
      provider: m.providerName || "—",
      accountParty: m.assignedPartyName || m.assignedPartyType || "—",
      accountStatus: m.accountStatus || "unassigned",
      checkStatus: m.currentMonthCheckStatus === "paid" ? "Paid" : m.currentMonthCheckStatus === "unpaid" ? "Unpaid" : "Not Recorded",
      lastCheckDate: m.lastCheckDate ? formatDate(m.lastCheckDate) : "—",
      transfer: m.transferNeeded ? (m.transferReason === "moved_out" ? "Moved Out" : "Lease Expired") : "—",
      risk: riskFlagLabel(m.riskFlag as UtilityRiskFlag),
    }));
  }, [filtered]);

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Utility Compliance</h1>
        <div className="flex items-center gap-2">
          <ExportButton
            data={exportData}
            filename="utilities-export"
            columns={[
              { key: "building", label: "Building" },
              { key: "unit", label: "Unit" },
              { key: "meterType", label: "Meter Type" },
              { key: "provider", label: "Provider" },
              { key: "accountParty", label: "Account Party" },
              { key: "accountStatus", label: "Account Status" },
              { key: "checkStatus", label: "This Month" },
              { key: "lastCheckDate", label: "Last Check" },
              { key: "transfer", label: "Transfer" },
              { key: "risk", label: "Risk" },
            ]}
            pdfConfig={{
              title: "Utility Compliance Report",
              stats: [
                { label: "Active Accounts", value: String(summary?.activeAccounts || 0) },
                { label: "Paid This Month", value: String(summary?.paidThisMonth || 0) },
                { label: "Unpaid", value: String(summary?.unpaidThisMonth || 0) },
                { label: "Not Recorded", value: String(summary?.noCheckThisMonth || 0) },
              ],
            }}
          />
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Meter
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Active Accounts" value={summary.activeAccounts} icon={Gauge} />
          <StatCard label="Paid This Month" value={summary.paidThisMonth} color="#4caf82" />
          <StatCard label="Unpaid This Month" value={summary.unpaidThisMonth} color={summary.unpaidThisMonth > 0 ? "#e05c5c" : undefined} />
          <StatCard label="Not Recorded" value={summary.noCheckThisMonth} color={summary.noCheckThisMonth > 0 ? "#e09a3e" : undefined} />
          <StatCard label="Transfer Needed" value={summary.transferNeeded} color={summary.transferNeeded > 0 ? "#e05c5c" : undefined} icon={ArrowRightLeft} />
          <StatCard label="Risk Signals" value={summary.withRiskSignals} color={summary.withRiskSignals > 0 ? "#e05c5c" : undefined} icon={AlertTriangle} />
        </div>
      )}

      {/* Building Rollup */}
      {summary && summary.buildingRollup.length > 1 && (
        <div className="bg-card-gradient border border-border rounded-xl overflow-x-auto">
          <div className="px-3 py-2 border-b border-border">
            <h3 className="text-sm font-medium text-text-muted">Building Summary</h3>
          </div>
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Building</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Accounts</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Unpaid</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Not Recorded</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Transfer</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Risk</th>
              </tr>
            </thead>
            <tbody>
              {summary.buildingRollup.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-border/50 hover:bg-card-hover cursor-pointer transition-colors"
                  onClick={() => setFilterBuildingId(filterBuildingId === b.id ? "" : b.id)}
                >
                  <td className={`px-3 py-1.5 text-text-primary ${filterBuildingId === b.id ? "font-semibold text-accent" : ""}`}>{b.address}</td>
                  <td className="px-3 py-1.5 text-right text-text-muted font-mono">{b.totalAccounts}</td>
                  <td className={`px-3 py-1.5 text-right font-mono ${b.unpaidThisMonth > 0 ? "text-red-400" : "text-text-muted"}`}>{b.unpaidThisMonth}</td>
                  <td className={`px-3 py-1.5 text-right font-mono ${b.noCheckThisMonth > 0 ? "text-amber-400" : "text-text-muted"}`}>{b.noCheckThisMonth}</td>
                  <td className={`px-3 py-1.5 text-right font-mono ${b.transferNeeded > 0 ? "text-red-400" : "text-text-muted"}`}>{b.transferNeeded}</td>
                  <td className={`px-3 py-1.5 text-right font-mono ${b.riskCount > 0 ? "text-red-400" : "text-text-muted"}`}>{b.riskCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {buildings && buildings.length > 1 && (
          <select value={filterBuildingId} onChange={(e) => setFilterBuildingId(e.target.value)} className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
            <option value="">All Buildings</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.address}</option>)}
          </select>
        )}
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="">All Types</option>
          {UTILITY_TYPES.map((t) => <option key={t} value={t}>{utTypeLabel(t)}</option>)}
        </select>
        <select value={filterParty} onChange={(e) => setFilterParty(e.target.value)} className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="">All Parties</option>
          {PARTY_TYPES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
        <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="">All Risk Levels</option>
          {RISK_OPTIONS.map((r) => <option key={r} value={r}>{riskFlagLabel(r as UtilityRiskFlag)}</option>)}
        </select>
        <select value={filterOccupancy} onChange={(e) => setFilterOccupancy(e.target.value)} className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="">All Occupancy</option>
          <option value="occupied">Occupied</option>
          <option value="vacant">Vacant</option>
          <option value="common">Common Area</option>
        </select>
        <select value={filterCheckStatus} onChange={(e) => setFilterCheckStatus(e.target.value)} className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="">All Check Status</option>
          {CHECK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterTransfer} onChange={(e) => setFilterTransfer(e.target.value)} className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="">All Transfer Status</option>
          <option value="all">Transfer Needed</option>
          <option value="moved_out">Moved Out</option>
          <option value="lease_expired">Lease Expired</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-text-muted cursor-pointer">
          <input type="checkbox" checked={filterRiskOnly} onChange={(e) => setFilterRiskOnly(e.target.checked)} className="accent-accent" />
          Risk only
        </label>
        <span className="text-xs text-text-dim ml-auto">{filtered.length} meters</span>
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-card-gradient border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Building</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Unit</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Provider</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Account Party</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">This Month</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Last Check</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Transfer</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Risk</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr
                  key={m.id}
                  className={`border-b border-border/50 hover:bg-card-hover cursor-pointer transition-colors ${i % 2 === 1 ? "bg-white/[0.02]" : ""}`}
                  onClick={() => setDetailMeterId(m.id)}
                >
                  <td className="px-3 py-2 text-text-primary truncate max-w-[180px]">{m.buildingAddress}</td>
                  <td className="px-3 py-2 text-text-muted">{m.unitNumber || "Common"}</td>
                  <td className="px-3 py-2 text-text-muted">{utTypeLabel(m.utilityType)}</td>
                  <td className="px-3 py-2 text-text-muted">{m.providerName || "—"}</td>
                  <td className="px-3 py-2 text-text-muted">{m.assignedPartyName || m.assignedPartyType || "—"}</td>
                  <td className="px-3 py-2">
                    {m.unitId === null ? (
                      <span className="text-xs text-text-dim">Common</span>
                    ) : m.isVacant ? (
                      <span className="text-xs text-amber-400">Vacant</span>
                    ) : (
                      <span className="text-xs text-green-400">Occupied</span>
                    )}
                  </td>
                  <td className="px-3 py-2"><CheckStatusBadge status={m.currentMonthCheckStatus} /></td>
                  <td className="px-3 py-2 text-text-muted text-xs font-mono">{m.lastCheckDate ? formatDate(m.lastCheckDate) : "—"}</td>
                  <td className="px-3 py-2"><TransferBadge reason={m.transferReason} /></td>
                  <td className="px-3 py-2"><RiskBadge flag={m.riskFlag} /></td>
                  <td className="px-3 py-2">
                    <button className="p-1 text-text-dim hover:text-accent" title="View">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No utility meters"
          description="Add meters to track utility account compliance for move-ins and move-outs"
          icon={Gauge}
        />
      )}

      {/* Create Meter Modal */}
      <CreateMeterModal open={showCreate} onClose={() => setShowCreate(false)} buildings={buildings} />

      {/* Meter Detail Modal */}
      <MeterDetailModal meterId={detailMeterId} onClose={() => setDetailMeterId(null)} />
    </div>
  );
}

function CreateMeterModal({ open, onClose, buildings }: { open: boolean; onClose: () => void; buildings: any[] | undefined }) {
  const createMeter = useCreateMeter();
  const { selectedBuildingId } = useAppStore();
  const [form, setForm] = useState({
    buildingId: selectedBuildingId || "",
    unitId: "",
    utilityType: "electric",
    providerName: "",
    meterNumber: "",
    serviceAddress: "",
    notes: "",
  });
  const [units, setUnits] = useState<{ id: string; unitNumber: string }[]>([]);

  // Fetch units when building changes
  const handleBuildingChange = async (buildingId: string) => {
    setForm({ ...form, buildingId, unitId: "" });
    if (!buildingId) { setUnits([]); return; }
    try {
      const res = await fetch(`/api/units?buildingId=${buildingId}`);
      if (res.ok) {
        const data = await res.json();
        setUnits(data.map((u: any) => ({ id: u.id, unitNumber: u.unitNumber })));
      }
    } catch { setUnits([]); }
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMeter.mutate(
      {
        buildingId: form.buildingId,
        unitId: form.unitId || undefined,
        utilityType: form.utilityType,
        providerName: form.providerName || undefined,
        meterNumber: form.meterNumber || undefined,
        serviceAddress: form.serviceAddress || undefined,
        notes: form.notes || undefined,
      },
      {
        onSuccess: () => {
          onClose();
          setForm({ buildingId: selectedBuildingId || "", unitId: "", utilityType: "electric", providerName: "", meterNumber: "", serviceAddress: "", notes: "" });
        },
      }
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Utility Meter">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-text-dim mb-1">Building *</label>
          <select
            value={form.buildingId}
            onChange={(e) => handleBuildingChange(e.target.value)}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            required
          >
            <option value="">Select building...</option>
            {buildings?.map((b) => <option key={b.id} value={b.id}>{b.address}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs text-text-dim mb-1">Unit (leave empty for common area)</label>
          <select
            value={form.unitId}
            onChange={(e) => setForm({ ...form, unitId: e.target.value })}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="">Common Area / Building-level</option>
            {units.map((u: any) => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-dim mb-1">Utility Type *</label>
            <select
              value={form.utilityType}
              onChange={(e) => setForm({ ...form, utilityType: e.target.value })}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              required
            >
              {UTILITY_TYPES.map((t) => <option key={t} value={t}>{utTypeLabel(t)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Provider</label>
            <input
              value={form.providerName}
              onChange={(e) => setForm({ ...form, providerName: e.target.value })}
              placeholder="e.g. Con Edison"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-dim mb-1">Meter Number</label>
            <input
              value={form.meterNumber}
              onChange={(e) => setForm({ ...form, meterNumber: e.target.value })}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Service Address</label>
            <input
              value={form.serviceAddress}
              onChange={(e) => setForm({ ...form, serviceAddress: e.target.value })}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-text-dim mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={createMeter.isPending}>
            {createMeter.isPending ? "Creating..." : "Create Meter"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
