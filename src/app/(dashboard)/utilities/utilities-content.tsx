"use client";

import { useState, useMemo } from "react";
import { Gauge, Plus, AlertTriangle, DoorOpen, Eye } from "lucide-react";
import { useUtilityMeters, useUtilitySummary, useCreateMeter, type UtilityMeterView } from "@/hooks/use-utilities";
import { useBuildings } from "@/hooks/use-buildings";
import { useAppStore } from "@/stores/app-store";
import StatCard from "@/components/ui/stat-card";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { PageSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import { riskFlagColor, riskFlagLabel } from "@/lib/utility-risk";
import type { UtilityRiskFlag } from "@/lib/utility-risk";
import MeterDetailModal from "./meter-detail-modal";

const UTILITY_TYPES = ["electric", "gas", "water", "common_electric", "common_gas"];
const PARTY_TYPES = ["tenant", "owner", "management", "unknown"];
const RISK_OPTIONS = ["ok", "unassigned", "missing_account_number", "missing_meter_number", "occupied_owner_paid", "vacant_tenant_account", "closed_with_balance"];

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
  const { data: meters, isLoading } = useUtilityMeters();
  const { data: summary } = useUtilitySummary();
  const { data: buildings } = useBuildings();
  const { selectedBuildingId } = useAppStore();

  const [filterType, setFilterType] = useState("");
  const [filterRisk, setFilterRisk] = useState("");
  const [filterParty, setFilterParty] = useState("");
  const [filterOccupancy, setFilterOccupancy] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [detailMeterId, setDetailMeterId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = meters || [];
    if (filterType) list = list.filter((m) => m.utilityType === filterType);
    if (filterRisk) list = list.filter((m) => m.riskFlag === filterRisk);
    if (filterParty) list = list.filter((m) => m.assignedPartyType === filterParty);
    if (filterOccupancy === "vacant") list = list.filter((m) => m.isVacant === true);
    if (filterOccupancy === "occupied") list = list.filter((m) => m.isVacant === false);
    if (filterOccupancy === "common") list = list.filter((m) => m.unitId === null);
    return list;
  }, [meters, filterType, filterRisk, filterParty, filterOccupancy]);

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Utility Compliance</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-3.5 h-3.5" /> Add Meter
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Active Meters" value={summary.totalMeters} icon={Gauge} />
          <StatCard label="Assigned" value={summary.assigned} />
          <StatCard label="Unassigned" value={summary.unassigned} color={summary.unassigned > 0 ? "#c9a84c" : undefined} />
          <StatCard label="Vacant + Tenant Acct" value={summary.vacantTenantAccount} color={summary.vacantTenantAccount > 0 ? "#e05c5c" : undefined} icon={AlertTriangle} />
          <StatCard label="Occupied + Owner Paid" value={summary.occupiedOwnerPaid} color={summary.occupiedOwnerPaid > 0 ? "#e09a3e" : undefined} />
          <StatCard label="Missing Acct #" value={summary.missingAccountNumber} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
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
        <span className="text-xs text-text-dim ml-auto">{filtered.length} meters</span>
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-card-gradient border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Building</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Unit</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Provider</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Meter #</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Account #</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Assigned To</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Occupancy</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Risk</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-border/50 hover:bg-card-hover cursor-pointer transition-colors"
                  onClick={() => setDetailMeterId(m.id)}
                >
                  <td className="px-3 py-2 text-text-primary truncate max-w-[180px]">{m.buildingAddress}</td>
                  <td className="px-3 py-2 text-text-muted">{m.unitNumber || "Common"}</td>
                  <td className="px-3 py-2 text-text-muted">{utTypeLabel(m.utilityType)}</td>
                  <td className="px-3 py-2 text-text-muted">{m.providerName || "—"}</td>
                  <td className="px-3 py-2 text-text-muted font-mono text-xs">{m.meterNumber || "—"}</td>
                  <td className="px-3 py-2 text-text-muted font-mono text-xs">{m.accountNumber || "—"}</td>
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
