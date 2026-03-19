"use client";

import { useMemo } from "react";
import { Building2 } from "lucide-react";
import { useBuildings } from "@/hooks/use-buildings";
import { useViolations } from "@/hooks/use-violations";
import { useComplianceItems } from "@/hooks/use-compliance";
import { useAppStore } from "@/stores/app-store";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import { fmt$ } from "@/lib/utils";
import { calcBuildingHealthScore, getHealthLabel } from "@/lib/compliance-scoring";
import type { BuildingScorecard } from "@/types";

const LABEL_COLORS: Record<string, string> = {
  EXCELLENT: "text-green-400",
  GOOD: "text-blue-400",
  FAIR: "text-yellow-400",
  POOR: "text-orange-400",
  CRITICAL: "text-red-400",
};

const SCORE_BG: Record<string, string> = {
  EXCELLENT: "bg-green-500/10",
  GOOD: "bg-blue-500/10",
  FAIR: "bg-yellow-500/10",
  POOR: "bg-orange-500/10",
  CRITICAL: "bg-red-500/10",
};

export default function ScorecardTab() {
  const { selectedBuildingId } = useAppStore();
  const { data: buildings, isLoading: bLoading } = useBuildings();
  const { data: violations, isLoading: vLoading } = useViolations({});
  const { data: complianceItems, isLoading: cLoading } = useComplianceItems({});

  const scorecards = useMemo(() => {
    if (!buildings || !violations || !complianceItems) return [];

    const buildingMap = new Map(buildings.map((b) => [b.id, b]));
    const cards: BuildingScorecard[] = [];

    for (const building of buildings) {
      const bViolations = violations.filter((v) => v.buildingId === building.id);
      const bCompliance = complianceItems.filter((c) => c.buildingId === building.id);

      const classACount = bViolations.filter((v) => v.class === "A").length;
      const classBCount = bViolations.filter((v) => v.class === "B").length;
      const classCCount = bViolations.filter((v) => v.class === "C").length;
      const pendingFines = bViolations.reduce((sum, v) => sum + Number(v.penaltyAmount), 0);

      const overdueItems = bCompliance.filter((c) => c.status === "OVERDUE").length;
      const nonCompliantCount = bCompliance.filter((c) => c.status === "NON_COMPLIANT" || c.status === "OVERDUE").length;
      const compliantCount = bCompliance.filter((c) => c.status === "COMPLIANT").length;
      const complianceRate = bCompliance.length > 0 ? Math.round((compliantCount / bCompliance.length) * 100) : 100;

      const healthScore = calcBuildingHealthScore({
        classACount,
        classBCount,
        classCCount,
        overdueItems,
        totalComplianceItems: bCompliance.length,
        nonCompliantCount,
        totalPenalties: pendingFines,
      });

      cards.push({
        buildingId: building.id,
        address: building.address,
        classACount,
        classBCount,
        classCCount,
        pendingFines,
        complianceRate,
        overdueItems,
        healthScore,
        healthLabel: getHealthLabel(healthScore),
      });
    }

    return cards.sort((a, b) => a.healthScore - b.healthScore);
  }, [buildings, violations, complianceItems]);

  if (bLoading || vLoading || cLoading) return <CardGridSkeleton cards={6} />;

  // Single building detail view
  if (selectedBuildingId) {
    const card = scorecards.find((s) => s.buildingId === selectedBuildingId);
    if (!card) return <EmptyState icon={Building2} title="No compliance data" description="No violations or compliance items found for this building." />;

    return (
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">{card.address}</h3>
              <p className={`text-sm font-medium ${LABEL_COLORS[card.healthLabel]}`}>{card.healthLabel}</p>
            </div>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${SCORE_BG[card.healthLabel]}`}>
              <span className={`text-2xl font-bold ${LABEL_COLORS[card.healthLabel]}`}>{card.healthScore}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ScoreDetail label="Class C (Critical)" value={card.classCCount} color="text-red-400" />
            <ScoreDetail label="Class B (Hazardous)" value={card.classBCount} color="text-orange-400" />
            <ScoreDetail label="Class A (Non-Hazardous)" value={card.classACount} color="text-yellow-400" />
            <ScoreDetail label="Pending Fines" value={fmt$(card.pendingFines)} color="text-red-400" />
            <ScoreDetail label="Compliance Rate" value={`${card.complianceRate}%`} color="text-green-400" />
            <ScoreDetail label="Overdue Items" value={card.overdueItems} color="text-orange-400" />
          </div>
        </div>
      </div>
    );
  }

  // All buildings grid
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">{scorecards.length} buildings</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scorecards.map((card) => (
          <div key={card.buildingId} className="bg-card border border-border rounded-xl p-4 hover:bg-card-hover transition-colors">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-text-primary truncate mr-2">{card.address}</h4>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${SCORE_BG[card.healthLabel]}`}>
                <span className={`text-sm font-bold ${LABEL_COLORS[card.healthLabel]}`}>{card.healthScore}</span>
              </div>
            </div>
            <p className={`text-xs font-medium mb-2 ${LABEL_COLORS[card.healthLabel]}`}>{card.healthLabel}</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-text-dim">Violations</span>
                <p className="text-text-primary font-medium">{card.classACount + card.classBCount + card.classCCount}</p>
              </div>
              <div>
                <span className="text-text-dim">Fines</span>
                <p className="text-text-primary font-medium">{fmt$(card.pendingFines)}</p>
              </div>
              <div>
                <span className="text-text-dim">Compliance</span>
                <p className="text-text-primary font-medium">{card.complianceRate}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {scorecards.length === 0 && (
        <EmptyState icon={Building2} title="No building scorecards" description="Add buildings and sync violations to generate compliance health scores." action={{ label: "Import Buildings", href: "/data" }} />
      )}
    </div>
  );
}

function ScoreDetail({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-bg border border-border rounded-lg p-3">
      <span className="text-xs text-text-dim">{label}</span>
      <p className={`text-lg font-semibold ${color || "text-text-primary"}`}>{value}</p>
    </div>
  );
}
