"use client";

import { useState } from "react";
import { Clock, CheckCircle2, XCircle, Eye, FileSpreadsheet } from "lucide-react";
import {
  useStagingBatches,
  useStagingBatchDetail,
  useApproveStagingBatch,
  useRejectStagingBatch,
  type StagingBatch,
  type StagingSummary,
} from "@/hooks/use-import";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending_review: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    approved: "bg-green-500/10 text-green-400 border-green-500/30",
    rejected: "bg-red-500/10 text-red-400 border-red-500/30",
  };
  const labels: Record<string, string> = {
    pending_review: "Pending Review",
    approved: "Approved",
    rejected: "Rejected",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs border ${styles[status] ?? "bg-bg text-text-dim border-border"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function SummaryDisplay({ summary }: { summary: StagingSummary }) {
  return (
    <div className="flex gap-4 text-sm">
      <span className="text-text-muted">Total: <span className="text-text-primary font-medium">{summary.total}</span></span>
      <span className="text-green-400">New: {summary.newTenants}</span>
      <span className="text-blue-400">Updates: {summary.updates}</span>
      <span className="text-yellow-400">Vacancies: {summary.vacancies}</span>
      {summary.errors > 0 && <span className="text-red-400">Errors: {summary.errors}</span>}
    </div>
  );
}

function BatchDetail({ batch, onClose }: { batch: StagingBatch; onClose: () => void }) {
  const detail = useStagingBatchDetail(batch.id);
  const approve = useApproveStagingBatch();
  const reject = useRejectStagingBatch();
  const [notes, setNotes] = useState("");
  const isPending = batch.status === "pending_review";
  const summary = batch.summaryJson;

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-accent" />
          <h3 className="font-semibold text-text-primary">{batch.fileName}</h3>
          <StatusBadge status={batch.status} />
        </div>
        <button onClick={onClose} className="text-text-dim hover:text-text-muted text-sm">Close</button>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-text-dim">Type:</span>{" "}
          <span className="text-text-muted">{batch.importType}</span>
        </div>
        <div>
          <span className="text-text-dim">Uploaded:</span>{" "}
          <span className="text-text-muted">{new Date(batch.createdAt).toLocaleString()}</span>
        </div>
      </div>

      <SummaryDisplay summary={summary} />

      {summary.buildings.length > 0 && (
        <div className="text-sm">
          <span className="text-text-dim">Buildings:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {summary.buildings.slice(0, 10).map((b, i) => (
              <span key={i} className="bg-bg px-2 py-0.5 rounded text-xs text-text-muted border border-border">{b}</span>
            ))}
            {summary.buildings.length > 10 && (
              <span className="text-text-dim text-xs">+{summary.buildings.length - 10} more</span>
            )}
          </div>
        </div>
      )}

      {isPending && (
        <div className="space-y-3 pt-2 border-t border-border">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Review notes (optional)"
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={() => approve.mutate({ id: batch.id, notes: notes || undefined })}
              disabled={approve.isPending}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {approve.isPending ? "Approving..." : "Approve & Import"}
            </button>
            <button
              onClick={() => reject.mutate({ id: batch.id, notes: notes || undefined })}
              disabled={reject.isPending}
              className="flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              {reject.isPending ? "Rejecting..." : "Reject"}
            </button>
          </div>
        </div>
      )}

      {batch.reviewNotes && (
        <div className="text-sm bg-bg p-3 rounded-lg border border-border">
          <span className="text-text-dim">Review notes:</span>{" "}
          <span className="text-text-muted">{batch.reviewNotes}</span>
        </div>
      )}
    </div>
  );
}

export default function StagingTab() {
  const [filter, setFilter] = useState<string>("pending_review");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: batches, isLoading } = useStagingBatches(filter);

  const selectedBatch = batches?.find((b: StagingBatch) => b.id === selectedId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-text-primary">Import Review Queue</h2>
        <div className="flex gap-1">
          {[
            { key: "pending_review", label: "Pending" },
            { key: "approved", label: "Approved" },
            { key: "rejected", label: "Rejected" },
            { key: "all", label: "All" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setSelectedId(null); }}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filter === f.key
                  ? "bg-accent text-white"
                  : "bg-bg text-text-dim hover:text-text-muted border border-border"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {selectedBatch && (
        <BatchDetail batch={selectedBatch} onClose={() => setSelectedId(null)} />
      )}

      {isLoading ? (
        <div className="text-text-dim text-sm">Loading...</div>
      ) : !batches?.length ? (
        <div className="text-text-dim text-sm py-8 text-center">
          No {filter === "all" ? "" : filter.replace("_", " ")} staging batches found.
        </div>
      ) : (
        <div className="space-y-2">
          {batches.map((batch: StagingBatch) => {
            const summary = batch.summaryJson;
            return (
              <div
                key={batch.id}
                className={`bg-card border rounded-lg p-4 cursor-pointer transition-colors hover:border-accent/50 ${
                  selectedId === batch.id ? "border-accent" : "border-border"
                }`}
                onClick={() => setSelectedId(batch.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-4 h-4 text-text-dim" />
                    <span className="text-text-primary font-medium text-sm">{batch.fileName}</span>
                    <StatusBadge status={batch.status} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-dim">
                    <span>{summary.total} rows</span>
                    <span>{new Date(batch.createdAt).toLocaleDateString()}</span>
                    <Eye className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-2">
                  <SummaryDisplay summary={summary} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
