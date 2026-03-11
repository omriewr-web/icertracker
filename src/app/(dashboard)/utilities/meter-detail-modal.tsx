"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, XCircle } from "lucide-react";
import { useUtilityMeter, useUpdateMeter, useDeleteMeter, useCreateAccount, useUpdateAccount } from "@/hooks/use-utilities";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { formatDate } from "@/lib/utils";
import { riskFlagColor, riskFlagLabel, computeRiskFlags, primaryRiskFlag } from "@/lib/utility-risk";
import type { UtilityRiskFlag } from "@/lib/utility-risk";

function RiskBadge({ flag }: { flag: string }) {
  const color = riskFlagColor(flag as UtilityRiskFlag);
  const label = riskFlagLabel(flag as UtilityRiskFlag);
  const colorClasses: Record<string, string> = {
    red: "bg-red-500/10 text-red-400",
    amber: "bg-amber-500/10 text-amber-400",
    yellow: "bg-yellow-500/10 text-yellow-400",
    green: "bg-green-500/10 text-green-400",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${colorClasses[color]}`}>{label}</span>;
}

const UTILITY_TYPES = ["electric", "gas", "water", "common_electric", "common_gas"];

function utTypeLabel(t: string): string {
  const map: Record<string, string> = { electric: "Electric", gas: "Gas", water: "Water", common_electric: "Common Electric", common_gas: "Common Gas" };
  return map[t] || t;
}

export default function MeterDetailModal({ meterId, onClose }: { meterId: string | null; onClose: () => void }) {
  const { data: meter, isLoading } = useUtilityMeter(meterId);
  const updateMeter = useUpdateMeter();
  const deleteMeter = useDeleteMeter();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [closeAccountId, setCloseAccountId] = useState<string | null>(null);
  const [closeWithBalance, setCloseWithBalance] = useState(false);
  const [closeNotes, setCloseNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);

  const [accountForm, setAccountForm] = useState({
    accountNumber: "",
    assignedPartyType: "tenant",
    assignedPartyName: "",
    tenantId: "",
    startDate: "",
    notes: "",
  });

  if (!meterId) return null;

  const activeAccounts = meter?.accounts?.filter((a: any) => a.status === "active") || [];
  const closedAccounts = meter?.accounts?.filter((a: any) => a.status === "closed") || [];

  const flags = meter ? computeRiskFlags({
    meterNumber: meter.meterNumber,
    isActive: meter.isActive,
    unit: meter.unit,
    accounts: meter.accounts || [],
  }) : ["ok"];
  const primary = primaryRiskFlag(flags as UtilityRiskFlag[]);

  function handleStartEdit() {
    setEditing(true);
    setEditForm({
      utilityType: meter.utilityType,
      providerName: meter.providerName || "",
      meterNumber: meter.meterNumber || "",
      serviceAddress: meter.serviceAddress || "",
      notes: meter.notes || "",
    });
  }

  function handleSaveEdit() {
    updateMeter.mutate({ id: meterId!, ...editForm }, {
      onSuccess: () => setEditing(false),
    });
  }

  function handleDelete() {
    deleteMeter.mutate(meterId!, {
      onSuccess: () => { setConfirmDelete(false); onClose(); },
    });
  }

  function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    createAccount.mutate(
      {
        utilityMeterId: meterId!,
        accountNumber: accountForm.accountNumber || undefined,
        assignedPartyType: accountForm.assignedPartyType,
        assignedPartyName: accountForm.assignedPartyName || undefined,
        tenantId: accountForm.tenantId || undefined,
        startDate: accountForm.startDate || undefined,
        notes: accountForm.notes || undefined,
      },
      {
        onSuccess: () => {
          setShowNewAccount(false);
          setAccountForm({ accountNumber: "", assignedPartyType: "tenant", assignedPartyName: "", tenantId: "", startDate: "", notes: "" });
        },
      }
    );
  }

  function handleCloseAccount() {
    if (!closeAccountId) return;
    updateAccount.mutate(
      {
        id: closeAccountId,
        status: "closed",
        endDate: new Date().toISOString(),
        closedWithBalance: closeWithBalance,
        notes: closeNotes || undefined,
      },
      {
        onSuccess: () => {
          setCloseAccountId(null);
          setCloseWithBalance(false);
          setCloseNotes("");
        },
      }
    );
  }

  return (
    <>
      <Modal open={!!meterId} onClose={onClose} title={meter ? `${utTypeLabel(meter.utilityType)} Meter — ${meter.unit?.unitNumber || "Common Area"}` : "Meter Details"} wide>
        {isLoading ? (
          <LoadingSpinner />
        ) : meter ? (
          <div className="space-y-5">
            {/* Actions */}
            <div className="flex items-center justify-between">
              <RiskBadge flag={primary} />
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleStartEdit}>
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </div>
            </div>

            {/* Meter Info */}
            {editing ? (
              <div className="bg-bg border border-border rounded-lg p-4 space-y-3">
                <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wider">Edit Meter</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-text-dim mb-1">Type</label>
                    <select value={editForm.utilityType} onChange={(e) => setEditForm({ ...editForm, utilityType: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
                      {UTILITY_TYPES.map((t) => <option key={t} value={t}>{utTypeLabel(t)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text-dim mb-1">Provider</label>
                    <input value={editForm.providerName} onChange={(e) => setEditForm({ ...editForm, providerName: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-dim mb-1">Meter #</label>
                    <input value={editForm.meterNumber} onChange={(e) => setEditForm({ ...editForm, meterNumber: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-dim mb-1">Service Address</label>
                    <input value={editForm.serviceAddress} onChange={(e) => setEditForm({ ...editForm, serviceAddress: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-text-dim mb-1">Notes</label>
                  <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveEdit} disabled={updateMeter.isPending}>Save</Button>
                </div>
              </div>
            ) : (
              <div className="bg-bg border border-border rounded-lg p-4">
                <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-2">Meter Info</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                  <div><span className="text-text-dim text-xs">Building</span><p className="text-text-primary">{meter.building?.address}</p></div>
                  <div><span className="text-text-dim text-xs">Unit</span><p className="text-text-primary">{meter.unit?.unitNumber || "Common Area"}</p></div>
                  <div><span className="text-text-dim text-xs">Type</span><p className="text-text-primary">{utTypeLabel(meter.utilityType)}</p></div>
                  <div><span className="text-text-dim text-xs">Provider</span><p className="text-text-primary">{meter.providerName || "—"}</p></div>
                  <div><span className="text-text-dim text-xs">Meter #</span><p className="text-text-primary font-mono text-xs">{meter.meterNumber || "—"}</p></div>
                  <div><span className="text-text-dim text-xs">Service Address</span><p className="text-text-primary">{meter.serviceAddress || "—"}</p></div>
                  {meter.notes && <div className="col-span-full"><span className="text-text-dim text-xs">Notes</span><p className="text-text-muted">{meter.notes}</p></div>}
                </div>
              </div>
            )}

            {/* Active Account */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wider">Active Account</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowNewAccount(true)}>
                  <Plus className="w-3.5 h-3.5" /> Open New Account
                </Button>
              </div>
              {activeAccounts.length > 0 ? (
                <div className="space-y-2">
                  {activeAccounts.map((acc: any) => (
                    <div key={acc.id} className="bg-bg border border-border rounded-lg p-3 flex items-center justify-between">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm flex-1">
                        <div><span className="text-text-dim text-xs">Account #</span><p className="text-text-primary font-mono text-xs">{acc.accountNumber || "—"}</p></div>
                        <div><span className="text-text-dim text-xs">Assigned To</span><p className="text-text-primary">{acc.assignedPartyName || acc.assignedPartyType}</p></div>
                        <div><span className="text-text-dim text-xs">Start Date</span><p className="text-text-primary">{formatDate(acc.startDate)}</p></div>
                        <div><span className="text-text-dim text-xs">Tenant</span><p className="text-text-primary">{acc.tenant?.name || "—"}</p></div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setCloseAccountId(acc.id)}>
                        <XCircle className="w-3.5 h-3.5" /> Close
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-bg border border-border rounded-lg p-4 text-center text-sm text-text-dim">
                  No active account — meter is unassigned
                </div>
              )}
            </div>

            {/* Account History */}
            {closedAccounts.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-2">Account History</h3>
                <div className="space-y-2">
                  {closedAccounts.map((acc: any) => (
                    <div key={acc.id} className="bg-bg border border-border/50 rounded-lg p-3 opacity-70">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-1 text-sm">
                        <div><span className="text-text-dim text-xs">Account #</span><p className="text-text-muted font-mono text-xs">{acc.accountNumber || "—"}</p></div>
                        <div><span className="text-text-dim text-xs">Party</span><p className="text-text-muted">{acc.assignedPartyName || acc.assignedPartyType}</p></div>
                        <div><span className="text-text-dim text-xs">Opened</span><p className="text-text-muted">{formatDate(acc.startDate)}</p></div>
                        <div><span className="text-text-dim text-xs">Closed</span><p className="text-text-muted">{formatDate(acc.endDate)}</p></div>
                        <div>
                          <span className="text-text-dim text-xs">Closed w/ Balance</span>
                          <p className={acc.closedWithBalance ? "text-red-400 font-medium" : "text-text-muted"}>
                            {acc.closedWithBalance === true ? "Yes" : acc.closedWithBalance === false ? "No" : "—"}
                          </p>
                        </div>
                      </div>
                      {acc.notes && <p className="text-xs text-text-dim mt-1">{acc.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* New Account Modal */}
      <Modal open={showNewAccount} onClose={() => setShowNewAccount(false)} title="Open New Account">
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-dim mb-1">Account Number</label>
              <input value={accountForm.accountNumber} onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1">Assigned Party *</label>
              <select value={accountForm.assignedPartyType} onChange={(e) => setAccountForm({ ...accountForm, assignedPartyType: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" required>
                <option value="tenant">Tenant</option>
                <option value="owner">Owner</option>
                <option value="management">Management</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-dim mb-1">Party Name</label>
              <input value={accountForm.assignedPartyName} onChange={(e) => setAccountForm({ ...accountForm, assignedPartyName: e.target.value })} placeholder="Tenant name or company" className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1">Start Date</label>
              <input type="date" value={accountForm.startDate} onChange={(e) => setAccountForm({ ...accountForm, startDate: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Notes</label>
            <textarea value={accountForm.notes} onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })} rows={2} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewAccount(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={createAccount.isPending}>
              {createAccount.isPending ? "Creating..." : "Open Account"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Close Account Modal */}
      <Modal open={!!closeAccountId} onClose={() => setCloseAccountId(null)} title="Close Account">
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Close this utility account. Was there an outstanding balance at closing?</p>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
              <input type="radio" name="balance" checked={!closeWithBalance} onChange={() => setCloseWithBalance(false)} className="accent-accent" />
              No balance (clean close)
            </label>
            <label className="flex items-center gap-2 text-sm text-red-400 cursor-pointer">
              <input type="radio" name="balance" checked={closeWithBalance} onChange={() => setCloseWithBalance(true)} className="accent-red-400" />
              Closed with balance
            </label>
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Notes</label>
            <textarea value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} rows={2} placeholder="Optional notes about the closure..." className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent resize-none" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCloseAccountId(null)}>Cancel</Button>
            <Button size="sm" onClick={handleCloseAccount} disabled={updateAccount.isPending}>
              {updateAccount.isPending ? "Closing..." : "Close Account"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete Meter"
        message="This will permanently delete this meter and all its accounts. This cannot be undone."
        loading={deleteMeter.isPending}
      />
    </>
  );
}
