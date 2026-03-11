"use client";

import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useAppStore } from "@/stores/app-store";
import { useBuilding, useDeleteBuilding } from "@/hooks/use-buildings";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { Pencil, Trash2, Gauge } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDate } from "@/lib/utils";

export default function BuildingDetailModal() {
  const { detailBuildingId, setDetailBuildingId, openBuildingForm, setSelectedBuildingId } = useAppStore();
  const { data: building, isLoading } = useBuilding(detailBuildingId);
  const deleteBuilding = useDeleteBuilding();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!detailBuildingId) return null;

  function handleEdit() {
    const id = detailBuildingId;
    setDetailBuildingId(null);
    openBuildingForm(id);
  }

  function handleDelete() {
    if (!detailBuildingId) return;
    deleteBuilding.mutate(detailBuildingId, {
      onSuccess: () => {
        setConfirmDelete(false);
        setDetailBuildingId(null);
        setSelectedBuildingId(null);
      },
    });
  }

  const sup = building?.superintendent as any;
  const elev = building?.elevatorCompany as any;
  const fire = building?.fireAlarmCompany as any;
  const _legacyMeters = building?.utilityMeters;
  const _legacyAccounts = building?.utilityAccounts;

  return (
    <>
      <Modal open={!!detailBuildingId} onClose={() => setDetailBuildingId(null)} title={building?.address || "Building Details"} wide>
        {isLoading ? (
          <LoadingSpinner />
        ) : building ? (
          <div className="space-y-5">
            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleEdit}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            </div>

            {/* Property Info */}
            <Section title="Property Info">
              <Field label="Property ID" value={building.propertyId} />
              <Field label="Address" value={building.address} />
              <Field label="Alt Address" value={building.altAddress} />
              <Field label="Entity" value={building.entity} />
              <Field label="Portfolio" value={building.portfolio} />
              <Field label="Region" value={building.region} />
              <Field label="ZIP" value={building.zip} />
              <Field label="Block" value={building.block} />
              <Field label="Lot" value={building.lot} />
              <Field label="Type" value={building.type} />
              <Field label="EIN Number" value={building.einNumber} />
              <Field label="Total Units" value={building.units?.length ?? building.totalUnits} />
            </Section>

            {/* Management Team */}
            <Section title="Management Team">
              <Field label="Owner" value={building.owner} />
              <Field label="Manager" value={building.manager} />
              <Field label="AR Team" value={building.arTeam} />
              <Field label="AP Team" value={building.apTeam} />
              <Field label="Head of Portfolio" value={building.headPortfolio} />
              <Field label="Mgmt Start Date" value={formatDate(building.mgmtStartDate)} />
            </Section>

            {/* Superintendent */}
            {sup && (sup.name || sup.phone || sup.email) && (
              <Section title="Superintendent">
                <Field label="Name" value={sup.name} />
                <Field label="Phone" value={sup.phone} />
                <Field label="Email" value={sup.email} />
              </Section>
            )}

            {/* Elevator Company */}
            {elev && (elev.name || elev.phone || elev.contract) && (
              <Section title="Elevator Company">
                <Field label="Name" value={elev.name} />
                <Field label="Phone" value={elev.phone} />
                <Field label="Contract" value={elev.contract} />
              </Section>
            )}

            {/* Fire Alarm Company */}
            {fire && (fire.name || fire.phone || fire.contract) && (
              <Section title="Fire Alarm Company">
                <Field label="Name" value={fire.name} />
                <Field label="Phone" value={fire.phone} />
                <Field label="Contract" value={fire.contract} />
              </Section>
            )}

            {/* Utilities */}
            <Section title="Utilities">
              <div className="col-span-full">
                <Link
                  href={`/utilities?buildingId=${building.id}`}
                  className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-light transition-colors"
                >
                  <Gauge className="w-4 h-4" />
                  View Utility Meters & Accounts
                </Link>
              </div>
            </Section>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete Building"
        message="This will permanently delete this building and all its units, tenants, and related data. This cannot be undone."
        loading={deleteBuilding.isPending}
      />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-2">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <span className="text-text-dim text-xs">{label}</span>
      <p className="text-text-primary">{value || "—"}</p>
    </div>
  );
}
