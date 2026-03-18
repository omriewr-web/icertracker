"use client";

import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import EmptyState from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

interface ImportLogEntry {
  id: string;
  importType: string;
  fileName: string | null;
  parserUsed: string | null;
  totalRows: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsSkipped: number;
  rowsFailed: number;
  status: string;
  startedAt: string;
}

const STATUS_STYLES: Record<string, { icon: typeof CheckCircle; color: string; bg: string }> = {
  COMPLETE: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
  RUNNING: { icon: Clock, color: "text-blue-400", bg: "bg-blue-500/10" },
  FAILED: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
  DRY_RUN: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10" },
};

export default function ImportHistory() {
  const { data: logs, isLoading } = useQuery<ImportLogEntry[]>({
    queryKey: ["import-logs"],
    queryFn: async () => {
      const res = await fetch("/api/import/logs");
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="bg-atlas-navy-3 border border-border rounded-xl p-6 animate-pulse">
        <div className="h-4 w-32 bg-card-hover rounded mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 w-full bg-card-hover rounded" />)}
        </div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <EmptyState
        icon={FileSpreadsheet}
        title="No imports yet"
        description="Upload a file using any of the import cards above to get started."
      />
    );
  }

  return (
    <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-x-auto">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">Recent Imports</h3>
      </div>
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left text-xs font-medium text-text-dim uppercase">File</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-text-dim uppercase">Type</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-text-dim uppercase">Status</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-text-dim uppercase">Rows</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-text-dim uppercase">Created</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-text-dim uppercase">Updated</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-text-dim uppercase">Skipped</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-text-dim uppercase">Date</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const st = STATUS_STYLES[log.status] || STATUS_STYLES.COMPLETE;
            const StIcon = st.icon;
            return (
              <tr key={log.id} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                <td className="px-4 py-2 text-text-primary text-xs font-mono truncate max-w-[200px]">{log.fileName || "—"}</td>
                <td className="px-4 py-2 text-text-muted text-xs">{log.importType.replace(/_/g, " ")}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${st.bg} ${st.color}`}>
                    <StIcon className="w-3 h-3" />
                    {log.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-text-muted text-xs tabular-nums">{log.totalRows}</td>
                <td className="px-4 py-2 text-right text-green-400 text-xs tabular-nums">{log.rowsInserted}</td>
                <td className="px-4 py-2 text-right text-blue-400 text-xs tabular-nums">{log.rowsUpdated}</td>
                <td className="px-4 py-2 text-right text-text-dim text-xs tabular-nums">{log.rowsSkipped + log.rowsFailed}</td>
                <td className="px-4 py-2 text-text-dim text-xs">{formatDate(log.startedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
