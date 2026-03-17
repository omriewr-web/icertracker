"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  AlertTriangle,
  Scale,
  Phone,
  ChevronDown,
  ChevronUp,
  X,
  MoreVertical,
  MessageSquare,
  Check,
  Gavel,
} from "lucide-react";
import {
  useCollectionsDashboard,
  useCollectionTenants,
  useCreateCollectionNote,
  useUpdateCollectionStatus,
  useBulkCollectionAction,
  useSendToLegal,
  type ARTenantRow,
  type CollectionFilters,
} from "@/hooks/use-collections";
import { useBuildings } from "@/hooks/use-buildings";
import KpiCard from "@/components/ui/kpi-card";
import { TablePageSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { fmt$, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import ExportButton from "@/components/ui/export-button";

// ── Status config ──

const COLLECTION_STATUSES = [
  { value: "monitoring", label: "Monitoring", color: "bg-atlas-blue/10 text-atlas-blue" },
  { value: "demand_sent", label: "Demand Sent", color: "bg-atlas-amber/10 text-atlas-amber" },
  { value: "legal_referred", label: "Legal Referred", color: "bg-atlas-purple/10 text-atlas-purple" },
  { value: "payment_plan", label: "Payment Plan", color: "bg-atlas-green/10 text-atlas-green" },
  { value: "resolved", label: "Resolved", color: "bg-text-dim/10 text-text-dim" },
  // Legacy values from existing data
  { value: "new_arrears", label: "New Arrears", color: "bg-atlas-red/10 text-atlas-red" },
  { value: "reminder_sent", label: "Reminder Sent", color: "bg-atlas-amber/10 text-atlas-amber" },
  { value: "notice_served", label: "Notice Served", color: "bg-atlas-amber/10 text-atlas-amber" },
  { value: "legal_review", label: "Legal Review", color: "bg-atlas-purple/10 text-atlas-purple" },
  { value: "legal_filed", label: "Legal Filed", color: "bg-atlas-purple/10 text-atlas-purple" },
];

function getStatusConfig(status: string | null) {
  if (!status) return null;
  return COLLECTION_STATUSES.find((s) => s.value === status) || {
    value: status,
    label: status.replace(/_/g, " "),
    color: "bg-border text-text-dim",
  };
}

// ── Aging badge ──

function AgingBadge({ category }: { category: string }) {
  if (category === "120+" || category === "90")
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold font-data bg-atlas-red/10 text-atlas-red">90+</span>;
  if (category === "60")
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold font-data bg-atlas-amber/10 text-atlas-amber">61-90</span>;
  if (category === "30")
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold font-data bg-accent/10 text-accent">31-60</span>;
  return <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold font-data bg-atlas-green/10 text-atlas-green">0-30</span>;
}

// ── Days since note helper ──

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Quick action dropdown ──

function QuickActionMenu({
  row,
  onAddNote,
  onChangeStatus,
  onSendToLegal,
  onMarkResolved,
}: {
  row: ARTenantRow;
  onAddNote: (row: ARTenantRow) => void;
  onChangeStatus: (row: ARTenantRow) => void;
  onSendToLegal: (row: ARTenantRow) => void;
  onMarkResolved: (row: ARTenantRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1 text-text-dim hover:text-text-muted transition-colors rounded"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-card border border-border rounded-lg shadow-xl overflow-hidden animate-fade-in">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onAddNote(row); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:bg-card-hover hover:text-text-primary transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Add Note
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onChangeStatus(row); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:bg-card-hover hover:text-text-primary transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" /> Change Status
          </button>
          {!row.inLegal && row.collectionStatus !== "legal_referred" && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onSendToLegal(row); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Gavel className="w-3.5 h-3.5" /> Send to Legal
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onMarkResolved(row); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-green-400 hover:bg-green-500/10 transition-colors"
          >
            <Check className="w-3.5 h-3.5" /> Mark Resolved
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ──

export default function CollectionsContent() {
  const router = useRouter();
  const [filters, setFilters] = useState<CollectionFilters>({});
  const [minBalanceInput, setMinBalanceInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [collectionStatusFilter, setCollectionStatusFilter] = useState("");
  const [staleFilter, setStaleFilter] = useState(false);
  const [staleOpen, setStaleOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Bulk state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkNote, setBulkNote] = useState("");

  // Quick action modals
  const [noteTarget, setNoteTarget] = useState<ARTenantRow | null>(null);
  const [noteText, setNoteText] = useState("");
  const [statusTarget, setStatusTarget] = useState<ARTenantRow | null>(null);
  const [legalTarget, setLegalTarget] = useState<ARTenantRow | null>(null);
  const [resolveTarget, setResolveTarget] = useState<ARTenantRow | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  const { data: dashboard, isLoading: dashLoading } = useCollectionsDashboard();
  const { data: tenantsData, isLoading: tenantsLoading } = useCollectionTenants({
    ...filters,
    status: statusFilter || undefined,
    page,
    pageSize: 50,
  });
  const { data: buildings } = useBuildings();

  const createNote = useCreateCollectionNote();
  const updateStatus = useUpdateCollectionStatus();
  const bulkUpdate = useBulkCollectionAction();
  const sendToLegal = useSendToLegal();

  const isLoading = dashLoading || tenantsLoading;

  function handleBuildingFilter(buildingId: string) {
    setFilters((prev) => ({ ...prev, buildingId: buildingId || undefined }));
    setPage(1);
  }

  function applyMinBalance() {
    const mb = parseFloat(minBalanceInput);
    setFilters((prev) => ({ ...prev, minBalance: !isNaN(mb) && mb > 0 ? mb : undefined }));
    setPage(1);
  }

  const rows = tenantsData?.data ?? [];
  const totalPages = tenantsData ? Math.ceil(tenantsData.total / tenantsData.pageSize) : 1;

  // Client-side filters on collection status and stale
  const filteredRows = useMemo(() => {
    let result = rows;
    if (collectionStatusFilter) {
      if (collectionStatusFilter === "no_case") {
        result = result.filter((r) => !r.collectionStatus);
      } else {
        result = result.filter((r) => r.collectionStatus === collectionStatusFilter);
      }
    }
    if (staleFilter) {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      result = result.filter((r) => {
        if (r.balance <= 0) return false;
        if (!r.collectionNoteDate) return true;
        return new Date(r.collectionNoteDate).getTime() < thirtyDaysAgo;
      });
    }
    return result;
  }, [rows, collectionStatusFilter, staleFilter]);

  // Bulk helpers
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    if (selectedIds.size === filteredRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map((r) => r.id)));
    }
  }
  function clearSelection() {
    setSelectedIds(new Set());
    setBulkAction("");
    setBulkValue("");
    setBulkNote("");
  }
  function handleBulkApply() {
    if (selectedIds.size === 0) return;
    if (bulkAction === "change_status" && bulkValue) {
      bulkUpdate.mutate(
        { tenantIds: Array.from(selectedIds), action: "change_status", value: bulkValue },
        { onSuccess: clearSelection }
      );
    } else if (bulkAction === "add_note" && bulkNote) {
      bulkUpdate.mutate(
        { tenantIds: Array.from(selectedIds), action: "add_note", note: bulkNote },
        { onSuccess: clearSelection }
      );
    }
  }
  function handleBulkSendToLegal() {
    const ids = Array.from(selectedIds);
    let sent = 0;
    let skipped = 0;
    const promises = ids.map((id) => {
      const row = rows.find((r) => r.id === id);
      if (row?.inLegal || row?.collectionStatus === "legal_referred") {
        skipped++;
        return Promise.resolve();
      }
      return sendToLegal.mutateAsync(id).then(() => { sent++; }).catch(() => { skipped++; });
    });
    Promise.all(promises).then(() => {
      clearSelection();
    });
  }

  // Quick action handlers
  function handleQuickNote() {
    if (!noteTarget || !noteText.trim()) return;
    createNote.mutate(
      { tenantId: noteTarget.id, data: { content: noteText, actionType: "OTHER" } },
      { onSuccess: () => { setNoteTarget(null); setNoteText(""); } }
    );
  }
  function handleQuickStatus(status: string) {
    if (!statusTarget) return;
    updateStatus.mutate(
      { tenantId: statusTarget.id, status },
      { onSuccess: () => setStatusTarget(null) }
    );
  }
  function handleConfirmLegal() {
    if (!legalTarget) return;
    sendToLegal.mutate(legalTarget.id, {
      onSuccess: () => setLegalTarget(null),
      onError: () => setLegalTarget(null),
    });
  }
  function handleConfirmResolve() {
    if (!resolveTarget) return;
    const tenantId = resolveTarget.id;
    updateStatus.mutate(
      { tenantId, status: "resolved" },
      {
        onSuccess: () => {
          if (resolveNote.trim()) {
            createNote.mutate({ tenantId, data: { content: resolveNote, actionType: "OTHER" } });
          }
          setResolveTarget(null);
          setResolveNote("");
        },
      }
    );
  }

  if (isLoading) return <TablePageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-display tracking-wide">Collections</h1>
          <span className="text-[10px] text-text-dim tracking-[0.2em] uppercase hidden sm:inline">Financial — A/R Pipeline</span>
        </div>
        <ExportButton
          data={selectedIds.size > 0 ? filteredRows.filter((r) => selectedIds.has(r.id)) : filteredRows}
          filename="collections-ar-aging"
          columns={[
            { key: "name", label: "Tenant" },
            { key: "buildingAddress", label: "Building" },
            { key: "unitNumber", label: "Unit" },
            { key: "balance", label: "Balance" },
            { key: "arrearsCategory", label: "Aging" },
            { key: "collectionStatus", label: "Collection Status" },
            { key: "inLegal", label: "In Legal" },
            { key: "collectionNoteText", label: "Last Note" },
            { key: "collectionNoteDate", label: "Note Date" },
          ]}
          pdfConfig={{
            title: "A/R Aging Report",
            stats: [
              { label: "Total AR Balance", value: fmt$(dashboard?.totalBalance ?? 0) },
              { label: "Non-Paying Tenants", value: String(dashboard?.tenantCount ?? 0) },
              { label: "In Legal", value: String(dashboard?.legalCount ?? 0) },
              { label: "Stale (30+ days)", value: String(dashboard?.staleCount ?? 0) },
            ],
          }}
        />
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total AR Balance" value={fmt$(dashboard?.totalBalance ?? 0)} icon={DollarSign} color="#e05c5c" />
        <KpiCard label="Non-Paying Tenants" value={dashboard?.tenantCount ?? 0} icon={AlertTriangle} color="#e09a3e" />
        <KpiCard label="In Legal" value={dashboard?.legalCount ?? 0} icon={Scale} color="#8B5CF6" />
        <KpiCard label="Follow-Ups Due" value={dashboard?.followUpsDue ?? 0} subtext="Scheduled follow-ups due today" icon={Phone} color="#3B82F6" />
      </div>

      {/* ── Stale Tenants Alert ── */}
      {(dashboard?.staleCount ?? 0) > 0 && (
        <div className="bg-atlas-navy-3 border border-amber-500/30 rounded-xl overflow-hidden">
          <button
            onClick={() => setStaleOpen(!staleOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-card-hover transition-colors"
          >
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-400">
                {dashboard!.staleCount} tenant{dashboard!.staleCount !== 1 ? "s" : ""} with no notes in 30+ days
              </span>
            </div>
            {staleOpen ? <ChevronUp className="w-4 h-4 text-text-dim" /> : <ChevronDown className="w-4 h-4 text-text-dim" />}
          </button>
          {staleOpen && (
            <div className="px-4 pb-3 text-xs text-text-muted">
              <p>These tenants have outstanding balances but no recent follow-up activity.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="bg-atlas-navy-3 border border-border rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-text-dim uppercase tracking-wider">Building</label>
            <select
              value={filters.buildingId || ""}
              onChange={(e) => handleBuildingFilter(e.target.value)}
              className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent min-w-[180px]"
            >
              <option value="">All Buildings</option>
              {(buildings || []).map((b) => (
                <option key={b.id} value={b.id}>{b.address}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-text-dim uppercase tracking-wider">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent min-w-[140px]"
            >
              <option value="">All</option>
              <option value="LEGAL">In Legal</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-text-dim uppercase tracking-wider">Collection Status</label>
            <select
              value={collectionStatusFilter}
              onChange={(e) => setCollectionStatusFilter(e.target.value)}
              className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent min-w-[160px]"
            >
              <option value="">All</option>
              <option value="monitoring">Monitoring</option>
              <option value="demand_sent">Demand Sent</option>
              <option value="legal_referred">Legal Referred</option>
              <option value="payment_plan">Payment Plan</option>
              <option value="resolved">Resolved</option>
              <option value="no_case">No Case</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-text-dim uppercase tracking-wider">Min Balance</label>
            <input
              type="number"
              value={minBalanceInput}
              onChange={(e) => setMinBalanceInput(e.target.value)}
              onBlur={applyMinBalance}
              onKeyDown={(e) => e.key === "Enter" && applyMinBalance()}
              placeholder="$0"
              className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent w-24"
            />
          </div>

          <button
            onClick={() => setStaleFilter(!staleFilter)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors",
              staleFilter
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "border-border text-text-dim hover:text-text-muted hover:border-text-dim"
            )}
          >
            Stale Only
          </button>

          <span className="text-xs text-text-dim ml-auto">
            {filteredRows.length} tenant{filteredRows.length !== 1 ? "s" : ""}
            {selectedIds.size > 0 && ` (${selectedIds.size} selected)`}
          </span>
        </div>
      </div>

      {/* ── Bulk Action Toolbar ── */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-accent/10 border border-accent/30 rounded-lg px-4 py-2">
          <span className="text-sm text-text-primary font-medium">{selectedIds.size} tenants selected</span>
          <select
            value={bulkAction}
            onChange={(e) => { setBulkAction(e.target.value); setBulkValue(""); setBulkNote(""); }}
            className="bg-bg border border-border rounded-lg px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="">Select action…</option>
            <option value="change_status">Change Status</option>
            <option value="add_note">Add Note</option>
          </select>
          {bulkAction === "change_status" && (
            <select
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              className="bg-bg border border-border rounded-lg px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Select status…</option>
              <option value="monitoring">Monitoring</option>
              <option value="demand_sent">Demand Sent</option>
              <option value="legal_referred">Legal Referred</option>
              <option value="payment_plan">Payment Plan</option>
              <option value="resolved">Resolved</option>
            </select>
          )}
          {bulkAction === "add_note" && (
            <input
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              placeholder="Note text…"
              className="bg-bg border border-border rounded-lg px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent flex-1 min-w-[200px]"
            />
          )}
          {bulkAction && (
            <Button
              onClick={handleBulkApply}
              disabled={bulkUpdate.isPending || (bulkAction === "change_status" && !bulkValue) || (bulkAction === "add_note" && !bulkNote)}
            >
              {bulkUpdate.isPending ? "Applying…" : "Apply"}
            </Button>
          )}
          <Button variant="outline" onClick={handleBulkSendToLegal} disabled={sendToLegal.isPending}>
            <Gavel className="w-3.5 h-3.5" /> Send to Legal
          </Button>
          <ExportButton
            data={filteredRows.filter((r) => selectedIds.has(r.id))}
            filename="collections-selected"
            columns={[
              { key: "name", label: "Tenant" },
              { key: "buildingAddress", label: "Building" },
              { key: "unitNumber", label: "Unit" },
              { key: "balance", label: "Balance" },
              { key: "collectionStatus", label: "Status" },
            ]}
          />
          <button onClick={clearSelection} className="text-text-dim hover:text-text-muted transition-colors ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Tenant AR Table ── */}
      {filteredRows.length > 0 ? (
        <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-2 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={filteredRows.length > 0 && selectedIds.size === filteredRows.length}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Tenant</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Building</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Unit</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Balance</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-text-dim uppercase">Aging</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-text-dim uppercase">Status</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-text-dim uppercase">Legal</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-text-dim uppercase">Days Since Note</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Last Note</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const days = daysSince(row.collectionNoteDate);
                const notePreview = row.collectionNoteText
                  ? row.collectionNoteText.length > 60
                    ? row.collectionNoteText.slice(0, 60) + "…"
                    : row.collectionNoteText
                  : null;
                const statusCfg = getStatusConfig(row.collectionStatus);

                return (
                  <tr
                    key={row.id}
                    className="border-b border-border/50 hover:bg-card-hover transition-colors cursor-pointer"
                  >
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-2 text-text-primary" onClick={() => router.push(`/collections/${row.id}`)}>{row.name}</td>
                    <td className="px-3 py-2 text-text-muted text-xs" onClick={() => router.push(`/collections/${row.id}`)}>{row.buildingAddress}</td>
                    <td className="px-3 py-2 text-text-muted text-xs" onClick={() => router.push(`/collections/${row.id}`)}>{row.unitNumber}</td>
                    <td className="px-3 py-2 text-right text-red-400 font-mono" onClick={() => router.push(`/collections/${row.id}`)}>{fmt$(row.balance)}</td>
                    <td className="px-3 py-2 text-center" onClick={() => router.push(`/collections/${row.id}`)}><AgingBadge category={row.arrearsCategory} /></td>
                    <td className="px-3 py-2 text-center" onClick={() => router.push(`/collections/${row.id}`)}>
                      {statusCfg ? (
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap", statusCfg.color)}>
                          {statusCfg.label}
                        </span>
                      ) : (
                        <span className="text-text-dim">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center" onClick={() => router.push(`/collections/${row.id}`)}>
                      {row.inLegal && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-purple-500/10 text-purple-400">LEGAL</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center" onClick={() => router.push(`/collections/${row.id}`)}>
                      {days != null ? (
                        <span className={cn(
                          "text-xs font-mono",
                          days > 30 ? "text-red-400" : days > 14 ? "text-amber-400" : "text-text-muted"
                        )}>
                          {days}d
                        </span>
                      ) : (
                        <span className="text-text-dim">—</span>
                      )}
                    </td>
                    <td
                      className="px-3 py-2 text-text-dim text-xs max-w-[200px] truncate"
                      title={row.collectionNoteText || undefined}
                      onClick={() => router.push(`/collections/${row.id}`)}
                    >
                      {notePreview || "—"}
                    </td>
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <QuickActionMenu
                        row={row}
                        onAddNote={setNoteTarget}
                        onChangeStatus={setStatusTarget}
                        onSendToLegal={setLegalTarget}
                        onMarkResolved={setResolveTarget}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-text-dim">
                Page {page} of {totalPages} ({tenantsData!.total} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="text-xs px-3 py-1 rounded-lg border border-border text-text-muted hover:bg-card-hover disabled:opacity-40 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="text-xs px-3 py-1 rounded-lg border border-border text-text-muted hover:bg-card-hover disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title="No tenants in arrears"
          description="All tenants are current on their balances. Tenants with outstanding balances will appear here."
          icon={DollarSign}
        />
      )}

      {/* ── Quick Action: Add Note Modal ── */}
      <Modal open={!!noteTarget} onClose={() => { setNoteTarget(null); setNoteText(""); }} title={`Add Note — ${noteTarget?.name || ""}`}>
        <div className="space-y-3">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Enter collection note…"
            rows={3}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setNoteTarget(null); setNoteText(""); }}>Cancel</Button>
            <Button onClick={handleQuickNote} disabled={!noteText.trim() || createNote.isPending}>
              {createNote.isPending ? "Saving…" : "Add Note"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Quick Action: Change Status Modal ── */}
      <Modal open={!!statusTarget} onClose={() => setStatusTarget(null)} title={`Change Status — ${statusTarget?.name || ""}`}>
        <div className="space-y-2">
          {COLLECTION_STATUSES.slice(0, 5).map((s) => (
            <button
              key={s.value}
              onClick={() => handleQuickStatus(s.value)}
              disabled={updateStatus.isPending}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors text-left",
                statusTarget?.collectionStatus === s.value
                  ? `${s.color} border-current`
                  : "border-border text-text-muted hover:bg-card-hover"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full", s.color.split(" ")[0].replace("/10", ""))} />
              {s.label}
            </button>
          ))}
        </div>
      </Modal>

      {/* ── Quick Action: Send to Legal Confirmation ── */}
      <Modal open={!!legalTarget} onClose={() => setLegalTarget(null)} title="Confirm: Send to Legal">
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Are you sure you want to refer <span className="text-text-primary font-medium">{legalTarget?.name}</span> to legal?
            This will create a legal case and update the collection status.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLegalTarget(null)}>Cancel</Button>
            <Button onClick={handleConfirmLegal} disabled={sendToLegal.isPending}>
              {sendToLegal.isPending ? "Processing…" : "Confirm — Send to Legal"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Quick Action: Mark Resolved ── */}
      <Modal open={!!resolveTarget} onClose={() => { setResolveTarget(null); setResolveNote(""); }} title={`Mark Resolved — ${resolveTarget?.name || ""}`}>
        <div className="space-y-3">
          <p className="text-sm text-text-muted">Mark this tenant's collection case as resolved.</p>
          <textarea
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
            placeholder="Resolution note (optional)…"
            rows={2}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setResolveTarget(null); setResolveNote(""); }}>Cancel</Button>
            <Button onClick={handleConfirmResolve} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? "Saving…" : "Mark Resolved"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
