"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useUnits, useCreateUnit, useUpdateUnit, useDeleteUnit } from "@/hooks/use-units";
import { useBuildings } from "@/hooks/use-buildings";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { TableTabSkeleton } from "@/components/ui/skeleton";
import { fmt$ } from "@/lib/utils";

export default function UnitsTab() {
  const [buildingFilter, setBuildingFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { data: units, isLoading } = useUnits(buildingFilter);
  const { data: buildings } = useBuildings();
  const deleteUnit = useDeleteUnit();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<any>(null);

  const filtered = (units || []).filter((u) =>
    !search || u.unitNumber.toLowerCase().includes(search.toLowerCase()) ||
    u.buildingAddress.toLowerCase().includes(search.toLowerCase()) ||
    (u.tenantName && u.tenantName.toLowerCase().includes(search.toLowerCase()))
  );

  if (isLoading) return <TableTabSkeleton rows={10} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
            <input
              type="text"
              placeholder="Search units..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
            />
          </div>
          <select
            value={buildingFilter || ""}
            onChange={(e) => setBuildingFilter(e.target.value || null)}
            className="px-3 py-1.5 text-sm bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="">All Buildings</option>
            {buildings?.map((b) => (
              <option key={b.id} value={b.id}>{b.address}</option>
            ))}
          </select>
          <p className="text-sm text-text-muted">{filtered.length} units</p>
        </div>
        <Button size="sm" onClick={() => { setEditUnit(null); setFormOpen(true); }}>
          <Plus className="w-3.5 h-3.5" /> Add Unit
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Unit</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Type</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Building</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Tenant</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Rent</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Balance</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                <td className="px-4 py-3 text-text-primary font-medium">{u.unitNumber}</td>
                <td className="px-4 py-3 text-text-muted">{u.unitType || "—"}</td>
                <td className="px-4 py-3 text-text-muted">{u.buildingAddress}</td>
                <td className="px-4 py-3 text-text-muted">{u.tenantName || "—"}</td>
                <td className="px-4 py-3 text-text-muted font-mono">{u.marketRent ? fmt$(u.marketRent) : "—"}</td>
                <td className="px-4 py-3 text-text-muted font-mono">{u.balance ? fmt$(u.balance) : "—"}</td>
                <td className="px-4 py-3">
                  {u.isVacant ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Vacant</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">Occupied</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => { setEditUnit(u); setFormOpen(true); }} className="p-1 text-text-dim hover:text-accent" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(u.id)} className="p-1 text-text-dim hover:text-red-400" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-text-dim text-sm">No units found</div>
        )}
      </div>

      <UnitFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditUnit(null); }}
        unit={editUnit}
        buildings={buildings || []}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteUnit.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
        }}
        title="Delete Unit"
        message="This will permanently delete this unit and any associated tenant data."
        loading={deleteUnit.isPending}
      />
    </div>
  );
}

function UnitFormModal({ open, onClose, unit, buildings }: {
  open: boolean; onClose: () => void; unit: any; buildings: any[];
}) {
  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();
  const [buildingId, setBuildingId] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [unitType, setUnitType] = useState("");

  const isEdit = !!unit;

  // Reset form when opening
  const handleOpen = () => {
    if (unit) {
      setBuildingId(unit.buildingId);
      setUnitNumber(unit.unitNumber);
      setUnitType(unit.unitType || "");
    } else {
      setBuildingId(buildings[0]?.id || "");
      setUnitNumber("");
      setUnitType("");
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  if (open && !buildingId && !unit && buildings.length > 0) {
    handleOpen();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit) {
      updateUnit.mutate({ id: unit.id, data: { unitNumber, unitType: unitType || undefined } }, {
        onSuccess: onClose,
      });
    } else {
      createUnit.mutate({ buildingId, unitNumber, unitType: unitType || undefined }, {
        onSuccess: onClose,
      });
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Unit" : "Add Unit"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit && (
          <div>
            <label className="block text-xs text-text-dim mb-1">Building</label>
            <select
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
              required
            >
              <option value="">Select building...</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.address}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-text-dim mb-1">Unit Number</label>
          <input
            type="text"
            value={unitNumber}
            onChange={(e) => setUnitNumber(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
            placeholder="e.g. 1A, 2B"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-text-dim mb-1">Unit Type</label>
          <input
            type="text"
            value={unitType}
            onChange={(e) => setUnitType(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
            placeholder="e.g. 1BR, 2BR, Studio"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={createUnit.isPending || updateUnit.isPending}>
            {isEdit ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
