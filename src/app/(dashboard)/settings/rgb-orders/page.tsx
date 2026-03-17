"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Trash2, AlertTriangle, Info, Pencil } from "lucide-react";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";

// ── Types ──────────────────────────────────────────────────────

interface RgbOrder {
  id: string;
  orderNumber: string;
  effectiveFrom: string;
  effectiveTo: string;
  oneYearPct: number;
  twoYearPct: number;
  twoYearY1Pct: number | null;
  twoYearY2Pct: number | null;
  notes: string | null;
  createdAt: string;
}

type FormData = {
  orderNumber: string;
  effectiveFrom: string;
  effectiveTo: string;
  oneYearPct: string;
  twoYearPct: string;
  twoYearY1Pct: string;
  twoYearY2Pct: string;
  notes: string;
};

const emptyForm: FormData = {
  orderNumber: "",
  effectiveFrom: "",
  effectiveTo: "",
  oneYearPct: "",
  twoYearPct: "",
  twoYearY1Pct: "",
  twoYearY2Pct: "",
  notes: "",
};

// ── Helpers ────────────────────────────────────────────────────

/** Convert decimal (0.0325) to display string ("3.25") */
function pctDisplay(v: number | null): string {
  if (v == null) return "-";
  return (v * 100).toFixed(2) + "%";
}

