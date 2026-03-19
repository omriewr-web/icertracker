"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";
import { useWorkOrder, useUpdateWorkOrder, useDeleteWorkOrder, useCreateWorkOrderComment, useWorkOrderActivity, useUploadWorkOrderPhotos } from "@/hooks/use-work-orders";
import { useVendors } from "@/hooks/use-vendors";
import { useUsers } from "@/hooks/use-users";
import PriorityBadge from "./priority-badge";
import CategoryBadge from "./category-badge";
import DueDateBadge from "./due-date-badge";
import SourceBadge from "./source-badge";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { formatDate } from "@/lib/utils";
import { Trash2, Upload, ImageIcon, FolderKanban } from "lucide-react";
import type { WorkOrderActivityEntry } from "@/hooks/use-work-orders";
import AIEnhanceButton from "@/components/ui/ai-enhance-button";

const STATUSES = ["OPEN", "IN_PROGRESS", "ON_HOLD", "COMPLETED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const CATEGORIES = ["PLUMBING", "ELECTRICAL", "HVAC", "APPLIANCE", "GENERAL", "OTHER"] as const;

const ACTION_LABELS: Record<string, string> = {
  status_changed: "Status changed",
  priority_changed: "Priority changed",
  vendor_assigned: "Vendor changed",
  user_assigned: "Assignee changed",
  due_date_set: "Due date changed",
  completed: "Completed",
};

interface Props {
  workOrderId: string | null;
  onClose: () => void;
}

export default function WorkOrderDetailModal({ workOrderId, onClose }: Props) {
  const router = useRouter();
  const { data: wo, isLoading, isError } = useWorkOrder(workOrderId);
  const updateWO = useUpdateWorkOrder();
  const deleteWO = useDeleteWorkOrder();
  const { data: vendors } = useVendors();
  const { data: users } = useUsers();
  const { data: activity } = useWorkOrderActivity(workOrderId);
  const uploadPhotos = useUploadWorkOrderPhotos(workOrderId || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"details" | "comments" | "activity" | "themis">("details");
  const [commentText, setCommentText] = useState("");
  const addComment = useCreateWorkOrderComment(workOrderId || "");

  const [units, setUnits] = useState<{ id: string; unitNumber: string; tenantId?: string; tenantName?: string }[]>([]);
  const [form, setForm] = useState({
    status: "OPEN" as string,
    priority: "MEDIUM" as string,
    category: "GENERAL" as string,
    vendorId: "",
    assignedToId: "",
    estimatedCost: "",
    actualCost: "",
    scheduledDate: "",
    dueDate: "",
    unitId: "",
    tenantId: "",
  });

  // Load units when work order loads (for unit/tenant pre-population)
  useEffect(() => {
    if (wo?.buildingId) {
      fetch(`/api/units?buildingId=${wo.buildingId}`)
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setUnits(data.map((u: any) => ({
          id: u.id,
          unitNumber: u.unitNumber,
          tenantId: u.tenant?.id || null,
          tenantName: u.tenant?.name || null,
        }))))
        .catch(() => setUnits([]));
    }
  }, [wo?.buildingId]);

  useEffect(() => {
    if (wo) {
      setForm({
        status: wo.status,
        priority: wo.priority,
        category: wo.category,
        vendorId: wo.vendorId || "",
        assignedToId: wo.assignedToId || "",
        estimatedCost: wo.estimatedCost ? String(Number(wo.estimatedCost)) : "",
        actualCost: wo.actualCost ? String(Number(wo.actualCost)) : "",
        scheduledDate: wo.scheduledDate ? new Date(wo.scheduledDate).toISOString().split("T")[0] : "",
        dueDate: wo.dueDate ? new Date(wo.dueDate).toISOString().split("T")[0] : "",
        unitId: wo.unitId || "",
        tenantId: wo.tenantId || "",
      });
    }
  }, [wo]);

  function handleSave() {
    if (!workOrderId) return;
    updateWO.mutate({
      id: workOrderId,
      data: {
        status: form.status,
        priority: form.priority,
        category: form.category,
        vendorId: form.vendorId || null,
        assignedToId: form.assignedToId || null,
        estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : null,
        actualCost: form.actualCost ? parseFloat(form.actualCost) : null,
        scheduledDate: form.scheduledDate || null,
        dueDate: form.dueDate || null,
        unitId: form.unitId || null,
        tenantId: form.tenantId || null,
      },
    });
  }

  function handleAddComment() {
    if (!commentText.trim()) return;
    addComment.mutate({ text: commentText.trim() }, { onSuccess: () => setCommentText("") });
  }

  function handleDelete() {
    if (!workOrderId) return;
    deleteWO.mutate(workOrderId, { onSuccess: onClose });
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    uploadPhotos.mutate(files);
    e.target.value = "";
  }

  function handleUnitChange(unitId: string) {
    const unit = units.find((u) => u.id === unitId);
    setForm({
      ...form,
      unitId,
      tenantId: unit?.tenantId || "",
    });
  }

  if (!workOrderId) return null;

  return (
    <Modal open={!!workOrderId} onClose={onClose} title={wo?.title || "Work Order"} wide>
      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <div className="text-center py-8 text-red-400 text-sm">Failed to load work order. Please try again.</div>
      ) : wo ? (
        <div>
          {/* Header badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <DueDateBadge dueDate={wo.dueDate} status={wo.status} />
            <SourceBadge sourceType={wo.sourceType} sourceId={wo.sourceId} linked />
          </div>

          <div className="flex gap-1 border-b border-border mb-4">
            {(["details", "comments", "activity", "themis"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  tab === t ? "text-accent border-b-2 border-accent" : "text-text-dim hover:text-text-muted"
                }`}
              >
                {t === "themis" ? "Defense Package" : t.charAt(0).toUpperCase() + t.slice(1)}
                {t === "comments" && wo.comments?.length ? ` (${wo.comments.length})` : ""}
                {t === "activity" && activity?.length ? ` (${activity.length})` : ""}
              </button>
            ))}
          </div>

          {tab === "details" && (
            <div className="space-y-4">
              <div className="bg-bg/50 rounded-lg p-3 border border-border/50">
                <p className="text-sm text-text-primary whitespace-pre-wrap">{wo.description}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <Field label="Building" value={wo.buildingAddress} />
                <Field label="Unit" value={wo.unitNumber || "—"} />
                <Field label="Tenant" value={wo.tenantName || "—"} />
                <Field label="Created" value={formatDate(wo.createdAt)} />
                <Field label="Created By" value={wo.createdByName || "—"} />
                {wo.completedDate && <Field label="Completed" value={formatDate(wo.completedDate)} />}
              </div>

              <div className="border-t border-border pt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-dim mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-dim mb-1">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-dim mb-1">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-dim mb-1">Scheduled Date</label>
                  <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-xs text-text-dim mb-1">Due Date</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-xs text-text-dim mb-1">Unit</label>
                  <select value={form.unitId} onChange={(e) => handleUnitChange(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
                    <option value="">None</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.unitNumber}{u.tenantName ? ` — ${u.tenantName}` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-dim mb-1">Vendor</label>
                  <select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
                    <option value="">None</option>
                    {vendors?.map((v) => <option key={v.id} value={v.id}>{v.name}{v.company ? ` — ${v.company}` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-dim mb-1">Assigned To</label>
                  <select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })} className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
                    <option value="">Unassigned</option>
                    {users?.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-dim mb-1">Estimated Cost</label>
                  <input type="number" value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} placeholder="0.00" className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-xs text-text-dim mb-1">Actual Cost</label>
                  <input type="number" value={form.actualCost} onChange={(e) => setForm({ ...form, actualCost: e.target.value })} placeholder="0.00" className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                </div>
              </div>

              {/* Photo upload */}
              <div className="border-t border-border pt-3">
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploadPhotos.isPending}>
                  <Upload className="w-3.5 h-3.5" /> {uploadPhotos.isPending ? "Uploading..." : "Upload Photos"}
                </Button>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Button variant="danger" size="sm" onClick={handleDelete}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { onClose(); router.push(`/projects?fromWO=${workOrderId}&buildingId=${wo.buildingId}&name=${encodeURIComponent(wo.title)}&category=OTHER`); }}>
                    <FolderKanban className="w-3.5 h-3.5" /> Create Project
                  </Button>
                </div>
                <Button onClick={handleSave} disabled={updateWO.isPending}>
                  {updateWO.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}

          {tab === "comments" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
                  rows={3}
                />
                <AIEnhanceButton value={commentText} context="work_order_note" onEnhanced={(v) => setCommentText(v)} />
                <Button size="sm" onClick={handleAddComment} disabled={!commentText.trim() || addComment.isPending}>
                  {addComment.isPending ? "Adding..." : "Add Comment"}
                </Button>
              </div>

              <div className="space-y-3">
                {(wo.comments || []).length === 0 ? (
                  <p className="text-text-dim text-sm">No comments yet</p>
                ) : (
                  (wo.comments || []).map((c: any) => (
                    <div key={c.id} className="border-l-2 border-accent pl-3 py-1">
                      <p className="text-sm text-text-primary whitespace-pre-wrap">{c.text}</p>
                      {/* Render comment photos */}
                      {c.photos && Array.isArray(c.photos) && c.photos.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(c.photos as string[]).map((url: string, i: number) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                              <img
                                src={url}
                                alt={`Photo ${i + 1}`}
                                className="w-20 h-20 object-cover rounded-lg border border-border hover:border-accent transition-colors cursor-pointer"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-text-dim mt-1">
                        {c.author?.name} &middot; {formatDate(c.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === "activity" && (
            <div className="space-y-2">
              {!activity || activity.length === 0 ? (
                <p className="text-text-dim text-sm">No activity logged yet</p>
              ) : (
                (activity || []).map((a: WorkOrderActivityEntry) => (
                  <div key={a.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                    <div className="flex-1">
                      <p className="text-sm text-text-primary">
                        <span className="font-medium">{ACTION_LABELS[a.action] || a.action}</span>
                        {a.fromValue && a.toValue && (
                          <span className="text-text-muted">
                            {" "}{a.fromValue.replace(/_/g, " ")} &rarr; {a.toValue.replace(/_/g, " ")}
                          </span>
                        )}
                        {!a.fromValue && a.toValue && (
                          <span className="text-text-muted"> &rarr; {a.toValue.replace(/_/g, " ")}</span>
                        )}
                        {a.fromValue && !a.toValue && (
                          <span className="text-text-muted"> (removed: {a.fromValue.replace(/_/g, " ")})</span>
                        )}
                      </p>
                      <p className="text-xs text-text-dim">
                        {a.user?.name || "System"} &middot; {formatDate(a.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "themis" && (
            <div className="space-y-4">
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase' }} className="text-text-muted">
                DOCUMENTATION PACKAGE
              </p>

              {wo.status === "COMPLETED" ? (
                <button
                  onClick={() => { router.push(`/themis?workOrderId=${wo.id}`); onClose(); }}
                  style={{
                    border: '1px solid rgba(200,144,26,0.35)',
                    background: 'rgba(200,144,26,0.08)',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '10px',
                    borderRadius: '5px',
                    padding: '8px 14px',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                  className="text-accent hover:bg-accent/15 transition-colors"
                >
                  Generate Defense Package
                </button>
              ) : (
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', textAlign: 'center', padding: '20px' }} className="text-text-muted">
                  Complete this work order to generate a defense package
                </p>
              )}

              <div>
                <div className="flex items-center justify-between py-1.5 border-b border-border/50" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px' }}>
                  <span className="text-text-muted">Evidence photos</span>
                  <span className="text-text-primary">{Array.isArray(wo.photos) ? wo.photos.length : 0} files</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border/50" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px' }}>
                  <span className="text-text-muted">Access attempts</span>
                  <span className="text-text-primary">None logged</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border/50" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px' }}>
                  <span className="text-text-muted">Linked violation</span>
                  <span className="text-text-primary">{wo.violationId ? wo.violationId.slice(0, 8) + "..." : "None"}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <span className="text-text-dim">{label}</span>
      <p className="text-text-primary">{value || "—"}</p>
    </div>
  );
}
