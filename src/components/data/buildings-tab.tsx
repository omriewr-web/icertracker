"use client";

import { useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Eye, Building2, Users, Phone, Mail, Zap, Flame, ArrowUpDown, Shield, HardHat, Gauge, FileCheck, Merge } from "lucide-react";
import { useBuildings, useDeleteBuilding, useBuilding } from "@/hooks/use-buildings";
import { useAppStore } from "@/stores/app-store";
import { useQueryClient } from "@tanstack/react-query";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { TableTabSkeleton } from "@/components/ui/skeleton";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { formatDate, fmt$ } from "@/lib/utils";
import toast from "react-hot-toast";
import ExportButton from "@/components/ui/export-button";

export default function BuildingsTab() {
  const { data: buildings, isLoading } = useBuildings();
  const deleteBuilding = useDeleteBuilding();
  const { openBuildingForm } = useAppStore();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dedupOpen, setDedupOpen] = useState(false);

  if (isLoading) return <TableTabSkeleton rows={8} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">{buildings?.length || 0} buildings</p>
        <div className="flex gap-2">
          <ExportButton
            data={(buildings || []).map((b) => ({
              address: b.address,
              entity: b.entity || "",
              portfolio: b.portfolio || "",
              totalUnits: b.totalUnits,
              manager: b.manager || "",
              region: b.region || "",
              block: b.block || "",
              lot: b.lot || "",
            }))}
            filename="buildings"
            columns={[
              { key: "address", label: "Address" },
              { key: "entity", label: "Entity" },
              { key: "portfolio", label: "Portfolio" },
              { key: "totalUnits", label: "Units" },
              { key: "manager", label: "Manager" },
              { key: "region", label: "Region" },
              { key: "block", label: "Block" },
              { key: "lot", label: "Lot" },
            ]}
            pdfConfig={{ title: "Properties Report" }}
          />
          <Button size="sm" variant="ghost" onClick={() => setDedupOpen(true)}>
            <Merge className="w-3.5 h-3.5" /> Deduplicate
          </Button>
          <Button size="sm" onClick={() => openBuildingForm()}>
            <Plus className="w-3.5 h-3.5" /> Add Building
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Address</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Entity</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Portfolio</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Units</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Manager</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Region</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Block</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Lot</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {buildings?.map((b) => (
              <tr
                key={b.id}
                className="border-b border-border/50 hover:bg-card-hover cursor-pointer transition-colors"
                onClick={() => setDetailId(b.id)}
              >
                <td className="px-4 py-3 text-text-primary font-medium">{b.address}</td>
                <td className="px-4 py-3 text-text-muted">{b.entity || "—"}</td>
                <td className="px-4 py-3 text-text-muted">{b.portfolio || "—"}</td>
                <td className="px-4 py-3 text-text-muted">{b.totalUnits}</td>
                <td className="px-4 py-3 text-text-muted">{b.manager || "—"}</td>
                <td className="px-4 py-3 text-text-muted">{b.region || "—"}</td>
                <td className="px-4 py-3 text-text-muted">{b.block || "—"}</td>
                <td className="px-4 py-3 text-text-muted">{b.lot || "—"}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <button onClick={() => setDetailId(b.id)} className="p-1 text-text-dim hover:text-accent" title="View">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openBuildingForm(b.id)} className="p-1 text-text-dim hover:text-accent" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(b.id)} className="p-1 text-text-dim hover:text-red-400" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!buildings || buildings.length === 0) && (
          <div className="text-center py-12 text-text-dim text-sm">No buildings found</div>
        )}
      </div>

      {/* Building Detail Card Modal */}
      <BuildingDetailCard id={detailId} onClose={() => setDetailId(null)} />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteBuilding.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
        }}
        title="Delete Building"
        message="This will permanently delete this building and all its units, tenants, and related data."
        loading={deleteBuilding.isPending}
      />

      <DeduplicateModal open={dedupOpen} onClose={() => setDedupOpen(false)} />
    </div>
  );
}

interface DupBuilding {
  id: string;
  address: string;
  block: string | null;
  lot: string | null;
  entity: string | null;
  unitCount: number;
  tenantCount: number;
  violationCount: number;
  complianceCount: number;
}

interface DuplicateSet {
  matchedBy: string;
  buildings: DupBuilding[];
}

function DeduplicateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [merging, setMerging] = useState(false);
  const [sets, setSets] = useState<DuplicateSet[] | null>(null);
  const qc = useQueryClient();

  const scan = useCallback(async () => {
    setScanning(true);
    setSets(null);
    try {
      const res = await fetch("/api/buildings/deduplicate");
      if (!res.ok) throw new Error("Scan failed");
      const data = await res.json();
      setSets(data.duplicateSets);
    } catch {
      toast.error("Failed to scan for duplicates");
    } finally {
      setScanning(false);
    }
  }, []);

  const mergeSet = async (set: DuplicateSet) => {
    // Pick building with most relations as keeper
    const sorted = [...set.buildings].sort(
      (a, b) =>
        b.unitCount + b.tenantCount + b.violationCount + b.complianceCount -
        (a.unitCount + a.tenantCount + a.violationCount + a.complianceCount)
    );
    const keepId = sorted[0].id;
    const mergeIds = sorted.slice(1).map((b) => b.id);

    const res = await fetch("/api/buildings/deduplicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keepId, mergeIds }),
    });
    if (!res.ok) throw new Error("Merge failed");
    return res.json();
  };

  const mergeAll = async () => {
    if (!sets?.length) return;
    setMerging(true);
    try {
      for (const set of sets) {
        await mergeSet(set);
      }
      toast.success("All duplicates merged");
      qc.invalidateQueries({ queryKey: ["buildings"] });
      setSets([]);
    } catch {
      toast.error("Merge failed");
    } finally {
      setMerging(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Deduplicate Buildings" wide>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-muted">
            Scan for duplicate buildings that can be merged.
          </p>
          <Button size="sm" onClick={scan} disabled={scanning}>
            {scanning ? "Scanning..." : "Scan for Duplicates"}
          </Button>
        </div>

        {sets !== null && sets.length === 0 && (
          <div className="text-center py-8 text-text-dim text-sm">
            No duplicates found.
          </div>
        )}

        {sets !== null && sets.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-primary font-medium">
                {sets.length} duplicate {sets.length === 1 ? "set" : "sets"} found
              </p>
              <Button size="sm" onClick={mergeAll} disabled={merging}>
                {merging ? "Merging..." : "Merge All"}
              </Button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {sets.map((set, i) => {
                const sorted = [...set.buildings].sort(
                  (a, b) =>
                    b.unitCount + b.tenantCount + b.violationCount + b.complianceCount -
                    (a.unitCount + a.tenantCount + a.violationCount + a.complianceCount)
                );
                return (
                  <div key={i} className="bg-bg border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                        Matched by {set.matchedBy}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {sorted.map((b, j) => (
                        <div
                          key={b.id}
                          className={`flex items-center justify-between text-sm px-2 py-1 rounded ${
                            j === 0 ? "bg-green-500/10 border border-green-500/20" : "bg-card"
                          }`}
                        >
                          <div>
                            <span className="text-text-primary">{b.address}</span>
                            {b.entity && <span className="text-text-dim text-xs ml-2">({b.entity})</span>}
                            {j === 0 && <span className="text-green-400 text-xs ml-2">Keep</span>}
                            {j > 0 && <span className="text-red-400 text-xs ml-2">Merge</span>}
                          </div>
                          <div className="flex gap-3 text-xs text-text-dim">
                            <span>{b.unitCount} units</span>
                            <span>{b.tenantCount} tenants</span>
                            <span>{b.violationCount} violations</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function BuildingDetailCard({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: building, isLoading } = useBuilding(id);
  const { openBuildingForm } = useAppStore();

  if (!id) return null;

  const sup = building?.superintendent as any;
  const elev = building?.elevatorCompany as any;
  const fire = building?.fireAlarmCompany as any;
  const meters = building?.utilityMeters as any;
  const accounts = building?.utilityAccounts as any;
  const lifeSafety = building?.lifeSafety as any;
  const elevatorInfo = building?.elevatorInfo as any;
  const boilerInfo = building?.boilerInfo as any;
  const compDates = building?.complianceDates as any;
  const units = building?.units || [];

  return (
    <Modal open={!!id} onClose={onClose} title={building?.address || "Building Details"} wide>
      {isLoading ? (
        <LoadingSpinner />
      ) : building ? (
        <div className="space-y-6">
          {/* Action bar */}
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => { onClose(); openBuildingForm(id); }}>
              <Pencil className="w-3.5 h-3.5" /> Edit Building
            </Button>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-5">
              {/* Property Info */}
              <Section title="Property Info" icon={Building2}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Field label="Portfolio" value={building.portfolio} />
                  <Field label="Property Type" value={building.type} />
                  <Field label="Property ID" value={building.propertyId} />
                  <Field label="Entity" value={building.entity} />
                  <Field label="Address" value={building.address} full />
                  <Field label="Region" value={building.region} />
                  <Field label="ZIP" value={building.zip} />
                  <Field label="Block" value={building.block} />
                  <Field label="Lot" value={building.lot} />
                  <Field label="Unit Count" value={units.length || building.totalUnits} />
                  <Field label="EIN Number" value={building.einNumber} />
                  <Field label="BIN # (DOB)" value={building.bin} />
                  <Field label="MDR Number" value={building.mdrNumber} />
                  <Field label="DHCR Reg ID" value={building.dhcrRegId} />
                </div>
              </Section>

              {/* Management Team */}
              <Section title="Management Team" icon={Users}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Field label="Manager" value={building.manager} />
                  <Field label="Mgmt Start Date" value={formatDate(building.mgmtStartDate)} />
                  <Field label="Owner" value={building.owner} />
                  <Field label="Owner Email" value={building.ownerEmail} />
                  <Field label="Head of Portfolio" value={building.headPortfolio} />
                  <Field label="AP Team" value={building.apTeam} />
                  <Field label="AR Team" value={building.arTeam} />
                </div>
              </Section>

              {/* Construction Details */}
              <Section title="Construction Details" icon={HardHat}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Field label="Square Footage" value={building.squareFootage ? `${building.squareFootage.toLocaleString()} sq ft` : null} />
                  <Field label="Year Built" value={building.yearBuilt} />
                  <Field label="Construction Type" value={building.constructionType} />
                  <Field label="Floors" value={building.floors} />
                  <Field label="Floors Below Ground" value={building.floorsBelowGround} />
                </div>
              </Section>
            </div>

            {/* Right Column */}
            <div className="space-y-5">
              {/* Life Safety Systems */}
              <Section title="Life Safety Systems" icon={Shield}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Field label="Sprinkler System" value={lifeSafety?.sprinkler} />
                  <Field label="Sprinkler Coverage" value={lifeSafety?.sprinklerCoverage} />
                  <Field label="Fire Alarm" value={lifeSafety?.fireAlarm} />
                  <Field label="Means of Egress" value={lifeSafety?.egress} />
                  <Field label="Backflow" value={lifeSafety?.backflow} />
                  <Field label="Standpipe" value={lifeSafety?.standpipe} />
                  <Field label="Cooling Tower" value={lifeSafety?.coolingTower} />
                  <Field label="Water Storage Tank" value={lifeSafety?.waterStorageTank} />
                  <Field label="Petroleum/Oil Tank" value={lifeSafety?.petroleumBulkStorage} />
                </div>
              </Section>

              {/* Elevator Info */}
              <Section title="Elevator Info" icon={ArrowUpDown}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Field label="Elevator Type" value={elevatorInfo?.type} />
                  <Field label="CAT 1 Date" value={elevatorInfo?.cat1Date} />
                  <Field label="CAT 5 Date" value={elevatorInfo?.cat5Date} />
                  <Field label="AOC Submitted" value={elevatorInfo?.aocSubmitted} />
                  <Field label="Follow-up Notes" value={elevatorInfo?.followUpNotes} full />
                </div>
              </Section>

              {/* Boiler Info */}
              <Section title="Boiler Info" icon={Gauge}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Field label="Last Inspection" value={boilerInfo?.lastInspectionDate} />
                  <Field label="Boiler Device" value={boilerInfo?.device} />
                  <Field label="Follow-up Notes" value={boilerInfo?.followUpNotes} full />
                </div>
              </Section>

              {/* Compliance Filing Dates */}
              <Section title="Compliance Filing Dates" icon={FileCheck}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Field label="LL152 Gas Pipe" value={compDates?.ll152GasPipe} />
                  <Field label="Parapet Inspection" value={compDates?.parapetInspection} />
                  <Field label="HPD Registration Year" value={compDates?.hpdRegistrationYear} />
                  <Field label="Bed Bug Filing Year" value={compDates?.bedBugFilingYear} />
                  <Field label="Safety Filing Year" value={compDates?.safetyFilingYear} />
                </div>
              </Section>

              {/* Building Services */}
              <Section title="Building Services">
                <ServiceCard
                  title="Superintendent"
                  icon={<Phone className="w-3.5 h-3.5" />}
                  name={sup?.name}
                  phone={sup?.phone}
                  email={sup?.email}
                />
                <ServiceCard
                  title="Elevator Company"
                  icon={<ArrowUpDown className="w-3.5 h-3.5" />}
                  name={elev?.name}
                  phone={elev?.phone}
                  extra={elev?.contract ? `Contract: ${elev.contract}` : undefined}
                />
                <ServiceCard
                  title="Fire Alarm Company"
                  icon={<Flame className="w-3.5 h-3.5" />}
                  name={fire?.name}
                  phone={fire?.phone}
                  extra={fire?.contract ? `Contract: ${fire.contract}` : undefined}
                />
              </Section>
            </div>
          </div>

          {/* Utilities — full width */}
          {(meters || accounts) && (
            <Section title="Utilities" icon={Zap}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-text-dim mb-1.5">Meter Numbers</p>
                  <div className="space-y-1 text-sm">
                    <UtilityRow label="Gas" value={meters?.gas} />
                    <UtilityRow label="Electric" value={meters?.electric} />
                    <UtilityRow label="Water" value={meters?.water} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-text-dim mb-1.5">Account Numbers</p>
                  <div className="space-y-1 text-sm">
                    <UtilityRow label="Gas" value={accounts?.gas} />
                    <UtilityRow label="Electric" value={accounts?.electric} />
                    <UtilityRow label="Water" value={accounts?.water} />
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* Units list — full width below */}
          {units.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-3">
                Units ({units.length})
              </h3>
              <div className="bg-bg border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-3 py-2 text-xs font-medium text-text-dim">Unit</th>
                      <th className="px-3 py-2 text-xs font-medium text-text-dim">Type</th>
                      <th className="px-3 py-2 text-xs font-medium text-text-dim">Tenant</th>
                      <th className="px-3 py-2 text-xs font-medium text-text-dim">Rent</th>
                      <th className="px-3 py-2 text-xs font-medium text-text-dim">Balance</th>
                      <th className="px-3 py-2 text-xs font-medium text-text-dim">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((u: any) => (
                      <tr key={u.id} className="border-b border-border/30">
                        <td className="px-3 py-2 text-text-primary font-medium">{u.unitNumber}</td>
                        <td className="px-3 py-2 text-text-muted">{u.unitType || "—"}</td>
                        <td className="px-3 py-2 text-text-muted">{u.tenant?.name || "—"}</td>
                        <td className="px-3 py-2 text-text-muted">{u.tenant ? fmt$(Number(u.tenant.marketRent)) : "—"}</td>
                        <td className="px-3 py-2 text-text-muted">{u.tenant ? fmt$(Number(u.tenant.balance)) : "—"}</td>
                        <td className="px-3 py-2">
                          {u.isVacant ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Vacant</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">Occupied</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="bg-bg border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-4 h-4 text-accent" />}
        <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, full }: { label: string; value: any; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <span className="text-text-dim text-xs">{label}</span>
      <p className="text-text-primary text-sm">{value || "—"}</p>
    </div>
  );
}

function ServiceCard({ title, icon, name, phone, email, extra }: {
  title: string; icon: React.ReactNode; name?: string; phone?: string; email?: string; extra?: string;
}) {
  const hasData = name || phone || email || extra;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="mt-0.5 text-accent">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-dim">{title}</p>
        {hasData ? (
          <>
            {name && <p className="text-sm text-text-primary">{name}</p>}
            {phone && <p className="text-xs text-text-muted flex items-center gap-1"><Phone className="w-3 h-3" />{phone}</p>}
            {email && <p className="text-xs text-text-muted flex items-center gap-1"><Mail className="w-3 h-3" />{email}</p>}
            {extra && <p className="text-xs text-text-muted">{extra}</p>}
          </>
        ) : (
          <p className="text-xs text-text-dim italic">Not set</p>
        )}
      </div>
    </div>
  );
}

function UtilityRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-dim">{label}</span>
      <span className="text-text-primary font-mono text-xs">{value || "—"}</span>
    </div>
  );
}