/** Parse user-entered percentage string to decimal, e.g. "3.25" -> 0.0325 */
function pctToDecimal(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  return parseFloat(trimmed) / 100;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toInputDate(iso: string): string {
  return iso.slice(0, 10);
}

// ── Data hooks ─────────────────────────────────────────────────

function useRgbOrders() {
  return useQuery<RgbOrder[]>({
    queryKey: ["rgb-orders"],
    queryFn: async () => {
      const res = await fetch("/api/settings/rgb-orders");
      if (!res.ok) throw new Error("Failed to fetch RGB orders");
      return res.json();
    },
  });
}

function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/settings/rgb-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create order");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rgb-orders"] });
      toast.success("RGB order created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/settings/rgb-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update order");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rgb-orders"] });
      toast.success("RGB order updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/rgb-orders/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete order");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rgb-orders"] });
      toast.success("RGB order deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Form Component ─────────────────────────────────────────────

function OrderForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial: FormData;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState<FormData>(initial);
  const set = (key: keyof FormData, value: string) => setForm((p) => ({ ...p, [key]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <label className="block col-span-2 sm:col-span-1">
          <span className="text-xs text-text-muted mb-1 block">Order Number</span>
          <input
            required
            className="w-full rounded-lg border border-border bg-atlas-navy-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/50"
            value={form.orderNumber}
            onChange={(e) => set("orderNumber", e.target.value)}
            placeholder="e.g. 57"
          />
        </label>
        <label className="block col-span-2 sm:col-span-1">
          <span className="text-xs text-text-muted mb-1 block">Notes</span>
          <input
            className="w-full rounded-lg border border-border bg-atlas-navy-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/50"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Optional"
          />
        </label>
        <label className="block">
          <span className="text-xs text-text-muted mb-1 block">Effective From</span>
          <input
            required
            type="date"
            className="w-full rounded-lg border border-border bg-atlas-navy-2 px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            value={form.effectiveFrom}
            onChange={(e) => set("effectiveFrom", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs text-text-muted mb-1 block">Effective To</span>
          <input
            required
            type="date"
            className="w-full rounded-lg border border-border bg-atlas-navy-2 px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            value={form.effectiveTo}
            onChange={(e) => set("effectiveTo", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs text-text-muted mb-1 block">1-Year %</span>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            max="15"
            className="w-full rounded-lg border border-border bg-atlas-navy-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/50"
            value={form.oneYearPct}
            onChange={(e) => set("oneYearPct", e.target.value)}
            placeholder="e.g. 3.25"
          />
        </label>
        <label className="block">
          <span className="text-xs text-text-muted mb-1 block">2-Year %</span>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            max="15"
            className="w-full rounded-lg border border-border bg-atlas-navy-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/50"
            value={form.twoYearPct}
            onChange={(e) => set("twoYearPct", e.target.value)}
            placeholder="e.g. 2.75"
          />
        </label>
        <label className="block">
          <span className="text-xs text-text-muted mb-1 block">2-Year Y1 % (optional)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max="15"
            className="w-full rounded-lg border border-border bg-atlas-navy-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/50"
            value={form.twoYearY1Pct}
            onChange={(e) => set("twoYearY1Pct", e.target.value)}
            placeholder="e.g. 1.50"
          />
        </label>
        <label className="block">
          <span className="text-xs text-text-muted mb-1 block">2-Year Y2 % (optional)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max="15"
            className="w-full rounded-lg border border-border bg-atlas-navy-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/50"
            value={form.twoYearY2Pct}
            onChange={(e) => set("twoYearY2Pct", e.target.value)}
            placeholder="e.g. 1.25"
          />
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="md" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="md" disabled={submitting}>
          {submitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}

// ── Page ───────────────────────────────────────────────────────

export default function RgbOrdersPage() {
  const { data: orders, isLoading, error } = useRgbOrders();
  const createMut = useCreateOrder();
  const updateMut = useUpdateOrder();
  const deleteMut = useDeleteOrder();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const buildFormPayload = useCallback((fd: FormData) => {
    const oneYearPct = pctToDecimal(fd.oneYearPct);
    const twoYearPct = pctToDecimal(fd.twoYearPct);
    const twoYearY1Pct = pctToDecimal(fd.twoYearY1Pct);
    const twoYearY2Pct = pctToDecimal(fd.twoYearY2Pct);

    if (oneYearPct == null || twoYearPct == null) {
      toast.error("1-Year % and 2-Year % are required");
      return null;
    }

    return {
      orderNumber: fd.orderNumber,
      effectiveFrom: fd.effectiveFrom,
      effectiveTo: fd.effectiveTo,
      oneYearPct,
      twoYearPct,
      twoYearY1Pct: twoYearY1Pct ?? null,
      twoYearY2Pct: twoYearY2Pct ?? null,
      notes: fd.notes || null,
    };
  }, []);

  const handleCreate = useCallback(
    (fd: FormData) => {
      const payload = buildFormPayload(fd);
      if (!payload) return;
      createMut.mutate(payload, { onSuccess: () => setShowCreate(false) });
    },
    [buildFormPayload, createMut],
  );

  const handleUpdate = useCallback(
    (id: string, fd: FormData) => {
      const payload = buildFormPayload(fd);
      if (!payload) return;
      updateMut.mutate({ id, data: payload }, { onSuccess: () => setEditingId(null) });
    },
    [buildFormPayload, updateMut],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteMut.mutate(id, { onSuccess: () => setDeleteConfirm(null) });
    },
    [deleteMut],
  );

  const latestOrder = orders?.[0];

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-wide text-text-primary">
            RGB Orders
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Manage Rent Guidelines Board orders and percentage rates.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="md">
          <Plus className="w-4 h-4" />
          Add New Order
        </Button>
      </div>

      {/* Alert banner */}
      <div className="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
        <Info className="w-5 h-5 text-accent mt-0.5 shrink-0" />
        <div className="text-sm text-text-muted">
          <span className="font-medium text-text-primary">Reminder:</span> RGB votes each June.
          New order takes effect October 1.
          {latestOrder && (
            <span className="ml-1">
              Latest order: <strong className="text-text-primary">#{latestOrder.orderNumber}</strong>{" "}
              ({fmtDate(latestOrder.effectiveFrom)} &ndash; {fmtDate(latestOrder.effectiveTo)})
            </span>
          )}
        </div>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="text-center text-text-dim py-12">Loading orders...</div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-atlas-red text-sm">
          <AlertTriangle className="w-4 h-4" />
          Failed to load RGB orders.
        </div>
      )}

      {/* Table */}
      {orders && orders.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-text-dim">
          <Info className="w-8 h-8 mb-2" />
          <p className="text-sm">No RGB orders yet. Click &ldquo;Add New Order&rdquo; to get started.</p>
        </div>
      )}

      {orders && orders.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-atlas-navy-2 text-text-muted text-left text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 sticky top-0 bg-atlas-navy-2">Order #</th>
                  <th className="px-4 py-3 sticky top-0 bg-atlas-navy-2">Effective From</th>
                  <th className="px-4 py-3 sticky top-0 bg-atlas-navy-2">Effective To</th>
                  <th className="px-4 py-3 sticky top-0 bg-atlas-navy-2 text-right">1-Year %</th>
                  <th className="px-4 py-3 sticky top-0 bg-atlas-navy-2 text-right">2-Year %</th>
                  <th className="px-4 py-3 sticky top-0 bg-atlas-navy-2">Notes</th>
                  <th className="px-4 py-3 sticky top-0 bg-atlas-navy-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order, idx) => (
                  <tr
                    key={order.id}
                    className={`${
                      idx % 2 === 0 ? "bg-atlas-navy-3" : "bg-atlas-navy-3/60"
                    } hover:bg-card-hover transition-colors`}
                  >
                    <td className="px-4 py-3 font-medium text-text-primary">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-text-muted">{fmtDate(order.effectiveFrom)}</td>
                    <td className="px-4 py-3 text-text-muted">{fmtDate(order.effectiveTo)}</td>
                    <td className="px-4 py-3 text-right font-mono text-text-primary">
                      {pctDisplay(order.oneYearPct)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-text-primary">
                      {pctDisplay(order.twoYearPct)}
                    </td>
                    <td className="px-4 py-3 text-text-dim max-w-[200px] truncate">
                      {order.notes || "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(order.id)}
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(order.id)}
                          title="Delete"
                          className="text-atlas-red hover:text-atlas-red"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add New RGB Order" wide>
        <OrderForm
          initial={emptyForm}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          submitting={createMut.isPending}
        />
      </Modal>

      {/* Edit Modal */}
      {editingId && (() => {
        const order = orders?.find((o) => o.id === editingId);
        if (!order) return null;
        const initial: FormData = {
          orderNumber: order.orderNumber,
          effectiveFrom: toInputDate(order.effectiveFrom),
          effectiveTo: toInputDate(order.effectiveTo),
          oneYearPct: (order.oneYearPct * 100).toFixed(2),
          twoYearPct: (order.twoYearPct * 100).toFixed(2),
          twoYearY1Pct: order.twoYearY1Pct != null ? (order.twoYearY1Pct * 100).toFixed(2) : "",
          twoYearY2Pct: order.twoYearY2Pct != null ? (order.twoYearY2Pct * 100).toFixed(2) : "",
          notes: order.notes || "",
        };
        return (
          <Modal
            open
            onClose={() => setEditingId(null)}
            title={`Edit Order #${order.orderNumber}`}
            wide
          >
            <OrderForm
              initial={initial}
              onSubmit={(fd) => handleUpdate(editingId, fd)}
              onCancel={() => setEditingId(null)}
              submitting={updateMut.isPending}
            />
          </Modal>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <Modal open onClose={() => setDeleteConfirm(null)} title="Confirm Deletion">
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              Are you sure you want to delete this RGB order? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="md" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                disabled={deleteMut.isPending}
                onClick={() => handleDelete(deleteConfirm)}
              >
                {deleteMut.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
