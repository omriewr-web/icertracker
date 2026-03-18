"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Wand2, ClipboardCheck } from "lucide-react";
import { useComplianceItems, useDeleteComplianceItem, useGenerateComplianceDefaults } from "@/hooks/use-compliance";
import EmptyState from "@/components/ui/empty-state";
import { useAppStore } from "@/stores/app-store";
import Button from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { TableTabSkeleton } from "@/components/ui/skeleton";
import { fmt$, formatDate } from "@/lib/utils";
import ComplianceItemModal from "./compliance-item-modal";
import { COMPLIANCE_STATUS_COLORS } from "@/lib/constants/statuses";
import type { ComplianceItemView } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(COMPLIANCE_STATUS_COLORS).map(([k, v]) => [k, `${v.bg} ${v.text}`])
  ),
  NOT_APPLICABLE: "bg-card-hover text-text-dim",
};

export default function TrackerTab() {
  const { selectedBuildingId } = useAppStore();
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ComplianceItemView | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: items, isLoading } = useComplianceItems({
    category: filterCategory || undefined,
    status: filterStatus || undefined,
  });
  const deleteMutation = useDeleteComplianceItem();
  const generateMutation = useGenerateComplianceDefaults();

  if (isLoading) return <TableTabSkeleton rows={8} />;

  return (
    <div className="space-y-4">
      {/* Filters + Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="">All Categories</option>
          <option value="LOCAL_LAW">Local Law</option>
          <option value="INSPECTION">Inspection</option>
          <option value="FILING">Filing</option>
          <option value="CUSTOM">Custom</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="">All Statuses</option>
          <option value="COMPLIANT">Compliant</option>
          <option value="NON_COMPLIANT">Non-Compliant</option>
          <option value="PENDING">Pending</option>
          <option value="OVERDUE">Overdue</option>
          <option value="SCHEDULED">Scheduled</option>
        </select>
        <div className="flex-1" />
        {selectedBuildingId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate(selectedBuildingId)}
            disabled={generateMutation.isPending}
          >
            <Wand2 className="w-3.5 h-3.5" />
            {generateMutation.isPending ? "Generating..." : "Generate Defaults"}
          </Button>
        )}
        <Button size="sm" onClick={() => { setEditItem(null); setModalOpen(true); }}>
          <Plus className="w-3.5 h-3.5" /> Add Custom
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Name</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Category</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Frequency</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Next Due</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Building</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Vendor</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Cost</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item) => (
              <tr key={item.id} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                <td className="px-4 py-3 text-text-primary font-medium">{item.name}</td>
                <td className="px-4 py-3 text-text-muted text-xs">{item.category.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-text-muted text-xs">{item.frequency.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status] || ""}`}>
                    {item.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-muted text-xs">
                  {formatDate(item.nextDueDate)}
                  {item.daysUntilDue !== null && item.daysUntilDue <= 30 && (
                    <span className={`ml-1 ${item.daysUntilDue < 0 ? "text-red-400" : item.daysUntilDue < 14 ? "text-orange-400" : "text-yellow-400"}`}>
                      ({item.daysUntilDue < 0 ? `${Math.abs(item.daysUntilDue)}d overdue` : `${item.daysUntilDue}d`})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-text-muted text-xs truncate max-w-[150px]">{item.buildingAddress}</td>
                <td className="px-4 py-3 text-text-muted text-xs">{item.assignedVendorName || "—"}</td>
                <td className="px-4 py-3 text-text-muted font-mono">{Number(item.cost) > 0 ? fmt$(item.cost) : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => { setEditItem(item); setModalOpen(true); }} className="p-1 text-text-dim hover:text-accent" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {item.isCustom && (
                      <button onClick={() => setDeleteId(item.id)} className="p-1 text-text-dim hover:text-red-400" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!items || items.length === 0) && (
          <EmptyState icon={ClipboardCheck} title="No compliance items found" description={selectedBuildingId ? 'Click "Generate Defaults" to add standard NYC compliance items.' : "Select a building to get started."} />
        )}
      </div>

      <ComplianceItemModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditItem(null); }}
        item={editItem}
        defaultBuildingId={selectedBuildingId}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
        }}
        title="Delete Compliance Item"
        message="This will permanently delete this custom compliance item."
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
