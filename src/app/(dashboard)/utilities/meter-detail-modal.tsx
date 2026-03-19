"use client";

import { useState, useMemo } from "react";
import { Pencil, Trash2, Plus, XCircle, CheckCircle2, MinusCircle, ArrowRightLeft, AlertTriangle } from "lucide-react";
import { useUtilityMeter, useUpdateMeter, useDeleteMeter, useCreateAccount, useUpdateAccount, useMonthlyChecks, useCreateOrUpdateCheck } from "@/hooks/use-utilities";
import type { MonthlyCheck } from "@/hooks/use-utilities";
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

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function MeterDetailModal({ meterId, onClose }: { meterId: string | null; onClose: () => void }) {
  const { data: meter, isLoading } = useUtilityMeter(meterId);
  const updateMeter = useUpdateMeter();
  const deleteMeter = useDeleteMeter();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const markCheck = useCreateOrUpdateCheck();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [closeAccountId, setCloseAccountId] = useState<string | null>(null);
  const [closeWithBalance, setCloseWithBalance] = useState(false);
  const [closeNotes, setCloseNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [checksAccountId, setChecksAccountId] = useState<string | null>(null);

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
      classification: meter.classification || "unit_submeter",
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
        tenantId: accountForm.assignedPartyType === "tenant" ? (accountForm.tenantId || undefined) : undefined,
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

  function handleTransferToOwner(accountId: string, tenantName: string) {
    const timestamp = new Date().toLocaleString();
    updateAccount.mutate({
      id: accountId,
      assignedPartyType: "owner",
      assignedPartyName: "Owner (transferred)",
      tenantId: null,
      notes: `Transferred from tenant "${tenantName}" to owner on ${timestamp}.`,
    });
  }

  function handleCloseAccount() {
    if (!closeAccountId) return;
    updateAccount.mutate(
      {
        id: closeAccountId,
        status: "closed",
        endDate: new Date().toISOString(),
        closedWithBalance: closeWithBalance,
        closeReason: closeWithBalance ? "closed_with_balance" : "account_closed",
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
                  <label className="block text-xs text-text-dim mb-1">Meter Classification</label>
                  <select value={editForm.classification} onChange={(e) => setEditForm({ ...editForm, classification: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
                    <option value="unit_submeter">Unit Submeter (tenant-responsible)</option>
                    <option value="building_master">Building Master (owner-responsible)</option>
                    <option value="common_area">Common Area (owner-responsible)</option>
                    <option value="shared_meter">Shared Meter (multiple units)</option>
                  </select>
                  <p className="text-xs text-text-dim mt-1">Building Master and Common Area meters will not trigger missing-unit alerts.</p>
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
                  {activeAccounts.map((acc: any) => {
                    // FIX 2c: Use snapshotted tenant identity, not current unit occupant
                    const tenant = acc.tenant || (acc.tenantNameSnapshot ? { name: acc.tenantNameSnapshot, leaseExpiration: acc.leaseEndSnapshot, moveOutDate: null, leaseStatus: null } : meter.unit?.tenant);
                    const leaseExpired = tenant?.leaseExpiration && new Date(tenant.leaseExpiration) < new Date();
                    const movedOut = tenant?.moveOutDate && new Date(tenant.moveOutDate) < new Date();
                    const moveOutSoon = tenant?.moveOutDate && !movedOut && new Date(tenant.moveOutDate).getTime() - Date.now() < 7 * 86400000;
                    const needsTransfer = acc.assignedPartyType === "tenant" && (leaseExpired || movedOut || moveOutSoon);

                    return (
                      <div key={acc.id} className="space-y-2">
                        <div className={`bg-bg border rounded-lg p-3 ${needsTransfer ? "border-amber-500/50" : "border-border"}`}>
                          <div className="flex items-center justify-between">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm flex-1">
                              <div><span className="text-text-dim text-xs">Account #</span><p className="text-text-primary font-mono text-xs">{acc.accountNumber || "—"}</p></div>
                              <div><span className="text-text-dim text-xs">Assigned To</span><p className="text-text-primary">{acc.assignedPartyName || acc.assignedPartyType}</p></div>
                              <div><span className="text-text-dim text-xs">Start Date</span><p className="text-text-primary">{formatDate(acc.startDate)}</p></div>
                              <div><span className="text-text-dim text-xs">Tenant</span><p className="text-text-primary">{tenant?.name || "—"}</p></div>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setChecksAccountId(checksAccountId === acc.id ? null : acc.id)}>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Checks
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setCloseAccountId(acc.id)}>
                                <XCircle className="w-3.5 h-3.5" /> Close
                              </Button>
                            </div>
                          </div>

                          {/* Tenant Lifecycle Info */}
                          {tenant && acc.assignedPartyType === "tenant" && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 text-xs">
                                  <div>
                                    <span className="text-text-dim">Lease Status</span>
                                    <p className={leaseExpired ? "text-red-400 font-medium" : "text-text-muted"}>{tenant.leaseStatus || "—"}{leaseExpired ? " (expired)" : ""}</p>
                                  </div>
                                  <div>
                                    <span className="text-text-dim">Lease Expires</span>
                                    <p className={leaseExpired ? "text-red-400" : "text-text-muted"}>{formatDate(tenant.leaseExpiration)}</p>
                                  </div>
                                  {tenant.moveOutDate && (
                                    <div>
                                      <span className="text-text-dim">Move-Out</span>
                                      <p className={movedOut ? "text-red-400" : moveOutSoon ? "text-amber-400" : "text-text-muted"}>{formatDate(tenant.moveOutDate)}</p>
                                    </div>
                                  )}
                                </div>
                                {needsTransfer && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleTransferToOwner(acc.id, tenant.name)}
                                    disabled={updateAccount.isPending}
                                    className="text-amber-400 hover:text-amber-300"
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer to Owner
                                  </Button>
                                )}
                              </div>
                              {needsTransfer && (
                                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-400">
                                  <AlertTriangle className="w-3 h-3" />
                                  {movedOut ? "Tenant moved out. Transfer utility account to owner." : leaseExpired ? "Lease expired. Transfer utility account to owner." : "Tenant moving out soon. Schedule utility transfer."}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Monthly Checks Section */}
                        {checksAccountId === acc.id && (
                          <MonthlyChecksSection accountId={acc.id} />
                        )}
                      </div>
                    );
                  })}
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
                        <div><span className="text-text-dim text-xs">Party</span><p className="text-text-muted">{acc.tenantNameSnapshot || acc.assignedPartyName || acc.assignedPartyType}</p></div>
                        <div><span className="text-text-dim text-xs">Opened</span><p className="text-text-muted">{formatDate(acc.startDate)}</p></div>
                        <div><span className="text-text-dim text-xs">Closed</span><p className="text-text-muted">{formatDate(acc.endDate)}</p></div>
                        <div>
                          <span className="text-text-dim text-xs">Closed w/ Balance</span>
                          <p className={acc.closedWithBalance ? "text-red-400 font-medium" : "text-text-muted"}>
                            {acc.closedWithBalance === true ? "Yes" : acc.closedWithBalance === false ? "No" : "—"}
                          </p>
                        </div>
                      </div>
                      {acc.closeReason && <p className="text-xs text-text-dim mt-0.5">Reason: {acc.closeReason.replace(/_/g, " ")}</p>}
                      {acc.tenantNameSnapshot && <p className="text-xs text-text-dim mt-0.5">Responsible party recorded at account open on {formatDate(acc.startDate)}</p>}
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
        {/* FIX 1d: Warn if meter already has an active account */}
        {activeAccounts.length > 0 && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="text-amber-400 font-medium">This meter already has an active account</p>
                <p className="text-text-muted mt-1">
                  Opened {formatDate(activeAccounts[0].startDate)}, assigned to {activeAccounts[0].assignedPartyName || activeAccounts[0].assignedPartyType}.
                  You must close the current account before opening a new one.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-amber-400 hover:text-amber-300"
                  onClick={() => { setShowNewAccount(false); setCloseAccountId(activeAccounts[0].id); }}
                >
                  <XCircle className="w-3.5 h-3.5" /> Close Current Account First
                </Button>
              </div>
            </div>
          </div>
        )}
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-dim mb-1">Account Number</label>
              <input value={accountForm.accountNumber} onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1">Responsible Party *</label>
              <select value={accountForm.assignedPartyType} onChange={(e) => setAccountForm({ ...accountForm, assignedPartyType: e.target.value, tenantId: "" })} className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" required>
                <option value="tenant">Tenant</option>
                <option value="owner">Owner</option>
                <option value="management">Management</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>
          {/* FIX 2b: Tenant selector when responsible party is tenant */}
          {accountForm.assignedPartyType === "tenant" && meter?.unit?.tenant && (
            <div>
              <label className="block text-xs text-text-dim mb-1">Tenant *</label>
              <select
                value={accountForm.tenantId}
                onChange={(e) => {
                  const tid = e.target.value;
                  const t = meter.unit?.tenant;
                  setAccountForm({
                    ...accountForm,
                    tenantId: tid,
                    assignedPartyName: t && tid ? t.name : accountForm.assignedPartyName,
                  });
                }}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                required
              >
                <option value="">Select tenant...</option>
                {meter.unit.tenant && (
                  <option value={meter.unit.tenant.id}>
                    {meter.unit.tenant.name}
                    {meter.unit.tenant.leaseExpiration ? ` (lease ends ${formatDate(meter.unit.tenant.leaseExpiration)})` : ""}
                  </option>
                )}
              </select>
              <p className="text-xs text-text-dim mt-1">Tenant identity will be snapshotted at account open and preserved after turnover.</p>
            </div>
          )}
          {accountForm.assignedPartyType === "tenant" && !meter?.unit?.tenant && (
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-400">
              No active tenant on this unit. Select a different responsible party or assign a tenant to the unit first.
            </div>
          )}
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
            <Button type="submit" size="sm" disabled={createAccount.isPending || activeAccounts.length > 0}>
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

// ── Monthly Checks Section ──────────────────────────────────────

function MonthlyChecksSection({ accountId }: { accountId: string }) {
  const { data: checks, isLoading } = useMonthlyChecks(accountId);
  const markCheck = useCreateOrUpdateCheck();

  // Generate last 6 months (current month + previous 5), newest first
  const monthSlots = useMemo(() => {
    const now = new Date();
    const slots: { month: number; year: number; label: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      slots.push({
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      });
    }
    return slots;
  }, []);

  const checkMap = useMemo(() => {
    const map = new Map<string, MonthlyCheck>();
    for (const c of checks || []) {
      map.set(`${c.year}-${c.month}`, c);
    }
    return map;
  }, [checks]);

  function handleMarkPaid(month: number, year: number) {
    markCheck.mutate({ accountId, month, year, isPaid: true });
  }

  if (isLoading) return <div className="p-3 text-center text-sm text-text-dim">Loading checks...</div>;

  return (
    <div className="bg-bg border border-border rounded-lg p-3">
      <h4 className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-2">Monthly Checks</h4>
      <div className="space-y-1">
        {monthSlots.map((slot) => {
          const check = checkMap.get(`${slot.year}-${slot.month}`);
          const status = check?.paymentStatus || "not_recorded";

          return (
            <div key={`${slot.year}-${slot.month}`} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-card-hover transition-colors">
              <span className="text-sm text-text-muted w-24">{slot.label}</span>
              <div className="flex items-center gap-3">
                {status === "paid" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="w-3 h-3" /> Paid</span>
                ) : status === "unpaid" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3 h-3" /> Unpaid</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-text-dim"><MinusCircle className="w-3 h-3" /> Not recorded</span>
                )}
                {status !== "paid" && (
                  <button
                    onClick={() => handleMarkPaid(slot.month, slot.year)}
                    disabled={markCheck.isPending}
                    className="text-xs text-accent hover:text-accent-light transition-colors disabled:opacity-50"
                  >
                    Mark Paid
                  </button>
                )}
                {check?.notes && (
                  <span className="text-xs text-text-dim" title={check.notes}>*</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
