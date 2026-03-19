"use client";

import { useState } from "react";
import { Plus, CalendarClock, RotateCcw, Pencil, Trash2 } from "lucide-react";
import { useMaintenanceSchedules, useCreateMaintenanceSchedule, useUpdateMaintenanceSchedule, useDeleteMaintenanceSchedule } from "@/hooks/use-maintenance-schedules";
import { useBuildings } from "@/hooks/use-buildings";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import EmptyState from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

const FREQ_LABELS: Record<string, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUALLY: "Annually",
};

const FREQ_COLORS: Record<string, string> = {
  WEEKLY: "bg-blue-500/10 text-blue-400",
  MONTHLY: "bg-green-500/10 text-green-400",
  QUARTERLY: "bg-amber-500/10 text-amber-400",
  ANNUALLY: "bg-purple-500/10 text-purple-400",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  frequency: "MONTHLY",
  nextDueDate: "",
  autoCreateWorkOrder: true,
  buildingId: "",
};

export default function ScheduleManagement() {
  const { data: schedules, isLoading } = useMaintenanceSchedules();
  const createSchedule = useCreateMaintenanceSchedule();
  const updateSchedule = useUpdateMaintenanceSchedule();
  const deleteSchedule = useDeleteMaintenanceSchedule();
  const { data: buildings } = useBuildings();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(s: any) {
    setEditingId(s.id);
    setForm({
      title: s.title || "",
      description: s.description || "",
      frequency: s.frequency || "MONTHLY",
      nextDueDate: s.nextDueDate ? s.nextDueDate.slice(0, 10) : "",
      autoCreateWorkOrder: s.autoCreateWorkOrder ?? true,
      buildingId: s.buildingId || "",
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title: form.title,
      description: form.description || undefined,
      frequency: form.frequency,
      nextDueDate: form.nextDueDate,
      autoCreateWorkOrder: form.autoCreateWorkOrder,
      buildingId: form.buildingId,
    };

    const onSuccess = () => {
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    };

    if (editingId) {
      updateSchedule.mutate({ id: editingId, data: payload }, { onSuccess });
    } else {
      createSchedule.mutate(payload, { onSuccess });
    }
  }

  const isPending = editingId ? updateSchedule.isPending : createSchedule.isPending;

  if (isLoading) return <p className="text-text-dim text-sm py-4">Loading schedules…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-muted">Maintenance Schedules</h2>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" /> Add Schedule
        </Button>
      </div>

      {schedules && schedules.length > 0 ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Task</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Building</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Frequency</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Next Due</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Auto-Create</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => {
                const isOverdue = new Date(s.nextDueDate) < new Date();
                return (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                    <td className="px-3 py-2">
                      <p className="text-text-primary">{s.title}</p>
                      {s.description && <p className="text-xs text-text-dim line-clamp-1">{s.description}</p>}
                    </td>
                    <td className="px-3 py-2 text-text-muted text-xs">
                      {s.building.address}
                      {s.unit && <span className="ml-1">#{s.unit.unitNumber}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${FREQ_COLORS[s.frequency] || "bg-border text-text-dim"}`}>
                        <RotateCcw className="w-3 h-3 inline mr-0.5" />
                        {FREQ_LABELS[s.frequency] || s.frequency}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-xs ${isOverdue ? "text-red-400 font-medium" : "text-text-muted"}`}>
                      {formatDate(s.nextDueDate)}
                      {isOverdue && <span className="ml-1 text-red-400">Overdue</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-text-muted">
                      {s.autoCreateWorkOrder ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(s)}
                          className="text-text-dim hover:text-accent transition-colors p-1"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteSchedule.mutate(s.id)}
                          className="text-text-dim hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No schedules" description="Create recurring maintenance schedules" icon={CalendarClock} />
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditingId(null); }} title={editingId ? "Edit Schedule" : "Add Maintenance Schedule"}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-text-dim mb-1">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-text-dim mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-dim mb-1">Building *</label>
              <select
                value={form.buildingId}
                onChange={(e) => setForm({ ...form, buildingId: e.target.value })}
                required
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">Select building</option>
                {buildings?.map((b) => (
                  <option key={b.id} value={b.id}>{b.address}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1">Frequency *</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUALLY">Annually</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-dim mb-1">Next Due Date *</label>
              <input
                type="date"
                value={form.nextDueDate}
                onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })}
                required
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                checked={form.autoCreateWorkOrder}
                onChange={(e) => setForm({ ...form, autoCreateWorkOrder: e.target.checked })}
                className="rounded"
              />
              <label className="text-xs text-text-muted">Auto-create work order</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
            <Button type="submit" disabled={isPending || !form.title || !form.buildingId || !form.nextDueDate}>
              {isPending ? (editingId ? "Saving…" : "Creating…") : (editingId ? "Save Changes" : "Create Schedule")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
