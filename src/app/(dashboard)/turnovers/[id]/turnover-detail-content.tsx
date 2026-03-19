"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { useTurnover, useUpdateTurnover, useAddVendorAssignment, useUpdateVendorAssignment } from "@/hooks/use-turnovers";
import { PageSkeleton } from "@/components/ui/skeleton";
import ExportButton from "@/components/ui/export-button";
import { fmt$ } from "@/lib/utils";

const STATUSES = [
  "PENDING_INSPECTION",
  "INSPECTION_DONE",
  "SCOPE_CREATED",
  "VENDORS_ASSIGNED",
  "READY_TO_LIST",
  "LISTED",
  "COMPLETE",
] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING_INSPECTION: "Pending Inspection",
  INSPECTION_DONE: "Inspection Done",
  SCOPE_CREATED: "Scope Created",
  VENDORS_ASSIGNED: "Vendors Assigned",
  READY_TO_LIST: "Ready to List",
  LISTED: "Listed",
  COMPLETE: "Complete",
};

const CHECKLIST_ITEMS = ["Walls", "Floors", "Appliances", "Plumbing", "Electric", "HVAC", "Doors/Windows", "Cleaning"];
const TRADES = ["paint", "plumbing", "electric", "hvac", "flooring", "general", "cleaning", "other"];

