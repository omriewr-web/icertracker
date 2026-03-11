"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
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
  ChevronDown,
  ChevronUp,
  Sparkles,
  Send,
  CalendarCheck,
} from "lucide-react";
import { useCollectionProfile, useCreateCollectionNote, useUpdateCollectionStatus } from "@/hooks/use-collections";
import { PageSkeleton } from "@/components/ui/skeleton";
import Button from "@/components/ui/button";
import { fmt$, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

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

// ── Status config ──

const ALL_STATUSES = [
  "CURRENT", "LATE", "DELINQUENT", "CHRONIC", "PAYMENT_PLAN", "LEGAL", "VACATE_PENDING",
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  CURRENT:        { bg: "bg-green-500/10", text: "text-green-400" },
  LATE:           { bg: "bg-yellow-500/10", text: "text-yellow-400" },
  DELINQUENT:     { bg: "bg-orange-500/10", text: "text-orange-400" },
  CHRONIC:        { bg: "bg-red-500/10", text: "text-red-400" },
  PAYMENT_PLAN:   { bg: "bg-blue-500/10", text: "text-blue-400" },
  LEGAL:          { bg: "bg-purple-500/10", text: "text-purple-400" },
  VACATE_PENDING: { bg: "bg-gray-500/10", text: "text-gray-400" },
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.CURRENT;
  return (
    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase", color.bg, color.text)}>
      {status.replace(/_/g, " ")}
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

  // ── Note form state ──
  const [noteContent, setNoteContent] = useState("");
  const [noteAction, setNoteAction] = useState("CALLED");
  const [noteFollowUp, setNoteFollowUp] = useState("");

  // ── AI panel state ──
  const [aiOpen, setAiOpen] = useState(false);
  const aiQuery = useQuery({
    queryKey: ["collections", "ai-recommend", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/collections/tenants/${tenantId}/ai-recommend`);
      if (!res.ok) throw new Error("Failed to get AI recommendation");
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

  // ── Chart data from balance history ──
  const chartData = [...balanceHistory]
    .reverse()
    .map((s: any) => ({
      date: new Date(s.snapshotDate).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      balance: Number(s.currentBalance || 0),
    }));

  // ── Submit note ──
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

  // ── Change status ──
  function handleStatusChange(status: string) {
    updateStatus.mutate({ tenantId, status });
  }

  // ── Trigger AI recommendation ──
  function handleGetAI() {
    setAiOpen(true);
    aiQuery.refetch();
  }

  const collectionCase = profile?.collectionCase;
  const currentStatus = collectionCase?.status || snapshot?.collectionStatus || "CURRENT";
  const totalBalance = snapshot ? Number(snapshot.totalBalance) : Number(tenant?.balance ?? 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Back + Header ── */}
      <button
        onClick={() => router.push("/collections")}
        className="flex items-center gap-1 text-sm text-text-dim hover:text-text-muted transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Collections
      </button>

      <div className="bg-card-gradient border border-border rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{tenantName}</h1>
            <p className="text-sm text-text-muted mt-1">
              {buildingAddress}
              {tenant?.unit?.unitNumber && (
                <span className="text-text-dim"> &middot; Unit {tenant.unit.unitNumber}</span>
              )}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={currentStatus} />
              {tenant?.leaseStatus && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-accent/10 text-accent uppercase">
                  {tenant.leaseStatus}
                </span>
              )}
              {tenant?.actualRent && (
                <span className="text-xs text-text-dim">
                  Rent: <span className="text-text-muted font-mono">{fmt$(Number(tenant.actualRent))}</span>/mo
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

      {/* ── Balance Trend Chart ── */}
      {chartData.length > 1 && (
        <div className="bg-card-gradient border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium text-text-muted mb-4">Balance Trend (Last 6 Months)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="balance-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: "#8899AA", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => fmt$(v)} tick={{ fill: "#8899AA", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip
                formatter={(v: number) => [fmt$(v), "Balance"]}
                contentStyle={chartTooltipStyle}
              />
              <Area type="monotone" dataKey="balance" stroke="#EF4444" fill="url(#balance-gradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Aging Breakdown ── */}
      {snapshot && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card-gradient border border-border rounded-xl p-4">
            <p className="text-xs text-text-dim uppercase tracking-wider">0-30 Days</p>
            <p className="text-xl font-bold font-mono text-green-400 mt-1">{fmt$(Number(snapshot.balance0_30))}</p>
          </div>
          <div className="bg-card-gradient border border-border rounded-xl p-4">
            <p className="text-xs text-text-dim uppercase tracking-wider">31-60 Days</p>
            <p className="text-xl font-bold font-mono text-yellow-400 mt-1">{fmt$(Number(snapshot.balance31_60))}</p>
          </div>
          <div className="bg-card-gradient border border-border rounded-xl p-4">
            <p className="text-xs text-text-dim uppercase tracking-wider">61-90 Days</p>
            <p className="text-xl font-bold font-mono text-orange-400 mt-1">{fmt$(Number(snapshot.balance61_90))}</p>
          </div>
          <div className="bg-card-gradient border border-border rounded-xl p-4">
            <p className="text-xs text-text-dim uppercase tracking-wider">90+ Days</p>
            <p className="text-xl font-bold font-mono text-red-400 mt-1">{fmt$(Number(snapshot.balance90plus))}</p>
          </div>
        </div>
      )}

      {/* ── Collection Status ── */}
      <div className="bg-card-gradient border border-border rounded-xl p-5">
        <h2 className="text-sm font-medium text-text-muted mb-3">Collection Status</h2>
        <div className="flex flex-wrap items-center gap-2">
          {ALL_STATUSES.map((s) => {
            const color = STATUS_COLORS[s] || STATUS_COLORS.CURRENT;
            const isActive = currentStatus === s;
            return (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                disabled={updateStatus.isPending}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full font-medium transition-all border",
                  isActive
                    ? `${color.bg} ${color.text} border-current ring-1 ring-current/30`
                    : "border-border text-text-dim hover:text-text-muted hover:border-text-dim"
                )}
              >
                {s.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Add Note Form ── */}
      <div className="bg-card-gradient border border-border rounded-xl p-5">
        <h2 className="text-sm font-medium text-text-muted mb-3">Add Collection Note</h2>
        <div className="space-y-3">
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Describe the collection action taken..."
            rows={3}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent resize-none"
          />
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

      {/* ── Notes Timeline ── */}
      <div className="bg-card-gradient border border-border rounded-xl p-5">
        <h2 className="text-sm font-medium text-text-muted mb-4">Collection History</h2>
        {notes.length > 0 ? (
          <div className="space-y-0">
            {notes.map((note: any, i: number) => {
              const ActionIcon = ACTION_ICON_MAP[note.actionType] || Clock;
              const color = STATUS_COLORS[note.actionType] || { bg: "bg-accent/10", text: "text-accent" };
              return (
                <div key={note.id} className="relative flex gap-3 pb-4">
                  {/* Timeline line */}
                  {i < notes.length - 1 && (
                    <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
                  )}
                  {/* Icon */}
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", color.bg)}>
                    <ActionIcon className={cn("w-3.5 h-3.5", color.text)} />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-text-primary">
                        {note.author?.name || "System"}
                      </span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase", color.bg, color.text)}>
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
          <p className="text-sm text-text-dim text-center py-6">No collection notes yet. Add one above to start tracking.</p>
        )}
      </div>

      {/* ── AI Recommendation Panel ── */}
      <div className="bg-card-gradient border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => aiOpen ? setAiOpen(false) : handleGetAI()}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-card-hover transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-text-primary">AI Recommendation</span>
          </div>
          {aiOpen ? <ChevronUp className="w-4 h-4 text-text-dim" /> : <ChevronDown className="w-4 h-4 text-text-dim" />}
        </button>

        {aiOpen && (
          <div className="px-5 pb-5 border-t border-border pt-4">
            {aiQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-text-dim py-4">
                <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                Analyzing tenant collection profile...
              </div>
            )}

            {aiQuery.isError && (
              <div className="text-sm text-red-400 py-2">
                Failed to load recommendation. The AI endpoint may not be configured yet.
                <button onClick={() => aiQuery.refetch()} className="ml-2 text-accent hover:text-accent-light underline">
                  Retry
                </button>
              </div>
            )}

            {aiQuery.data && (
              <div className="space-y-4">
                {/* Risk Score */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-dim uppercase tracking-wider">Risk Score</span>
                  <span className={cn(
                    "text-sm px-2.5 py-0.5 rounded-full font-bold uppercase",
                    aiQuery.data.riskScore === "CRITICAL" ? "bg-red-500/10 text-red-400" :
                    aiQuery.data.riskScore === "HIGH" ? "bg-orange-500/10 text-orange-400" :
                    aiQuery.data.riskScore === "MEDIUM" ? "bg-yellow-500/10 text-yellow-400" :
                    "bg-green-500/10 text-green-400"
                  )}>
                    {aiQuery.data.riskScore ?? "—"}
                  </span>
                </div>

                {/* Recommended Action */}
                {aiQuery.data.recommendedAction && (
                  <div>
                    <p className="text-xs text-text-dim uppercase tracking-wider mb-1">Recommended Action</p>
                    <p className="text-sm text-text-primary">{aiQuery.data.recommendedAction}</p>
                  </div>
                )}

                {/* Reasoning */}
                {aiQuery.data.reasoning && (
                  <div>
                    <p className="text-xs text-text-dim uppercase tracking-wider mb-1">Reasoning</p>
                    <p className="text-sm text-text-muted">{aiQuery.data.reasoning}</p>
                  </div>
                )}

                {/* Suggested Follow-Up */}
                {aiQuery.data.suggestedFollowUpDays != null && (
                  <div>
                    <p className="text-xs text-text-dim uppercase tracking-wider mb-1">Suggested Follow-Up</p>
                    <p className="text-sm text-blue-400">In {aiQuery.data.suggestedFollowUpDays} days</p>
                  </div>
                )}

                {/* Draft Note */}
                {aiQuery.data.draftNote && (
                  <div>
                    <p className="text-xs text-text-dim uppercase tracking-wider mb-1">Draft Note</p>
                    <div className="bg-bg border border-border rounded-lg p-3 text-sm text-text-muted">
                      {aiQuery.data.draftNote}
                    </div>
                    <button
                      onClick={() => {
                        setNoteContent(aiQuery.data.draftNote);
                        setAiOpen(false);
                        toast.success("Draft note copied to form");
                      }}
                      className="mt-2 text-xs text-accent hover:text-accent-light"
                    >
                      Use as note &rarr;
                    </button>
                  </div>
                )}
              </div>
            )}

            {!aiQuery.isLoading && !aiQuery.isError && !aiQuery.data && (
              <Button size="sm" onClick={() => aiQuery.refetch()}>
                <Sparkles className="w-3.5 h-3.5" /> Get AI Recommendation
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
