"use client";

import { Calendar } from "lucide-react";
import { useViolations } from "@/hooks/use-violations";
import { TableTabSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import { fmt$, formatDate } from "@/lib/utils";

export default function HearingsTab() {
  const { data: violations, isLoading } = useViolations({});

  if (isLoading) return <TableTabSkeleton rows={6} />;

  const withHearings = violations?.filter((v) => v.hearingDate) || [];
  const now = new Date();
  const upcoming = withHearings
    .filter((v) => new Date(v.hearingDate!) >= now)
    .sort((a, b) => new Date(a.hearingDate!).getTime() - new Date(b.hearingDate!).getTime());
  const past = withHearings
    .filter((v) => new Date(v.hearingDate!) < now)
    .sort((a, b) => new Date(b.hearingDate!).getTime() - new Date(a.hearingDate!).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Upcoming Hearings ({upcoming.length})</h3>
        <HearingsTable rows={upcoming} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Past Hearings ({past.length})</h3>
        <HearingsTable rows={past} />
      </div>
    </div>
  );
}

function HearingsTable({ rows }: { rows: any[] }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Date</th>
            <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Building</th>
            <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Source</th>
            <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Violation ID</th>
            <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Status</th>
            <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Penalty</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} className="border-b border-border/50 hover:bg-card-hover transition-colors">
              <td className="px-4 py-3 text-text-primary font-medium">{formatDate(v.hearingDate)}</td>
              <td className="px-4 py-3 text-text-muted truncate max-w-[200px]">{v.buildingAddress}</td>
              <td className="px-4 py-3 text-text-muted">{v.source}</td>
              <td className="px-4 py-3 text-text-primary font-mono text-xs">{v.externalId}</td>
              <td className="px-4 py-3 text-text-muted text-xs">{v.hearingStatus || v.currentStatus || "—"}</td>
              <td className="px-4 py-3 text-text-muted font-mono">{Number(v.penaltyAmount) > 0 ? fmt$(v.penaltyAmount) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <EmptyState icon={Calendar} title="No hearings found" description="Upcoming ECB and DOB hearings will appear here." />
      )}
    </div>
  );
}