export default function TurnoverDetailContent({ id }: { id: string }) {
  const { data: turnover, isLoading } = useTurnover(id);
  const updateMutation = useUpdateTurnover();
  const addVendorMutation = useAddVendorAssignment();
  const updateVendorMutation = useUpdateVendorAssignment();

  const [showAddVendor, setShowAddVendor] = useState(false);
  const [vendorForm, setVendorForm] = useState({ vendorName: "", trade: "general", scheduledDate: "", cost: "", notes: "" });

  if (isLoading) return <PageSkeleton />;

  if (!turnover) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-text-primary mb-2">Turnover not found</p>
        <p className="text-sm text-text-muted mb-4">This turnover may have been removed or you may not have access to it.</p>
        <Link href="/turnovers" className="text-accent hover:text-accent-light text-sm font-medium transition-colors">
          Back to Turnovers
        </Link>
      </div>
    );
  }

  const daysActive = Math.ceil((Date.now() - new Date(turnover.createdAt).getTime()) / 86400000);
  const statusIndex = STATUSES.indexOf(turnover.status as typeof STATUSES[number]);
  const checklist: Record<string, string> = turnover.inspectionChecklist || {};

  function advanceStatus() {
    const nextIndex = statusIndex + 1;
    if (nextIndex < STATUSES.length) {
      updateMutation.mutate({ id, status: STATUSES[nextIndex] });
    }
  }

  function saveField(field: string, value: any) {
    updateMutation.mutate({ id, [field]: value });
  }

  function saveChecklist(item: string, value: string) {
    const updated = { ...checklist, [item]: value };
    updateMutation.mutate({ id, inspectionChecklist: updated });
  }

  function handleAddVendor() {
    addVendorMutation.mutate({
      turnoverId: id,
      vendorName: vendorForm.vendorName,
      trade: vendorForm.trade,
      scheduledDate: vendorForm.scheduledDate || undefined,
      cost: vendorForm.cost ? parseFloat(vendorForm.cost) : undefined,
      notes: vendorForm.notes || undefined,
    }, {
      onSuccess: () => {
        setShowAddVendor(false);
        setVendorForm({ vendorName: "", trade: "general", scheduledDate: "", cost: "", notes: "" });
      },
    });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/turnovers" className="text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {turnover.building.address} #{turnover.unit.unitNumber}
            </h1>
            <p className="text-sm text-text-muted">
              {daysActive} days active &middot; {turnover.triggeredBy === "AUTO" ? "Auto-created" : "Manual"} &middot; {STATUS_LABELS[turnover.status]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={turnover.vendorAssignments.map((v) => ({
              trade: v.trade,
              vendor: v.vendorName,
              status: v.status,
              scheduledDate: v.scheduledDate ? new Date(v.scheduledDate).toLocaleDateString() : "—",
              cost: v.cost ? fmt$(v.cost) : "—",
            }))}
            filename={`turnover-${turnover.unit.unitNumber}`}
            columns={[
              { key: "trade", label: "Trade" },
              { key: "vendor", label: "Vendor" },
              { key: "status", label: "Status" },
              { key: "scheduledDate", label: "Scheduled" },
              { key: "cost", label: "Cost" },
            ]}
            pdfConfig={{
              title: `Turnover — ${turnover.building.address} #${turnover.unit.unitNumber}`,
              stats: [
                { label: "Status", value: STATUS_LABELS[turnover.status] },
                { label: "Days Active", value: String(daysActive) },
                { label: "Est. Cost", value: turnover.estimatedCost ? fmt$(turnover.estimatedCost) : "N/A" },
                { label: "Vendors", value: String(turnover.vendorAssignments.length) },
              ],
            }}
          />
          {statusIndex < STATUSES.length - 1 && (
            <button
              onClick={advanceStatus}
              disabled={updateMutation.isPending}
              className="bg-accent hover:bg-accent-light text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              Advance to {STATUS_LABELS[STATUSES[statusIndex + 1]]}
            </button>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-text-muted mb-4">Progress</h3>
        <div className="flex items-center gap-1">
          {STATUSES.map((s, i) => {
            const done = i <= statusIndex;
            const current = i === statusIndex;
            return (
              <div key={s} className="flex-1 flex items-center">
                <div className="flex flex-col items-center w-full">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    done ? "bg-accent text-white" : "bg-border/50 text-text-dim"
                  } ${current ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""}`}>
                    {done ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <p className={`text-[9px] mt-1 text-center leading-tight ${done ? "text-accent" : "text-text-dim"}`}>
                    {STATUS_LABELS[s]}
                  </p>
                </div>
                {i < STATUSES.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 mt-[-16px] ${i < statusIndex ? "bg-accent" : "bg-border/50"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inspection Section */}
        <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-muted mb-4">Inspection</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-dim mb-1">Inspection Date</label>
              <input
                type="date"
                defaultValue={turnover.inspectionDate ? new Date(turnover.inspectionDate).toISOString().split("T")[0] : ""}
                onBlur={(e) => saveField("inspectionDate", e.target.value || null)}
                className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary w-full focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1">Notes</label>
              <textarea
                defaultValue={turnover.inspectionNotes || ""}
                onBlur={(e) => saveField("inspectionNotes", e.target.value || null)}
                rows={3}
                className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary w-full focus:outline-none focus:border-accent resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-2">Checklist</label>
              <div className="grid grid-cols-2 gap-2">
                {CHECKLIST_ITEMS.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="text-xs text-text-muted w-24 shrink-0">{item}</span>
                    <select
                      defaultValue={checklist[item] || ""}
                      onChange={(e) => saveChecklist(item, e.target.value)}
                      className="bg-bg border border-border rounded px-2 py-1 text-xs text-text-primary flex-1 focus:outline-none focus:border-accent"
                    >
                      <option value="">—</option>
                      <option value="good">Good</option>
                      <option value="needs-work">Needs Work</option>
                      <option value="replace">Replace</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Scope of Work */}
        <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-muted mb-4">Scope of Work</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-dim mb-1">Description</label>
              <textarea
                defaultValue={turnover.scopeOfWork || ""}
                onBlur={(e) => saveField("scopeOfWork", e.target.value || null)}
                rows={6}
                className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary w-full focus:outline-none focus:border-accent resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1">Estimated Cost</label>
              <input
                type="number"
                step="0.01"
                defaultValue={turnover.estimatedCost ?? ""}
                onBlur={(e) => saveField("estimatedCost", e.target.value ? parseFloat(e.target.value) : null)}
                className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary w-full focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1">Listed Date</label>
              <input
                type="date"
                defaultValue={turnover.listedDate ? new Date(turnover.listedDate).toISOString().split("T")[0] : ""}
                onBlur={(e) => saveField("listedDate", e.target.value || null)}
                className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary w-full focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Vendor Assignments */}
      <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text-muted">Vendor Assignments</h3>
          <button
            onClick={() => setShowAddVendor(true)}
            className="flex items-center gap-1 text-xs text-accent hover:text-accent-light transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Vendor
          </button>
        </div>

        {showAddVendor && (
          <div className="bg-bg border border-border rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-dim mb-1">Vendor Name *</label>
                <input
                  value={vendorForm.vendorName}
                  onChange={(e) => setVendorForm({ ...vendorForm, vendorName: e.target.value })}
                  className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary w-full focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-text-dim mb-1">Trade *</label>
                <select
                  value={vendorForm.trade}
                  onChange={(e) => setVendorForm({ ...vendorForm, trade: e.target.value })}
                  className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary w-full focus:outline-none focus:border-accent"
                >
                  {TRADES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-dim mb-1">Scheduled Date</label>
                <input
                  type="date"
                  value={vendorForm.scheduledDate}
                  onChange={(e) => setVendorForm({ ...vendorForm, scheduledDate: e.target.value })}
                  className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary w-full focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-text-dim mb-1">Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={vendorForm.cost}
                  onChange={(e) => setVendorForm({ ...vendorForm, cost: e.target.value })}
                  className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary w-full focus:outline-none focus:border-accent"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddVendor(false)} className="text-xs text-text-muted hover:text-text-primary px-3 py-1.5">Cancel</button>
              <button
                onClick={handleAddVendor}
                disabled={!vendorForm.vendorName || addVendorMutation.isPending}
                className="bg-accent hover:bg-accent-light text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {turnover.vendorAssignments.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-dim">
                <th className="text-left py-1.5 font-medium">Trade</th>
                <th className="text-left py-1.5 font-medium">Vendor</th>
                <th className="text-left py-1.5 font-medium">Status</th>
                <th className="text-left py-1.5 font-medium">Scheduled</th>
                <th className="text-right py-1.5 font-medium">Cost</th>
                <th className="py-1.5 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {turnover.vendorAssignments.map((va) => (
                <tr key={va.id} className="border-b border-border/50 last:border-0">
                  <td className="py-2 text-text-primary capitalize">{va.trade}</td>
                  <td className="py-2 text-text-muted">{va.vendorName}</td>
                  <td className="py-2">
                    <select
                      defaultValue={va.status}
                      onChange={(e) => updateVendorMutation.mutate({
                        turnoverId: id,
                        assignmentId: va.id,
                        status: e.target.value,
                        completedDate: e.target.value === "COMPLETED" ? new Date().toISOString() : undefined,
                      })}
                      className="bg-bg border border-border rounded px-2 py-0.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </td>
                  <td className="py-2 text-text-muted text-xs">
                    {va.scheduledDate ? new Date(va.scheduledDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2 text-right text-text-muted font-mono tabular-nums">
                    {va.cost ? fmt$(va.cost) : "—"}
                  </td>
                  <td className="py-2 text-right">
                    {va.status === "COMPLETED" && <Check className="w-4 h-4 text-green-400 inline" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-text-dim text-center py-4">No vendors assigned yet</p>
        )}

        {turnover.vendorAssignments.length > 0 && (
          <div className="flex justify-end mt-3 pt-3 border-t border-border">
            <span className="text-sm text-text-muted">
              Total vendor cost: <span className="font-bold text-text-primary font-mono">
                {fmt$(turnover.vendorAssignments.reduce((s, va) => s + Number(va.cost || 0), 0))}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
