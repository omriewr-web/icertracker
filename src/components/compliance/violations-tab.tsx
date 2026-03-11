"use client";

import { useState } from "react";
import { RefreshCw, AlertTriangle, DollarSign, Calendar, Bug } from "lucide-react";
import { useViolations, useViolationStats, useSyncViolationsStream } from "@/hooks/use-violations";
import { useAppStore } from "@/stores/app-store";
import { useBuildings } from "@/hooks/use-buildings";
import Button from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { fmt$, formatDate } from "@/lib/utils";
import type { ViolationView } from "@/types";
import ExportButton from "@/components/ui/export-button";

const SOURCE_OPTIONS = ["", "HPD", "DOB", "ECB"];
const CLASS_OPTIONS = ["", "A", "B", "C"];

function CureBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-text-dim">—</span>;
  let color = "text-green-400";
  if (days < 7) color = "text-red-400";
  else if (days < 14) color = "text-orange-400";
  else if (days < 30) color = "text-yellow-400";
  return <span className={`text-xs font-medium ${color}`}>{days}d</span>;
}

function ClassBadge({ cls }: { cls: string | null }) {
  if (!cls) return <span className="text-text-dim">—</span>;
  const colors: Record<string, string> = {
    C: "bg-red-500/10 text-red-400",
    B: "bg-orange-500/10 text-orange-400",
    A: "bg-yellow-500/10 text-yellow-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[cls] || "bg-card-hover text-text-muted"}`}>
      Class {cls}
    </span>
  );
}

