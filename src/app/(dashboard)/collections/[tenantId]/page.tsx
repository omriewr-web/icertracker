"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft,
  Phone,
  Voicemail,
  MessageSquare,
  Mail,
  FileText,
  HandCoins,
  DollarSign,
  Scale,
  Clock,
  Sparkles,
  Send,
  CalendarCheck,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { useCollectionProfile, useCreateCollectionNote, useUpdateCollectionStatus } from "@/hooks/use-collections";
import { PageSkeleton } from "@/components/ui/skeleton";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { fmt$, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { normalizeCollectionStatus, getStatusColor } from "@/lib/collections/types";
import { COLLECTION_PROFILE_STATUS_OPTIONS } from "@/lib/constants/statuses";
import AIEnhanceButton from "@/components/ui/ai-enhance-button";

// ── Action type config ──

const ACTION_TYPES = [
  { value: "CALLED", label: "Called", icon: Phone },
  { value: "LEFT_VOICEMAIL", label: "Left Voicemail", icon: Voicemail },
  { value: "TEXTED", label: "Texted", icon: MessageSquare },
  { value: "EMAILED", label: "Emailed", icon: Mail },
  { value: "NOTICE_SENT", label: "Notice Sent", icon: FileText },
  { value: "PAYMENT_PLAN", label: "Payment Plan", icon: HandCoins },
  { value: "PARTIAL_PAYMENT", label: "Partial Payment", icon: DollarSign },
  { value: "PROMISE_TO_PAY", label: "Promise to Pay", icon: CalendarCheck },
  { value: "SENT_TO_LEGAL", label: "Sent to Legal", icon: Scale },
  { value: "OTHER", label: "Other", icon: Clock },
] as const;

const ACTION_ICON_MAP: Record<string, typeof Phone> = Object.fromEntries(
  ACTION_TYPES.map((a) => [a.value, a.icon])
);

// ── Status display mapping (UI only, no schema change) ──

const STATUS_OPTIONS = COLLECTION_PROFILE_STATUS_OPTIONS;

function getStatusDisplay(dbStatus: string, arrearsDays?: number): { label: string; color: { bg: string; text: string } } {
  const label = normalizeCollectionStatus(dbStatus, arrearsDays);
  const color = getStatusColor(label);
  return { label, color };
}

// ── Score badge ──

function ScoreBadge({ score }: { score: number }) {
  const color =
    score <= 39 ? "bg-red-500/15 text-red-400 ring-red-500/30" :
    score <= 69 ? "bg-amber-500/15 text-amber-400 ring-amber-500/30" :
    "bg-green-500/15 text-green-400 ring-green-500/30";
  return (
    <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full ring-1 font-mono tabular-nums", color)}>
      {score}
    </span>
  );
}

// ── Chart tooltip ──

const chartTooltipStyle = {
  background: "linear-gradient(135deg, #141A24, #1A2232)",
  border: "1px solid #2A3441",
  borderRadius: 12,
  color: "#E8ECF1",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};

// ── Page component ──

export default function TenantCollectionPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useCollectionProfile(tenantId);
  const createNote = useCreateCollectionNote();
  const updateStatus = useUpdateCollectionStatus();

  // Note form state
  const [noteContent, setNoteContent] = useState("");
  const [noteAction, setNoteAction] = useState("CALLED");
  const [noteFollowUp, setNoteFollowUp] = useState("");

  // Status editor state
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [statusNotes, setStatusNotes] = useState("");

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editLegalRent, setEditLegalRent] = useState("");
  const [editPrefRent, setEditPrefRent] = useState("");
  const [editIsStabilized, setEditIsStabilized] = useState(false);
  const [editRegulationType, setEditRegulationType] = useState("UNKNOWN");
  const [editDhcrRegistrationId, setEditDhcrRegistrationId] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // AI panel state
  const [aiFetchedAt, setAiFetchedAt] = useState<Date | null>(null);
  const aiQuery = useQuery({
    queryKey: ["collections", "ai-recommend", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/collections/tenants/${tenantId}/ai-recommend`);
      if (!res.ok) throw new Error("Failed to get AI recommendation");
      setAiFetchedAt(new Date());
      return res.json();
    },
    enabled: false,
  });

  if (isLoading) return <PageSkeleton />;

  const tenant = profile?.tenant;
  const snapshot = profile?.latestARSnapshot;
  const balanceHistory = profile?.balanceHistory ?? [];

  // Merge both note sources into a unified timeline
  const collectionNotes = (profile?.collectionNotes ?? []).map((n: any) => ({
    id: n.id,
    actionType: n.actionType,
    content: n.content,
    author: n.author,
    createdAt: n.createdAt,
    followUpDate: n.followUpDate,
  }));
  const tenantNotes = (profile?.tenantNotes ?? []).map((n: any) => ({
    id: n.id,
    actionType: n.category || "OTHER",
    content: n.text,
    author: n.author,
    createdAt: n.createdAt,
    followUpDate: null,
  }));
  const notes = [...collectionNotes, ...tenantNotes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const tenantName = tenant?.name || "Tenant";
  const buildingAddress = tenant?.unit?.building?.address || "";
  const collectionCase = profile?.collectionCase;
  const currentStatus = collectionCase?.status || snapshot?.collectionStatus || "CURRENT";
  const totalBalance = snapshot ? Number(snapshot.totalBalance) : Number(tenant?.balance ?? 0);
  const collectionScore = tenant?.collectionScore ?? 0;
  const legalRent = tenant?.legalRent ?? null;
  const arrearsDays = tenant?.arrearsDays ?? 0;

  const statusDisplay = getStatusDisplay(currentStatus, arrearsDays);

  // Chart data from balance history
  const chartData = [...balanceHistory]
    .reverse()
    .map((s: any) => ({
      date: new Date(s.snapshotDate).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      balance: Number(s.currentBalance || 0),
    }));

  // If no history, show single point with current balance
  if (chartData.length === 0 && totalBalance > 0) {
    chartData.push({
      date: new Date().toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      balance: totalBalance,
    });
  }

  // Submit note
  function handleSubmitNote() {
    if (!noteContent.trim()) return;
    createNote.mutate(
      {
        tenantId,
        data: {
          content: noteContent,
          actionType: noteAction,
          followUpDate: noteFollowUp || undefined,
        },
      },
      {
        onSuccess: () => {
          setNoteContent("");
          setNoteFollowUp("");
        },
      }
    );
  }

  // Change status
  function handleStatusChange(dbValue: string) {
    updateStatus.mutate(
      { tenantId, status: dbValue },
      {
        onSuccess: () => {
          if (statusNotes.trim()) {
            createNote.mutate({
              tenantId,
              data: {
                content: `Status changed to ${dbValue}: ${statusNotes}`,
                actionType: "OTHER",
              },
            });
            setStatusNotes("");
          }
        },
      }
    );
  }

  // Trigger AI recommendation
  function handleGetAI() {
    aiQuery.refetch();
  }

  // Open edit modal pre-filled with current data
  function openEditModal() {
    setEditLegalRent(tenant?.legalRent != null ? String(Number(tenant.legalRent)) : "0");
    setEditPrefRent(tenant?.prefRent != null ? String(Number(tenant.prefRent)) : "0");
    setEditIsStabilized(tenant?.isStabilized ?? false);
    setEditRegulationType(tenant?.unit?.regulationType ?? "UNKNOWN");
    setEditDhcrRegistrationId(tenant?.unit?.dhcrRegistrationId ?? "");
    setEditOpen(true);
  }

  // Submit edit modal
  async function handleEditSubmit() {
    setEditSaving(true);
    try {
      const res = await fetch(`/api/collections/tenants/${tenantId}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalRent: parseFloat(editLegalRent) || 0,
          prefRent: parseFloat(editPrefRent) || 0,
          isStabilized: editIsStabilized,
          regulationType: editRegulationType,
          dhcrRegistrationId: editDhcrRegistrationId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update tenant");
      }
      toast.success("Tenant details updated");
      qc.invalidateQueries({ queryKey: ["collections", "profile", tenantId] });
      setEditOpen(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to update tenant";
      toast.error(message);
    } finally {
      setEditSaving(false);
    }
  }

  // Note border color by action type
  const NOTE_BORDER_COLORS: Record<string, string> = {
    CALLED: "border-l-blue-400",
    LEFT_VOICEMAIL: "border-l-blue-300",
    TEXTED: "border-l-cyan-400",
    EMAILED: "border-l-indigo-400",
    NOTICE_SENT: "border-l-orange-400",
    PAYMENT_PLAN: "border-l-emerald-400",
    PARTIAL_PAYMENT: "border-l-green-400",
    PROMISE_TO_PAY: "border-l-teal-400",
    SENT_TO_LEGAL: "border-l-purple-400",
    OTHER: "border-l-gray-400",
    GENERAL: "border-l-gray-400",
    COLLECTION: "border-l-amber-400",
    PAYMENT: "border-l-green-400",
    LEGAL: "border-l-purple-400",
    LEASE: "border-l-blue-400",
    MAINTENANCE: "border-l-orange-400",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Back link ── */}
      <button
        onClick={() => router.push("/collections")}
        className="flex items-center gap-1 text-sm text-text-dim hover:text-text-muted transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Collections
      </button>

      {/* ── SECTION 1: Header ── */}
      <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-text-primary">{tenantName}</h1>
              <ScoreBadge score={collectionScore} />
              <button
                onClick={openEditModal}
                className="p-1.5 rounded-lg text-text-dim hover:text-accent hover:bg-accent/10 transition-colors"
                aria-label="Edit tenant details"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-text-muted mt-1">
              {buildingAddress}
              {tenant?.unit?.unitNumber && (
                <span className="text-text-dim"> &middot; Unit {tenant.unit.unitNumber}</span>
              )}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase", statusDisplay.color.bg, statusDisplay.color.text)}>
                {statusDisplay.label}
              </span>
              {tenant?.leaseStatus && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-accent/10 text-accent uppercase">
                  {tenant.leaseStatus}
                </span>
              )}
              {tenant?.actualRent != null && Number(tenant.actualRent) > 0 && (
                <span className="text-xs text-text-dim">
                  Rent: <span className="text-text-muted font-mono">{fmt$(Number(tenant.actualRent))}</span>/mo
                </span>
              )}
              {tenant?.legalRent != null && Number(tenant.legalRent) > 0 && (
                <span className="text-xs text-text-dim">
                  Legal Rent: <span className="text-text-muted font-mono">{fmt$(Number(tenant.legalRent))}</span>/mo
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-dim uppercase tracking-wider">Total Balance</p>
            <p className={cn("text-3xl font-bold font-mono", totalBalance > 0 ? "text-red-400" : "text-green-400")}>
              {fmt$(totalBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── LEFT COLUMN (3/5 = 60%) ── */}
        <div className="lg:col-span-3 space-y-6">
          {/* ── SECTION 2: Balance Trend Chart ── */}
          <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
            <h2 className="text-sm font-medium text-text-muted mb-4">Balance Trend (Last 6 Months)</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                  <XAxis dataKey="date" tick={{ fill: "#8899AA", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => fmt$(v)} tick={{ fill: "#8899AA", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip
                    formatter={(v: number) => [fmt$(v), "Balance"]}
                    contentStyle={chartTooltipStyle}
                  />
                  <Line type="monotone" dataKey="balance" stroke="#EF4444" strokeWidth={2} dot={{ r: 3, fill: "#EF4444" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-sm text-text-dim">
                No balance history available yet.
              </div>
            )}
          </div>

          {/* ── SECTION 3: Aging Breakdown ── */}
          {legalRent === 0 || legalRent === null ? (
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-sm text-yellow-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Legal rent not set — Lost Rent calculation unavailable. Update tenant record to enable full AR reporting.
            </div>
          ) : null}

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Current", value: snapshot ? Number(snapshot.balance0_30) : totalBalance, color: "text-green-400" },
              { label: "30+", value: snapshot ? Number(snapshot.balance31_60) : 0, color: "text-yellow-400" },
              { label: "60+", value: snapshot ? Number(snapshot.balance61_90) : 0, color: "text-orange-400" },
              { label: "90+", value: snapshot ? Number(snapshot.balance90plus) : 0, color: "text-red-400" },
              { label: "120+", value: arrearsDays >= 120 && snapshot ? Number(snapshot.balance90plus) : 0, color: "text-red-500" },
            ].map((bucket) => (
              <div key={bucket.label} className="bg-atlas-navy-3 border border-border rounded-xl p-3">
                <p className="text-[10px] text-text-dim uppercase tracking-wider">{bucket.label}</p>
                <p className={cn("text-lg font-bold font-mono mt-1", bucket.color)}>{fmt$(bucket.value)}</p>
              </div>
            ))}
          </div>

          {/* ── SECTION 4: Collection Notes Timeline ── */}
          <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
            <h2 className="text-sm font-medium text-text-muted mb-4">Collection History</h2>
            {notes.length > 0 ? (
              <div className="space-y-0">
                {notes.map((note: any, i: number) => {
                  const ActionIcon = ACTION_ICON_MAP[note.actionType] || Clock;
                  const borderColor = NOTE_BORDER_COLORS[note.actionType] || "border-l-gray-500";
                  return (
                    <div key={note.id} className={cn("relative flex gap-3 pb-4 pl-3 border-l-2", borderColor)}>
                      {/* Icon */}
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-atlas-navy-3 border border-border">
                        <ActionIcon className="w-3.5 h-3.5 text-text-dim" />
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-text-primary">
                            {note.author?.name || "System"}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-text-dim font-medium uppercase">
                            {note.actionType.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-text-dim">
                            {formatDate(note.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-text-muted mt-1">{note.content}</p>
                        {note.followUpDate && (
                          <p className="text-[10px] text-blue-400 mt-1 flex items-center gap-1">
                            <CalendarCheck className="w-3 h-3" />
                            Follow-up: {formatDate(note.followUpDate)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-text-dim text-center py-6">No collection notes yet. Add one below to start tracking.</p>
            )}

            {/* Inline Add Note form */}
            <div className="mt-4 pt-4 border-t border-border space-y-3">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Describe the collection action taken..."
                rows={3}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent resize-none"
              />
              <AIEnhanceButton value={noteContent} context="collection_note" onEnhanced={(v) => setNoteContent(v)} />
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-dim uppercase tracking-wider">Action Type</label>
                  <select
                    value={noteAction}
                    onChange={(e) => setNoteAction(e.target.value)}
                    className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                  >
                    {ACTION_TYPES.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-dim uppercase tracking-wider">Follow-Up Date</label>
                  <input
                    type="date"
                    value={noteFollowUp}
                    onChange={(e) => setNoteFollowUp(e.target.value)}
                    className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleSubmitNote}
                  disabled={!noteContent.trim() || createNote.isPending}
                >
                  <Send className="w-3.5 h-3.5" />
                  {createNote.isPending ? "Saving..." : "Add Note"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (2/5 = 40%) ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* ── SECTION 5: Status Editor ── */}
          <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
            <h2 className="text-sm font-medium text-text-muted mb-1">Collection Status</h2>
            {collectionCase?.lastActionDate && (
              <p className="text-[10px] text-text-dim mb-3">Last changed: {formatDate(collectionCase.lastActionDate)}</p>
            )}
            <div className="space-y-2">
              <select
                value={pendingStatus ?? currentStatus}
                onChange={(e) => setPendingStatus(e.target.value)}
                disabled={updateStatus.isPending}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.dbValue} value={s.dbValue}>{s.label}</option>
                ))}
              </select>
              <textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Reason for status change (optional)..."
                rows={2}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent resize-none"
              />
              <AIEnhanceButton value={statusNotes} context="collection_note" onEnhanced={(v) => setStatusNotes(v)} />
              <Button
                size="sm"
                onClick={() => {
                  const target = pendingStatus ?? currentStatus;
                  handleStatusChange(target);
                  setPendingStatus(null);
                }}
                disabled={updateStatus.isPending || (!pendingStatus && !statusNotes.trim())}
              >
                {updateStatus.isPending ? "Saving..." : "Save Status"}
              </Button>
            </div>
          </div>

          {/* ── SECTION 6: AI Panel ── */}
          <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-medium text-text-primary">Atlas AI</h2>
              </div>
              {aiFetchedAt && (
                <span className="text-[10px] text-text-dim">
                  Last fetched: {aiFetchedAt.toLocaleTimeString()}
                </span>
              )}
            </div>

            {!aiQuery.data && !aiQuery.isLoading && !aiQuery.isError && (
              <Button size="sm" onClick={handleGetAI} className="w-full">
                <Sparkles className="w-3.5 h-3.5" /> Get Recommendations
              </Button>
            )}

            {aiQuery.isLoading && (
              <div className="space-y-3 py-2">
                <div className="h-3 bg-white/5 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-white/5 rounded animate-pulse w-full" />
                <div className="h-3 bg-white/5 rounded animate-pulse w-2/3" />
              </div>
            )}

            {aiQuery.isError && (
              <div className="text-sm text-red-400 py-2">
                Failed to load recommendation.
                <button onClick={() => aiQuery.refetch()} className="ml-2 text-accent hover:text-accent-light underline">
                  Retry
                </button>
              </div>
            )}

            {aiQuery.data && (
              <div className="space-y-4">
                {/* Structured recommendations */}
                {aiQuery.data.recommendations?.length > 0 ? (
                  <div className="space-y-3">
                    {aiQuery.data.recommendations.map((rec: any, i: number) => {
                      const urgencyColor =
                        rec.urgency === "High" ? "bg-red-500/10 text-red-400" :
                        rec.urgency === "Medium" ? "bg-yellow-500/10 text-yellow-400" :
                        "bg-green-500/10 text-green-400";
                      return (
                        <div key={i} className="bg-bg border border-border rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-text-primary">{rec.title}</span>
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase", urgencyColor)}>
                              {rec.urgency}
                            </span>
                          </div>
                          <p className="text-xs text-text-muted">{rec.explanation}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : aiQuery.data.fallback ? (
                  /* Fallback: raw text from AI */
                  <div className="bg-bg border border-border rounded-lg p-3 text-sm text-text-muted whitespace-pre-wrap">
                    {aiQuery.data.fallback}
                  </div>
                ) : null}

                <button
                  onClick={handleGetAI}
                  className="text-xs text-text-dim hover:text-accent transition-colors"
                >
                  Refresh recommendations
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit Tenant Modal ── */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Tenant Details">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-dim uppercase tracking-wider">Legal Rent</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={editLegalRent}
              onChange={(e) => setEditLegalRent(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-dim uppercase tracking-wider">Preferential Rent</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={editPrefRent}
              onChange={(e) => setEditPrefRent(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="editIsStabilized"
              checked={editIsStabilized}
              onChange={(e) => setEditIsStabilized(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-bg text-accent focus:ring-accent"
            />
            <label htmlFor="editIsStabilized" className="text-sm text-text-primary">Rent Stabilized</label>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-dim uppercase tracking-wider">Regulation Type</label>
            <select
              value={editRegulationType}
              onChange={(e) => setEditRegulationType(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="STABILIZED">Stabilized</option>
              <option value="CONTROLLED">Controlled</option>
              <option value="UNREGULATED">Unregulated</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-dim uppercase tracking-wider">DHCR Registration ID</label>
            <input
              type="text"
              value={editDhcrRegistrationId}
              onChange={(e) => setEditDhcrRegistrationId(e.target.value)}
              placeholder="e.g. RN12345678"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleEditSubmit} disabled={editSaving}>
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
