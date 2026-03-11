"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";
import { useAppStore } from "@/stores/app-store";
import { useTenant } from "@/hooks/use-tenants";
import { useNotes } from "@/hooks/use-notes";
import { usePayments } from "@/hooks/use-payments";
import { fmt$, formatDate } from "@/lib/utils";
import { getScoreLabel } from "@/lib/scoring";
import ArrearsBadge from "./arrears-badge";
import LeaseBadge from "./lease-badge";
import NoteForm from "./note-form";
import NoteTimeline from "./note-timeline";
import PaymentForm from "./payment-form";
import PaymentList from "./payment-list";
import LoadingSpinner from "@/components/ui/loading-spinner";
import Button from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useDeleteTenant } from "@/hooks/use-tenants";
import { Pencil, Trash2, Brain } from "lucide-react";

const tabs = ["Details", "Notes", "Payments"] as const;

export default function TenantDetailModal() {
  const { detailTenantId, setDetailTenantId, setEditTenantId, openAiForTenant } = useAppStore();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Details");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: tenant, isLoading } = useTenant(detailTenantId);
  const { data: notes } = useNotes(detailTenantId);
  const { data: payments } = usePayments(detailTenantId);
  const deleteTenant = useDeleteTenant();

  if (!detailTenantId) return null;

  const title = tenant ? `${tenant.name} — Unit ${tenant.unit?.unitNumber}` : "Tenant Details";

  return (
    <>
    <Modal open={!!detailTenantId} onClose={() => setDetailTenantId(null)} title={title} wide>
      {isLoading ? (
        <LoadingSpinner />
      ) : tenant ? (
        <div>
          <div className="flex gap-1 border-b border-border mb-4">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  tab === t
                    ? "text-accent border-b-2 border-accent"
                    : "text-text-dim hover:text-text-muted"
                }`}
              >
                {t}
                {t === "Notes" && notes?.length ? ` (${notes.length})` : ""}
                {t === "Payments" && payments?.length ? ` (${payments.length})` : ""}
              </button>
            ))}
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDetailTenantId(null);
                openAiForTenant(tenant.id);
              }}
              className="text-accent"
            >
              <Brain className="w-3.5 h-3.5" /> AI Analysis
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDetailTenantId(null);
                setEditTenantId(tenant.id);
              }}
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          </div>

          {tab === "Details" && (
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Field label="Building" value={tenant.unit?.building?.address} />
              <Field label="Unit" value={tenant.unit?.unitNumber} />
              <Field label="Resident ID" value={tenant.yardiResidentId} />
              <Field label="Charge Code" value={tenant.chargeCode} />
              <div className="col-span-2 border-t border-border pt-3 mt-1" />
              <Field label="Market Rent" value={fmt$(Number(tenant.marketRent))} />
              <Field label="Balance" value={fmt$(Number(tenant.balance))} valueClass="text-red-400" />
              <Field label="Deposit" value={fmt$(Number(tenant.deposit))} />
              <Field label="Months Owed" value={Number(tenant.monthsOwed).toFixed(1)} />
              <div>
                <span className="text-text-dim">Arrears</span>
                <div className="mt-0.5"><ArrearsBadge category={tenant.arrearsCategory} /></div>
              </div>
              <div>
                <span className="text-text-dim">Score</span>
                <div className="mt-0.5">
                  {(() => { const s = getScoreLabel(tenant.collectionScore); return <span style={{ color: s.color }} className="font-bold">{tenant.collectionScore} {s.label}</span>; })()}
                </div>
              </div>
              <div className="col-span-2 border-t border-border pt-3 mt-1" />
              <Field label="Move-In" value={formatDate(tenant.moveInDate)} />
              <Field label="Lease Expiration" value={formatDate(tenant.leaseExpiration)} />
              <div>
                <span className="text-text-dim">Lease Status</span>
                <div className="mt-0.5"><LeaseBadge status={tenant.leaseStatus} /></div>
              </div>
              {tenant.legalCases?.[0] && (
                <div>
                  <span className="text-text-dim">Legal</span>
                  <div className="mt-0.5 text-purple-400 text-xs font-medium">
                    {tenant.legalCases[0].stage?.replace(/_/g, " ")}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "Notes" && (
            <div className="space-y-4">
              <NoteForm tenantId={tenant.id} />
              <NoteTimeline notes={notes || []} tenantId={tenant.id} />
            </div>
          )}

          {tab === "Payments" && (
            <div className="space-y-4">
              <PaymentForm tenantId={tenant.id} />
              <PaymentList payments={payments || []} tenantId={tenant.id} />
            </div>
          )}
        </div>
      ) : null}
    </Modal>

    <ConfirmDialog
      open={confirmDelete}
      onClose={() => setConfirmDelete(false)}
      onConfirm={() => {
        if (!detailTenantId) return;
        deleteTenant.mutate(detailTenantId, {
          onSuccess: () => {
            setConfirmDelete(false);
            setDetailTenantId(null);
          },
        });
      }}
      title="Delete Tenant"
      message="This will permanently delete this tenant and all their notes, payments, and related data. This cannot be undone."
      loading={deleteTenant.isPending}
    />
    </>
  );
}

function Field({ label, value, valueClass }: { label: string; value: any; valueClass?: string }) {
  return (
    <div>
      <span className="text-text-dim">{label}</span>
      <p className={valueClass || "text-text-primary"}>{value || "—"}</p>
    </div>
  );
}