export default function ViolationsTab() {
  const { selectedBuildingId } = useAppStore();
  const { data: buildings } = useBuildings();
  const [filterSource, setFilterSource] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedViolation, setSelectedViolation] = useState<ViolationView | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testBuildingId, setTestBuildingId] = useState("");

  const { data: violations, isLoading } = useViolations({
    source: filterSource || undefined,
    class: filterClass || undefined,
    status: filterStatus || undefined,
    isComplaint: "false",
  });
  const { data: stats } = useViolationStats();
  const { mutate: syncMutate, isPending: syncPending, progress: syncProgress } = useSyncViolationsStream();

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatMini icon={AlertTriangle} label="Total Open" value={stats.totalOpen} />
          <StatMini icon={AlertTriangle} label="Class C (Critical)" value={stats.classCCount} color="text-red-400" />
          <StatMini icon={AlertTriangle} label="Class B (Hazardous)" value={stats.classBCount} color="text-orange-400" />
          <StatMini icon={DollarSign} label="Pending Fines" value={fmt$(stats.totalPenalties)} color="text-yellow-400" />
          <StatMini icon={Calendar} label="Upcoming Hearings" value={stats.upcomingHearings} color="text-blue-400" />
        </div>
      )}

      {/* Filters + Sync */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="">All Sources</option>
          {SOURCE_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
          <option value="">All Classes</option>
          {CLASS_OPTIONS.filter(Boolean).map((c) => <option key={c} value={c}>Class {c}</option>)}
        </select>
        <input
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          placeholder="Filter status..."
          className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-dim w-40 focus:outline-none focus:border-accent"
        />
        <div className="flex-1" />
        <ExportButton
          data={(violations || []).map((v) => ({
            source: v.source,
            externalId: v.externalId,
            buildingAddress: v.buildingAddress,
            class: v.class || "",
            description: v.description,
            currentStatus: v.currentStatus || "",
            penaltyAmount: Number(v.penaltyAmount) > 0 ? v.penaltyAmount : "",
            daysUntilCure: v.daysUntilCure ?? "",
          }))}
          filename="violations"
          columns={[
            { key: "source", label: "Source" },
            { key: "externalId", label: "ID" },
            { key: "buildingAddress", label: "Building" },
            { key: "class", label: "Class" },
            { key: "description", label: "Description" },
            { key: "currentStatus", label: "Status" },
            { key: "penaltyAmount", label: "Penalty" },
            { key: "daysUntilCure", label: "Cure Days" },
          ]}
          pdfConfig={{
            title: "Violations Report",
            stats: stats ? [
              { label: "Total Open", value: String(stats.totalOpen) },
              { label: "Class C", value: String(stats.classCCount) },
              { label: "Class B", value: String(stats.classBCount) },
              { label: "Pending Fines", value: fmt$(stats.totalPenalties) },
            ] : undefined,
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowTestPanel(!showTestPanel)}
        >
          <Bug className="w-3.5 h-3.5" />
          Test Sync
        </Button>
        <Button
          size="sm"
          onClick={() => syncMutate(selectedBuildingId ? { buildingId: selectedBuildingId } : {})}
          disabled={syncPending}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncPending ? "animate-spin" : ""}`} />
          {syncPending && syncProgress && syncProgress.total > 0
            ? `Syncing ${syncProgress.synced}/${syncProgress.total}...`
            : syncPending
              ? "Syncing..."
              : "Sync Now"}
        </Button>
      </div>

      {/* Test Sync Debug Panel */}
      {showTestPanel && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Debug: Test NYC Open Data Fetch</h3>
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs text-text-dim mb-1">Building</label>
              <select
                value={testBuildingId}
                onChange={(e) => setTestBuildingId(e.target.value)}
                className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">Select a building...</option>
                {buildings?.map((b) => (
                  <option key={b.id} value={b.id}>{b.address}</option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              disabled={!testBuildingId || testLoading}
              onClick={async () => {
                setTestLoading(true);
                setTestResult(null);
                try {
                  const sources = ["HPD", "DOB", "ECB", "HPD_COMPLAINTS"];
                  const results: any[] = [];
                  for (const source of sources) {
                    const res = await fetch(`/api/violations/test?buildingId=${testBuildingId}&source=${source}`);
                    results.push(await res.json());
                  }
                  setTestResult(results);
                } catch (err: any) {
                  setTestResult({ error: err.message });
                } finally {
                  setTestLoading(false);
                }
              }}
            >
              {testLoading ? "Testing..." : "Run Test"}
            </Button>
          </div>
          {testResult && (
            <div className="bg-bg border border-border rounded-lg p-3 overflow-auto max-h-96">
              <pre className="text-xs text-text-muted whitespace-pre-wrap font-mono">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Violations table */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Source</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">ID</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Building</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Class</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Description</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Penalty</th>
              <th className="px-4 py-3 text-xs font-medium text-text-dim uppercase">Cure</th>
            </tr>
          </thead>
          <tbody>
            {violations?.map((v) => (
              <tr
                key={v.id}
                className="border-b border-border/50 hover:bg-card-hover cursor-pointer transition-colors"
                onClick={() => setSelectedViolation(v)}
              >
                <td className="px-4 py-3 text-text-muted">{v.source}</td>
                <td className="px-4 py-3 text-text-primary font-mono text-xs">{v.externalId}</td>
                <td className="px-4 py-3 text-text-muted truncate max-w-[200px]">{v.buildingAddress}</td>
                <td className="px-4 py-3"><ClassBadge cls={v.class} /></td>
                <td className="px-4 py-3 text-text-muted truncate max-w-[250px]">{v.description}</td>
                <td className="px-4 py-3 text-text-muted text-xs">{v.currentStatus || "—"}</td>
                <td className="px-4 py-3 text-text-muted font-mono">{Number(v.penaltyAmount) > 0 ? fmt$(v.penaltyAmount) : "—"}</td>
                <td className="px-4 py-3"><CureBadge days={v.daysUntilCure} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!violations || violations.length === 0) && (
          <div className="text-center py-12 text-text-dim text-sm">No violations found</div>
        )}
      </div>

      {/* Detail panel */}
      {selectedViolation && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-text-primary">
              {selectedViolation.source} — {selectedViolation.externalId}
            </h3>
            <button onClick={() => setSelectedViolation(null)} className="text-text-dim hover:text-text-muted text-sm">Close</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div><span className="text-text-dim">Building:</span> <span className="text-text-primary">{selectedViolation.buildingAddress}</span></div>
            <div><span className="text-text-dim">Class:</span> <span className="text-text-primary">{selectedViolation.class || "—"}</span></div>
            <div><span className="text-text-dim">Severity:</span> <span className="text-text-primary">{selectedViolation.severity || "—"}</span></div>
            <div><span className="text-text-dim">Status:</span> <span className="text-text-primary">{selectedViolation.currentStatus || "—"}</span></div>
            <div><span className="text-text-dim">Penalty:</span> <span className="text-text-primary">{fmt$(selectedViolation.penaltyAmount)}</span></div>
            <div><span className="text-text-dim">Issued:</span> <span className="text-text-primary">{formatDate(selectedViolation.issuedDate)}</span></div>
            <div><span className="text-text-dim">Respond By:</span> <span className="text-text-primary">{formatDate(selectedViolation.respondByDate)}</span></div>
            <div><span className="text-text-dim">Unit:</span> <span className="text-text-primary">{selectedViolation.unitNumber || "—"}</span></div>
            <div><span className="text-text-dim">Hearing:</span> <span className="text-text-primary">{formatDate(selectedViolation.hearingDate)}</span></div>
          </div>
          {selectedViolation.novDescription && (
            <div className="text-sm">
              <span className="text-text-dim">NOV Description:</span>
              <p className="text-text-muted mt-1">{selectedViolation.novDescription}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatMini({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color || "text-text-dim"}`} />
        <span className="text-xs text-text-dim">{label}</span>
      </div>
      <p className={`text-lg font-semibold ${color || "text-text-primary"}`}>{value}</p>
    </div>
  );
}
