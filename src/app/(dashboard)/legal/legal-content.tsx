"use client";

import { useMemo, useState } from "react";
import { Scale, Upload, ClipboardList, Sparkles, Calendar, Search, X } from "lucide-react";
import { useTenants } from "@/hooks/use-tenants";
import { useReviewQueue } from "@/hooks/use-legal-import";
import { useCourtDates, useLegalStats, type CourtDateItem } from "@/hooks/use-legal";
import { Gavel, CalendarClock, UserX as UserXIcon, UserMinus, ClipboardCheck } from "lucide-react";
import Button from "@/components/ui/button";
import KpiCard from "@/components/ui/kpi-card";
import { TablePageSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import StageBadge from "@/components/legal/stage-badge";
import LegalModal from "@/components/legal/legal-modal";
import LegalImportWizard from "@/components/legal/legal-import-wizard";
import LegalReviewQueue from "@/components/legal/legal-review-queue";
import LegalCandidates from "@/components/legal/legal-candidates";
import ExportButton from "@/components/ui/export-button";
import { fmt$, formatDate } from "@/lib/utils";
import { TenantView } from "@/types";
import { cn } from "@/lib/utils";

const STAGES = [
  "NOTICE_SENT", "HOLDOVER", "NONPAYMENT", "COURT_DATE",
  "STIPULATION", "JUDGMENT", "WARRANT", "EVICTION", "SETTLED",
];

const STATUS_OPTIONS = ["active", "settled", "dismissed", "withdrawn"] as const;

type Tab = "cases" | "import" | "review" | "candidates" | "court-dates";

export default function LegalContent() {
  const { data: tenants, isLoading } = useTenants();
  const { data: reviewData } = useReviewQueue();
  const { data: courtData } = useCourtDates();
  const { data: legalStats } = useLegalStats();
  const [selectedTenant, setSelectedTenant] = useState<TenantView | null>(null);
  const [tab, setTab] = useState<Tab>("cases");

  // Filters
  const [searchText, setSearchText] = useState("");
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [courtQuickFilter, setCourtQuickFilter] = useState<"" | "today" | "week">("");

  const reviewCount = reviewData?.items?.length ?? 0;

  const legalTenants = useMemo(
    () => (tenants || []).filter((t) => t.legalFlag),
    [tenants]
  );

  const recommended = useMemo(
    () => (tenants || []).filter((t) => t.legalRecommended && !t.legalFlag),
    [tenants]
  );

  const buildings = useMemo(() => {
    const set = new Set<string>();
    legalTenants.forEach((t) => { if (t.buildingAddress) set.add(t.buildingAddress); });
    return Array.from(set).sort();
  }, [legalTenants]);

  const filteredLegalTenants = useMemo(() => {
    let result = legalTenants;
    if (searchText) {
      const q = searchText.toLowerCase();
      result = result.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        (t.legalStage && t.legalStage.toLowerCase().includes(q))
      );
    }
    if (stageFilter.length > 0) {
      result = result.filter((t) => {
        const s = t.legalStage?.toUpperCase().replace(/-/g, "_") || "NOTICE_SENT";
        return stageFilter.includes(s);
      });
    }
    if (buildingFilter) {
      result = result.filter((t) => t.buildingAddress === buildingFilter);
    }
    return result;
  }, [legalTenants, searchText, stageFilter, buildingFilter]);

  const hasFilters = searchText || stageFilter.length > 0 || statusFilter || buildingFilter;

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STAGES.forEach((s) => (counts[s] = 0));
    legalTenants.forEach((t) => {
      const stage = t.legalStage?.toUpperCase().replace(/-/g, "_") || "NOTICE_SENT";
      counts[stage] = (counts[stage] || 0) + 1;
    });
    return counts;
  }, [legalTenants]);

  // Court dates
  const courtCases = useMemo(() => {
    const cases = courtData?.cases ?? [];
    if (!courtQuickFilter) return cases;
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    if (courtQuickFilter === "today") {
      return cases.filter((c) => c.courtDate && new Date(c.courtDate).toISOString().split("T")[0] === todayStr);
    }
    // "week"
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    return cases.filter((c) => {
      const d = new Date(c.courtDate);
      return d >= now && d <= weekEnd;
    });
  }, [courtData, courtQuickFilter]);

  const courtDateCount = courtData?.cases?.length ?? 0;

  if (isLoading) return <TablePageSkeleton />;

  const tabs = [
    { key: "cases" as const, label: "Active Cases", icon: Scale, badge: legalTenants.length },
    { key: "court-dates" as const, label: "Court Dates", icon: Calendar, badge: courtDateCount > 0 ? courtDateCount : undefined },
    { key: "import" as const, label: "Import Cases", icon: Upload },
    { key: "review" as const, label: "Review Queue", icon: ClipboardList, badge: reviewCount > 0 ? reviewCount : undefined },
    { key: "candidates" as const, label: "Suggested Referrals", icon: Sparkles, badge: recommended.length > 0 ? recommended.length : undefined },
  ];

  function toggleStageFilter(stage: string) {
    setStageFilter((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
    );
  }

  function clearFilters() {
    setSearchText("");
    setStageFilter([]);
    setStatusFilter("");
    setBuildingFilter("");
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Legal Cases</h1>
        {tab === "cases" && (
          <ExportButton
            data={filteredLegalTenants.map((t) => ({
              name: t.name,
              unitNumber: t.unitNumber,
              buildingAddress: t.buildingAddress,
              balance: t.balance,
              legalStage: t.legalStage?.toUpperCase().replace(/-/g, "_") || "NOTICE_SENT",
            }))}
            filename="legal-cases"
            columns={[
              { key: "name", label: "Tenant" },
              { key: "unitNumber", label: "Unit" },
              { key: "buildingAddress", label: "Building" },
              { key: "balance", label: "Balance" },
              { key: "legalStage", label: "Stage" },
            ]}
            pdfConfig={{
              title: "Legal Pipeline Report",
              stats: [
                { label: "Active Cases", value: String(legalTenants.length) },
                { label: "Total Legal Balance", value: fmt$(legalTenants.reduce((s, t) => s + t.balance, 0)) },
                { label: "In Court+", value: String(stageCounts.COURT_DATE + stageCounts.STIPULATION + stageCounts.JUDGMENT + stageCounts.WARRANT + stageCounts.EVICTION) },
              ],
            }}
          />
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
              tab === t.key
                ? "text-accent border-b-2 border-accent"
                : "text-text-dim hover:text-text-muted",
            )}
          >
            <t.icon className="w-4 h-4 shrink-0" />
            {t.label}
            {t.badge !== undefined && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                t.key === "review" ? "bg-amber-500/20 text-amber-400" :
                t.key === "candidates" ? "bg-orange-500/20 text-orange-400" :
                t.key === "court-dates" ? "bg-blue-500/20 text-blue-400" :
                "bg-accent/20 text-accent",
              )}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Active Cases tab ── */}
      {tab === "cases" && (
        <div className="space-y-6">
          {/* Portfolio stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Active Cases" value={legalStats?.activeCases ?? legalTenants.length} icon={Gavel} color="#8B5CF6" />
            <KpiCard label="Court This Week" value={legalStats?.courtThisWeek ?? 0} icon={CalendarClock} color="#E09A3E" />
            <KpiCard label="No Attorney" value={legalStats?.noAttorney ?? 0} icon={UserXIcon} color="#E05C5C" />
            <KpiCard label="No Assignee" value={legalStats?.noAssignee ?? 0} icon={UserMinus} color="#E09A3E" />
            <KpiCard label="Pending Review" value={legalStats?.pendingReview ?? 0} icon={ClipboardCheck} color="#C9A84C" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Active Cases" value={legalTenants.length} icon={Scale} color="#8B5CF6" />
            <KpiCard label="Suggested Referrals" value={recommended.length} color="#F97316" />
            <KpiCard label="Total Balance (Legal)" value={fmt$(legalTenants.reduce((s, t) => s + t.balance, 0))} color="#EF4444" />
            <KpiCard label="In Court+" value={stageCounts.COURT_DATE + stageCounts.STIPULATION + stageCounts.JUDGMENT + stageCounts.WARRANT + stageCounts.EVICTION} color="#8B5CF6" />
          </div>

          <div className="flex gap-2 flex-wrap">
            {STAGES.map((s) => (
              <button
                key={s}
                onClick={() => toggleStageFilter(s)}
                className={cn(
                  "bg-card-gradient border rounded-lg px-3 py-2 text-center min-w-[80px] transition-colors",
                  stageFilter.includes(s) ? "border-accent" : "border-border",
                )}
              >
                <p className="text-lg font-bold text-text-primary">{stageCounts[s]}</p>
                <p className="text-[10px] text-text-dim uppercase">{s.replace(/_/g, " ")}</p>
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-text-dim" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search tenant name..."
                className="w-full bg-bg border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
            {buildings.length > 1 && (
              <select
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value)}
                className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">All Buildings</option>
                {buildings.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-text-dim hover:text-text-muted">
                <X className="w-3 h-3" /> Clear filters
              </button>
            )}
          </div>

          {filteredLegalTenants.length > 0 ? (
            <div className="bg-card-gradient border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Tenant</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Building</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Balance</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Stage</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLegalTenants.map((t) => (
                    <tr key={t.id} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                      <td className="px-3 py-2">
                        <span className="text-text-primary">{t.name}</span>
                        <span className="text-text-dim text-xs ml-1">#{t.unitNumber}</span>
                      </td>
                      <td className="px-3 py-2 text-text-muted text-xs">{t.buildingAddress}</td>
                      <td className="px-3 py-2 text-right text-red-400 font-mono">{fmt$(t.balance)}</td>
                      <td className="px-3 py-2">
                        <StageBadge stage={t.legalStage?.toUpperCase().replace(/-/g, "_") || "NOTICE_SENT"} />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setSelectedTenant(t)}
                          className="text-xs text-accent hover:text-accent-light"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={hasFilters ? "No cases match filters" : "No active legal cases"}
              icon={Scale}
            />
          )}
        </div>
      )}

      {/* ── Court Dates tab ── */}
      {tab === "court-dates" && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setCourtQuickFilter(courtQuickFilter === "today" ? "" : "today")}
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg border transition-colors",
                courtQuickFilter === "today" ? "bg-accent/20 text-accent border-accent" : "bg-bg border-border text-text-dim hover:text-text-muted",
              )}
            >
              Today
            </button>
            <button
              onClick={() => setCourtQuickFilter(courtQuickFilter === "week" ? "" : "week")}
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg border transition-colors",
                courtQuickFilter === "week" ? "bg-accent/20 text-accent border-accent" : "bg-bg border-border text-text-dim hover:text-text-muted",
              )}
            >
              This Week
            </button>
            {courtQuickFilter && (
              <button onClick={() => setCourtQuickFilter("")} className="text-xs text-text-dim hover:text-text-muted">
                Show All
              </button>
            )}
          </div>

          {courtCases.length > 0 ? (
            <div className="bg-card-gradient border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Court Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Tenant</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Building / Unit</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Stage</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Case #</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Attorney</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Assigned To</th>
                  </tr>
                </thead>
                <tbody>
                  {courtCases.map((c: CourtDateItem) => {
                    const courtDateObj = new Date(c.courtDate);
                    const now = new Date();
                    const diffDays = Math.ceil((courtDateObj.getTime() - now.getTime()) / 86400000);
                    const rowColor = diffDays < 0
                      ? "bg-red-500/5"
                      : diffDays <= 7
                        ? "bg-amber-500/5"
                        : "";

                    return (
                      <tr key={c.id} className={cn("border-b border-border/50 hover:bg-card-hover transition-colors", rowColor)}>
                        <td className="px-3 py-2">
                          <span className={cn(
                            "text-sm font-medium",
                            diffDays < 0 ? "text-red-400" : diffDays <= 7 ? "text-amber-400" : "text-text-primary",
                          )}>
                            {formatDate(c.courtDate)}
                          </span>
                          {diffDays < 0 && <span className="text-[10px] text-red-400 ml-1">PAST</span>}
                          {diffDays === 0 && <span className="text-[10px] text-amber-400 ml-1">TODAY</span>}
                        </td>
                        <td className="px-3 py-2 text-text-primary text-xs">{c.tenantName}</td>
                        <td className="px-3 py-2 text-text-dim text-xs">{c.buildingAddress} #{c.unitNumber}</td>
                        <td className="px-3 py-2"><StageBadge stage={c.stage} /></td>
                        <td className="px-3 py-2 text-text-dim text-xs">{c.caseNumber || "—"}</td>
                        <td className="px-3 py-2 text-text-dim text-xs">{c.attorneyName || "—"}</td>
                        <td className="px-3 py-2 text-text-dim text-xs">{c.assignedUserName || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No upcoming court dates" icon={Calendar} />
          )}
        </div>
      )}

      {/* ── Import tab ── */}
      {tab === "import" && (
        <LegalImportWizard onDone={() => setTab("cases")} />
      )}

      {/* ── Review Queue tab ── */}
      {tab === "review" && <LegalReviewQueue />}

      {/* ── Candidates tab ── */}
      {tab === "candidates" && <LegalCandidates />}

      <LegalModal
        tenantId={selectedTenant?.id || null}
        tenantName={selectedTenant?.name || ""}
        buildingId={selectedTenant?.buildingId || null}
        onClose={() => setSelectedTenant(null)}
      />
    </div>
  );
}
