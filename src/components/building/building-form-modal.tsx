"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { useBuilding, useCreateBuilding, useUpdateBuilding } from "@/hooks/use-buildings";
import LoadingSpinner from "@/components/ui/loading-spinner";

const emptyForm = {
  yardiId: "",
  address: "",
  altAddress: "",
  entity: "",
  portfolio: "",
  region: "",
  zip: "",
  block: "",
  lot: "",
  type: "Residential",
  owner: "",
  manager: "",
  arTeam: "",
  apTeam: "",
  headPortfolio: "",
  mgmtStartDate: "",
  einNumber: "",
  totalUnits: "0",
  // Superintendent
  supName: "",
  supPhone: "",
  supEmail: "",
  // Elevator
  elevName: "",
  elevPhone: "",
  elevContract: "",
  // Fire Alarm
  fireName: "",
  firePhone: "",
  fireContract: "",
  // Utility Meters
  meterGas: "",
  meterElectric: "",
  meterWater: "",
  // Utility Accounts
  accountGas: "",
  accountElectric: "",
  accountWater: "",
};

export default function BuildingFormModal() {
  const { buildingFormOpen, editBuildingId, closeBuildingForm } = useAppStore();
  const { data: building, isLoading } = useBuilding(editBuildingId);
  const createBuilding = useCreateBuilding();
  const updateBuilding = useUpdateBuilding();
  const isEdit = !!editBuildingId;

  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => {
    if (isEdit && building) {
      const sup = building.superintendent as any;
      const elev = building.elevatorCompany as any;
      const fire = building.fireAlarmCompany as any;
      const meters = building.utilityMeters as any;
      const accounts = building.utilityAccounts as any;

      setForm({
        yardiId: building.yardiId || "",
        address: building.address || "",
        altAddress: building.altAddress || "",
        entity: building.entity || "",
        portfolio: building.portfolio || "",
        region: building.region || "",
        zip: building.zip || "",
        block: building.block || "",
        lot: building.lot || "",
        type: building.type || "Residential",
        owner: building.owner || "",
        manager: building.manager || "",
        arTeam: building.arTeam || "",
        apTeam: building.apTeam || "",
        headPortfolio: building.headPortfolio || "",
        mgmtStartDate: building.mgmtStartDate ? new Date(building.mgmtStartDate).toISOString().split("T")[0] : "",
        einNumber: building.einNumber || "",
        totalUnits: String(building.units?.length ?? building.totalUnits ?? 0),
        supName: sup?.name || "",
        supPhone: sup?.phone || "",
        supEmail: sup?.email || "",
        elevName: elev?.name || "",
        elevPhone: elev?.phone || "",
        elevContract: elev?.contract || "",
        fireName: fire?.name || "",
        firePhone: fire?.phone || "",
        fireContract: fire?.contract || "",
        meterGas: meters?.gas || "",
        meterElectric: meters?.electric || "",
        meterWater: meters?.water || "",
        accountGas: accounts?.gas || "",
        accountElectric: accounts?.electric || "",
        accountWater: accounts?.water || "",
      });
    } else if (!isEdit) {
      setForm({ ...emptyForm });
    }
  }, [building, isEdit]);

  function handleSave() {
    const payload: any = {
      yardiId: form.yardiId,
      address: form.address,
      altAddress: form.altAddress || null,
      entity: form.entity || null,
      portfolio: form.portfolio || null,
      region: form.region || null,
      zip: form.zip || null,
      block: form.block || null,
      lot: form.lot || null,
      type: form.type || "Residential",
      owner: form.owner || null,
      manager: form.manager || null,
      arTeam: form.arTeam || null,
      apTeam: form.apTeam || null,
      headPortfolio: form.headPortfolio || null,
      mgmtStartDate: form.mgmtStartDate || null,
      einNumber: form.einNumber || null,
      totalUnits: parseInt(form.totalUnits) || 0,
      superintendent: (form.supName || form.supPhone || form.supEmail)
        ? { name: form.supName, phone: form.supPhone, email: form.supEmail }
        : null,
      elevatorCompany: (form.elevName || form.elevPhone || form.elevContract)
        ? { name: form.elevName, phone: form.elevPhone, contract: form.elevContract }
        : null,
      fireAlarmCompany: (form.fireName || form.firePhone || form.fireContract)
        ? { name: form.fireName, phone: form.firePhone, contract: form.fireContract }
        : null,
      utilityMeters: (form.meterGas || form.meterElectric || form.meterWater)
        ? { gas: form.meterGas, electric: form.meterElectric, water: form.meterWater }
        : null,
      utilityAccounts: (form.accountGas || form.accountElectric || form.accountWater)
        ? { gas: form.accountGas, electric: form.accountElectric, water: form.accountWater }
        : null,
    };

    if (isEdit && editBuildingId) {
      updateBuilding.mutate({ id: editBuildingId, data: payload }, { onSuccess: closeBuildingForm });
    } else {
      createBuilding.mutate(payload, { onSuccess: closeBuildingForm });
    }
  }

  const isPending = createBuilding.isPending || updateBuilding.isPending;

  if (!buildingFormOpen) return null;

  return (
    <Modal open={buildingFormOpen} onClose={closeBuildingForm} title={isEdit ? "Edit Building" : "Add Building"} wide>
      {isEdit && isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-5">
          {/* Property Info */}
          <SectionLabel>Property Info</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="Yardi ID *" value={form.yardiId} onChange={(v) => setForm({ ...form, yardiId: v })} />
            <InputField label="Address *" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="Alt Address" value={form.altAddress} onChange={(v) => setForm({ ...form, altAddress: v })} />
            <InputField label="Entity" value={form.entity} onChange={(v) => setForm({ ...form, entity: v })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <InputField label="Portfolio" value={form.portfolio} onChange={(v) => setForm({ ...form, portfolio: v })} />
            <InputField label="Region" value={form.region} onChange={(v) => setForm({ ...form, region: v })} />
            <InputField label="ZIP" value={form.zip} onChange={(v) => setForm({ ...form, zip: v })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <InputField label="Block" value={form.block} onChange={(v) => setForm({ ...form, block: v })} />
            <InputField label="Lot" value={form.lot} onChange={(v) => setForm({ ...form, lot: v })} />
            <InputField label="Type" value={form.type} onChange={(v) => setForm({ ...form, type: v })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="EIN Number" value={form.einNumber} onChange={(v) => setForm({ ...form, einNumber: v })} />
            <InputField label="Total Units" value={form.totalUnits} onChange={(v) => setForm({ ...form, totalUnits: v })} type="number" />
          </div>

          {/* Management */}
          <SectionLabel>Management Team</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="Owner" value={form.owner} onChange={(v) => setForm({ ...form, owner: v })} />
            <InputField label="Manager" value={form.manager} onChange={(v) => setForm({ ...form, manager: v })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="AR Team" value={form.arTeam} onChange={(v) => setForm({ ...form, arTeam: v })} />
            <InputField label="AP Team" value={form.apTeam} onChange={(v) => setForm({ ...form, apTeam: v })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="Head of Portfolio" value={form.headPortfolio} onChange={(v) => setForm({ ...form, headPortfolio: v })} />
            <InputField label="Mgmt Start Date" value={form.mgmtStartDate} onChange={(v) => setForm({ ...form, mgmtStartDate: v })} type="date" />
          </div>

          {/* Superintendent */}
          <SectionLabel>Superintendent</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <InputField label="Name" value={form.supName} onChange={(v) => setForm({ ...form, supName: v })} />
            <InputField label="Phone" value={form.supPhone} onChange={(v) => setForm({ ...form, supPhone: v })} />
            <InputField label="Email" value={form.supEmail} onChange={(v) => setForm({ ...form, supEmail: v })} />
          </div>

          {/* Elevator Company */}
          <SectionLabel>Elevator Company</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <InputField label="Name" value={form.elevName} onChange={(v) => setForm({ ...form, elevName: v })} />
            <InputField label="Phone" value={form.elevPhone} onChange={(v) => setForm({ ...form, elevPhone: v })} />
            <InputField label="Contract" value={form.elevContract} onChange={(v) => setForm({ ...form, elevContract: v })} />
          </div>

          {/* Fire Alarm Company */}
          <SectionLabel>Fire Alarm Company</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <InputField label="Name" value={form.fireName} onChange={(v) => setForm({ ...form, fireName: v })} />
            <InputField label="Phone" value={form.firePhone} onChange={(v) => setForm({ ...form, firePhone: v })} />
            <InputField label="Contract" value={form.fireContract} onChange={(v) => setForm({ ...form, fireContract: v })} />
          </div>

          {/* Utility Meters */}
          <SectionLabel>Utility Meters</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <InputField label="Gas" value={form.meterGas} onChange={(v) => setForm({ ...form, meterGas: v })} />
            <InputField label="Electric" value={form.meterElectric} onChange={(v) => setForm({ ...form, meterElectric: v })} />
            <InputField label="Water" value={form.meterWater} onChange={(v) => setForm({ ...form, meterWater: v })} />
          </div>

          {/* Utility Accounts */}
          <SectionLabel>Utility Account Numbers</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <InputField label="Gas" value={form.accountGas} onChange={(v) => setForm({ ...form, accountGas: v })} />
            <InputField label="Electric" value={form.accountElectric} onChange={(v) => setForm({ ...form, accountElectric: v })} />
            <InputField label="Water" value={form.accountWater} onChange={(v) => setForm({ ...form, accountWater: v })} />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={closeBuildingForm}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending || !form.yardiId || !form.address}>
              {isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Building"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wider pt-2">{children}</h3>;
}

function InputField({
  label, value, onChange, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-text-dim mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
      />
    </div>
  );
}
