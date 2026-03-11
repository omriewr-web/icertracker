"use client";

import { useMemo, useState } from "react";
import { Scale, Upload, ClipboardList, AlertTriangle, Sparkles } from "lucide-react";
import { useTenants } from "@/hooks/use-tenants";
import { useReviewQueue } from "@/hooks/use-legal-import";
import Button from "@/components/ui/button";
import StatCard from "@/components/ui/stat-card";
import { PageSkeleton } from "@/components/ui/skeleton";
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

type Tab = "cases" | "import" | "review" | "candidates";

export default function LegalContent() {
  const { data: tenants, isLoading } = useTenants();
  const { data: reviewData } = useReviewQueue();
  const [selectedTenant, setSelectedTenant] = useState<TenantView | null>(null);
  const [tab, setTab] = useState<Tab>("cases");

  const reviewCount = reviewData?.items?.length ?? 0;

  const legalTenants = useMemo(
    () => (tenants || []).filter((t) => t.legalFlag),
    [tenants]
  );

  const recommended = useMemo(
    () => (tenants || []).filter((t) => t.legalRecommended && !t.legalFlag),
    [tenants]
  );

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STAGES.forEach((s) => (counts[s] = 0));
    legalTenants.forEach((t) => {
      const stage = t.legalStage?.toUpperCase().replace(/-/g, "_") || "NOTICE_SENT";
      counts[stage] = (counts[stage] || 0) + 1;
    });
    return counts;
  }, [legalTenants]);

  if (isLoading) return <PageSkeleton />;

  const tabs = [
    { key: "cases" as const, label: "Active Cases", icon: Scale, badge: legalTenants.length },
    { key: "import" as const, label: "Import Cases", icon: Upload },
    { key: "review" as const, label: "Review Queue", icon: ClipboardList, badge: reviewCount > 0 ? reviewCount : undefined },
    { key: "candidates" as const, label: "Suggested Referrals", icon: Sparkles, badge: recommended.length > 0 ? recommended.length : undefined },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Legal Cases</h1>
        {tab === "cases" && (
          <ExportButton
            data={legalTenants.map((t) => ({
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Active Cases" value={legalTenants.length} icon={Scale} color="#8B5CF6" />
            <StatCard label="Suggested Referrals" value={recommended.length} color="#F97316" />
            <StatCard label="Total Balance (Legal)" value={fmt$(legalTenants.reduce((s, t) => s + t.balance, 0))} color="#EF4444" />
            <StatCard label="In Court+" value={stageCounts.COURT_DATE + stageCounts.STIPULATION + stageCounts.JUDGMENT + stageCounts.WARRANT + stageCounts.EVICTION} color="#8B5CF6" />
          </div>

          <div className="flex gap-2 flex-wrap">
            {STAGES.map((s) => (
              <div key={s} className="bg-card-gradient border border-border rounded-lg px-3 py-2 text-center min-w-[80px]">
                <p className="text-lg font-bold text-text-primary">{stageCounts[s]}</p>
                <p className="text-[10px] text-text-dim uppercase">{s.replace(/_/g, " ")}</p>
              </div>
            ))}
          </div>

          {legalTenants.length > 0 ? (
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
                  {legalTenants.map((t) => (
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
            <EmptyState title="No active legal cases" icon={Scale} />
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
        onClose={() => setSelectedTenant(null)}
      />
    </div>
  );
}
