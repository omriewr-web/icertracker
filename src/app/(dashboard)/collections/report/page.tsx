"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  BarChart3,
  Users,
  Clock,
  TrendingUp,
} from "lucide-react";
import Button from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useBuildings } from "@/hooks/use-buildings";
import { fmt$, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ARReportData } from "@/lib/collections/types";

// ── Helpers ──

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── Export utilities ──

async function exportPdf(data: ARReportData, buildingLabel: string) {
  const { default: jsPDF } = await import("jspdf");
  await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });

  const title = `AR Report — ${monthLabel(`${data.period.year}-${data.period.month}`)} — ${buildingLabel}`;
  doc.setFontSize(14);
  doc.text(title, 14, 18);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date(data.generatedAt).toLocaleString()}`, 14, 25);

  // Summary
  doc.setFontSize(10);
  doc.text(`Total AR: ${fmt$(data.summary.totalBalance)}  |  Tenants: ${data.summary.tenantCount}  |  Avg Days: ${data.summary.avgDaysOutstanding}  |  Largest: ${fmt$(data.summary.largestBalance)}`, 14, 33);

  // Aging by building table
  (doc as any).autoTable({
    startY: 38,
    head: [["Building", "Current", "30+", "60+", "90+", "120+", "Total", "% of AR"]],
    body: data.agingByBuilding.map((b) => [
      b.buildingAddress,
      fmt$(b.current),
      fmt$(b.days30),
      fmt$(b.days60),
      fmt$(b.days90),
      fmt$(b.days120),
      fmt$(b.total),
      `${b.pctOfAR.toFixed(1)}%`,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [10, 22, 40] },
  });

  // Tenant detail table
  const tenantY = (doc as any).lastAutoTable?.finalY + 8 || 100;
  (doc as any).autoTable({
    startY: tenantY,
    head: [["Tenant", "Building", "Unit", "Balance", "Current", "30+", "60+", "90+", "120+", "Status", "Days Since Note"]],
    body: data.tenants.slice(0, 100).map((t) => [
      t.tenantName,
      t.buildingAddress,
      t.unit,
      fmt$(t.balance),
      fmt$(t.current),
      fmt$(t.days30),
      fmt$(t.days60),
      fmt$(t.days90),
      fmt$(t.days120),
      t.status.replace(/_/g, " "),
      t.daysSinceNote != null ? String(t.daysSinceNote) : "—",
    ]),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [10, 22, 40] },
  });

  const filename = `AR-Report-${data.period.year}-${data.period.month}-${buildingLabel.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(filename);
}

async function exportExcel(data: ARReportData, buildingLabel: string) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // Sheet 1: Aging Summary
  const agingRows = data.agingByBuilding.map((b) => ({
    Building: b.buildingAddress,
    Current: b.current,
    "30+": b.days30,
    "60+": b.days60,
    "90+": b.days90,
    "120+": b.days120,
    Total: b.total,
    "% of AR": b.pctOfAR,
  }));
  const ws1 = XLSX.utils.json_to_sheet(agingRows);
  XLSX.utils.book_append_sheet(wb, ws1, "Aging Summary");

  // Sheet 2: Tenant Detail
  const tenantRows = data.tenants.map((t) => ({
    Tenant: t.tenantName,
    Building: t.buildingAddress,
    Unit: t.unit,
    Balance: t.balance,
    Current: t.current,
    "30+": t.days30,
    "60+": t.days60,
    "90+": t.days90,
    "120+": t.days120,
    Status: t.status,
    "Days Since Note": t.daysSinceNote ?? "",
    "Last Note": t.lastNote ?? "",
  }));
  const ws2 = XLSX.utils.json_to_sheet(tenantRows);
  XLSX.utils.book_append_sheet(wb, ws2, "Tenant Detail");

  const filename = `AR-Report-${data.period.year}-${data.period.month}-${buildingLabel.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ── Page ──

export default function ARReportPage() {
  const router = useRouter();
  const { data: buildings } = useBuildings();

  const [month, setMonth] = useState(currentYearMonth);
  const [buildingId, setBuildingId] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const [sortField, setSortField] = useState<"balance" | "daysSinceNote">("balance");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: report, isLoading, refetch } = useQuery<ARReportData>({
    queryKey: ["collections", "full-report", buildingId, month],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (buildingId !== "all") params.set("buildingId", buildingId);
      params.set("month", month);
      const res = await fetch(`/api/collections/report?${params}`);
      if (!res.ok) throw new Error("Failed to fetch AR report");
      return res.json();
    },
  });

  const buildingLabel = buildingId === "all"
    ? "All Buildings"
    : buildings?.find((b: any) => b.id === buildingId)?.address ?? "Building";

  // Sort and paginate tenants
  const sortedTenants = useMemo(() => {
    if (!report?.tenants) return [];
    return [...report.tenants].sort((a, b) => {
      if (sortField === "balance") return sortDir === "desc" ? b.balance - a.balance : a.balance - b.balance;
      const aDays = a.daysSinceNote ?? 9999;
      const bDays = b.daysSinceNote ?? 9999;
      return sortDir === "desc" ? bDays - aDays : aDays - bDays;
    });
  }, [report?.tenants, sortField, sortDir]);

  const paginatedTenants = sortedTenants.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(sortedTenants.length / PAGE_SIZE);

  function toggleSort(field: "balance" | "daysSinceNote") {
    if (sortField === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortField(field); setSortDir("desc"); }
  }

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <button
        onClick={() => router.push("/collections")}
        className="flex items-center gap-1 text-sm text-text-dim hover:text-text-muted transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Collections
      </button>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">AR Report</h1>
          <p className="text-sm text-text-muted mt-1">Accounts Receivable Aging Summary</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-text-dim uppercase tracking-wider">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => { setMonth(e.target.value); setPage(1); }}
              className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-text-dim uppercase tracking-wider">Building</label>
            <select
              value={buildingId}
              onChange={(e) => { setBuildingId(e.target.value); setPage(1); }}
              className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="all">All Buildings</option>
              {(buildings ?? []).map((b: any) => (
                <option key={b.id} value={b.id}>{b.address}</option>
              ))}
            </select>
          </div>
          <Button size="sm" onClick={() => refetch()}>
            <BarChart3 className="w-3.5 h-3.5" /> Run Report
          </Button>
          {report && (
            <>
              <Button size="sm" variant="outline" onClick={() => exportPdf(report, buildingLabel)}>
                <Download className="w-3.5 h-3.5" /> PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportExcel(report, buildingLabel)}>
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </Button>
            </>
          )}
        </div>
      </div>

      {!report ? (
        <p className="text-sm text-text-dim text-center py-12">Select a month and click Run Report.</p>
      ) : (
        <>
          {/* ── SECTION 1: Summary Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total AR Balance", value: fmt$(report.summary.totalBalance), icon: TrendingUp, color: "text-red-400" },
              { label: "Tenants w/ Balance", value: String(report.summary.tenantCount), icon: Users, color: "text-amber-400" },
              { label: "Avg Days Outstanding", value: String(report.summary.avgDaysOutstanding), icon: Clock, color: "text-orange-400" },
              { label: "Largest Balance", value: fmt$(report.summary.largestBalance), icon: BarChart3, color: "text-red-400" },
            ].map((card) => (
              <div key={card.label} className="bg-atlas-navy-3 border border-border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-text-dim uppercase tracking-wider">{card.label}</p>
                  <card.icon className={cn("w-4 h-4", card.color)} />
                </div>
                <p className={cn("text-2xl font-bold font-mono mt-2", card.color)}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* ── SECTION 2: Aging by Building ── */}
          <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h2 className="text-sm font-medium text-text-muted">Aging by Building</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[10px] text-text-dim uppercase tracking-wider">
                    <th className="text-left px-4 py-2">Building</th>
                    <th className="text-right px-3 py-2">Current</th>
                    <th className="text-right px-3 py-2">30+</th>
                    <th className="text-right px-3 py-2">60+</th>
                    <th className="text-right px-3 py-2">90+</th>
                    <th className="text-right px-3 py-2">120+</th>
                    <th className="text-right px-3 py-2">Total</th>
                    <th className="text-right px-4 py-2">% of AR</th>
                  </tr>
                </thead>
                <tbody>
                  {report.agingByBuilding.map((b, i) => (
                    <tr key={b.buildingId} className={cn("border-b border-border/50", i % 2 === 1 && "bg-white/[0.02]")}>
                      <td className="px-4 py-2 text-text-primary">{b.buildingAddress}</td>
                      <td className="text-right px-3 py-2 font-mono text-green-400">{fmt$(b.current)}</td>
                      <td className="text-right px-3 py-2 font-mono text-yellow-400">{fmt$(b.days30)}</td>
                      <td className="text-right px-3 py-2 font-mono text-orange-400">{fmt$(b.days60)}</td>
                      <td className={cn("text-right px-3 py-2 font-mono", b.days90 > 0 ? "text-red-400" : "text-text-dim")}>{fmt$(b.days90)}</td>
                      <td className={cn("text-right px-3 py-2 font-mono", b.days120 > 0 ? "text-red-400" : "text-text-dim")}>{fmt$(b.days120)}</td>
                      <td className="text-right px-3 py-2 font-mono font-bold text-text-primary">{fmt$(b.total)}</td>
                      <td className="text-right px-4 py-2 font-mono text-text-muted">{b.pctOfAR.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  {report.agingByBuilding.length > 1 && (
                    <tr className="border-t border-border bg-white/[0.03] font-bold">
                      <td className="px-4 py-2 text-text-primary">Total</td>
                      <td className="text-right px-3 py-2 font-mono text-green-400">{fmt$(report.agingByBuilding.reduce((s, b) => s + b.current, 0))}</td>
                      <td className="text-right px-3 py-2 font-mono text-yellow-400">{fmt$(report.agingByBuilding.reduce((s, b) => s + b.days30, 0))}</td>
                      <td className="text-right px-3 py-2 font-mono text-orange-400">{fmt$(report.agingByBuilding.reduce((s, b) => s + b.days60, 0))}</td>
                      <td className="text-right px-3 py-2 font-mono text-red-400">{fmt$(report.agingByBuilding.reduce((s, b) => s + b.days90, 0))}</td>
                      <td className="text-right px-3 py-2 font-mono text-red-400">{fmt$(report.agingByBuilding.reduce((s, b) => s + b.days120, 0))}</td>
                      <td className="text-right px-3 py-2 font-mono text-text-primary">{fmt$(report.summary.totalBalance)}</td>
                      <td className="text-right px-4 py-2 font-mono text-text-muted">100.0%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── SECTION 3: Tenant Detail ── */}
          <div className="bg-atlas-navy-3 border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-medium text-text-muted">
                Tenant Detail ({sortedTenants.length} tenants)
              </h2>
              <p className="text-[10px] text-text-dim">
                Page {page} of {Math.max(totalPages, 1)}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[10px] text-text-dim uppercase tracking-wider">
                    <th className="text-left px-4 py-2">Tenant</th>
                    <th className="text-left px-3 py-2">Building</th>
                    <th className="text-left px-3 py-2">Unit</th>
                    <th className="text-right px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort("balance")}>
                      Balance {sortField === "balance" ? (sortDir === "desc" ? "▼" : "▲") : ""}
                    </th>
                    <th className="text-right px-3 py-2">Current</th>
                    <th className="text-right px-3 py-2">30+</th>
                    <th className="text-right px-3 py-2">60+</th>
                    <th className="text-right px-3 py-2">90+</th>
                    <th className="text-right px-3 py-2">120+</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-right px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort("daysSinceNote")}>
                      Days Since Note {sortField === "daysSinceNote" ? (sortDir === "desc" ? "▼" : "▲") : ""}
                    </th>
                    <th className="text-left px-4 py-2">Last Note</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTenants.map((t, i) => (
                    <tr
                      key={t.tenantId}
                      className={cn(
                        "border-b border-border/50 cursor-pointer hover:bg-white/[0.03] transition-colors",
                        i % 2 === 1 && "bg-white/[0.02]"
                      )}
                      onClick={() => router.push(`/collections/${t.tenantId}`)}
                    >
                      <td className="px-4 py-2 text-text-primary font-medium">{t.tenantName}</td>
                      <td className="px-3 py-2 text-text-muted">{t.buildingAddress}</td>
                      <td className="px-3 py-2 text-text-muted">{t.unit}</td>
                      <td className="text-right px-3 py-2 font-mono font-bold text-red-400">{fmt$(t.balance)}</td>
                      <td className="text-right px-3 py-2 font-mono text-green-400">{fmt$(t.current)}</td>
                      <td className="text-right px-3 py-2 font-mono text-yellow-400">{fmt$(t.days30)}</td>
                      <td className="text-right px-3 py-2 font-mono text-orange-400">{fmt$(t.days60)}</td>
                      <td className={cn("text-right px-3 py-2 font-mono", t.days90 > 0 ? "text-red-400" : "text-text-dim")}>{fmt$(t.days90)}</td>
                      <td className={cn("text-right px-3 py-2 font-mono", t.days120 > 0 ? "text-red-400" : "text-text-dim")}>{fmt$(t.days120)}</td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-text-dim font-medium uppercase">
                          {t.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className={cn("text-right px-3 py-2 font-mono", t.daysSinceNote != null && t.daysSinceNote > 30 ? "text-red-400" : "text-text-muted")}>
                        {t.daysSinceNote != null ? t.daysSinceNote : "—"}
                      </td>
                      <td className="px-4 py-2 text-text-dim text-xs max-w-[200px] truncate">{t.lastNote ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-3 border-t border-border">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="text-xs px-3 py-1 rounded border border-border text-text-muted disabled:opacity-30 hover:bg-white/5"
                >
                  Prev
                </button>
                <span className="text-xs text-text-dim">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="text-xs px-3 py-1 rounded border border-border text-text-muted disabled:opacity-30 hover:bg-white/5"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* ── SECTION 4: Collection Activity Summary ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
              <h2 className="text-sm font-medium text-text-muted mb-3">
                Collection Activity — {monthLabel(month)}
              </h2>
              {Object.keys(report.activity.notesByType).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(report.activity.notesByType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-xs text-text-muted">{type.replace(/_/g, " ")}</span>
                        <span className="text-sm font-mono font-bold text-text-primary">{count}</span>
                      </div>
                    ))}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-xs text-text-muted">Status Changes</span>
                    <span className="text-sm font-mono font-bold text-text-primary">{report.activity.statusChanges}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-dim">No collection activity this month.</p>
              )}
            </div>

            <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
              <h2 className="text-sm font-medium text-text-muted mb-3">Top 5 Balances</h2>
              {report.activity.top5ByBalance.length > 0 ? (
                <div className="space-y-2">
                  {report.activity.top5ByBalance.map((t, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-text-muted truncate max-w-[60%]">{t.tenantName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-text-dim">
                          {t.lastNoteDate ? formatDate(t.lastNoteDate) : "No notes"}
                        </span>
                        <span className="text-sm font-mono font-bold text-red-400">{fmt$(t.balance)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-dim">No tenants with balance.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
