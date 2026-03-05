"use client";

import { CalendarClock, AlertTriangle, FileText, Scale, DollarSign, Brain } from "lucide-react";
import { useDailySummary } from "@/hooks/use-metrics";
import LoadingSpinner from "@/components/ui/loading-spinner";
import TenantDetailModal from "@/components/tenant/tenant-detail-modal";
import TenantEditModal from "@/components/tenant/tenant-edit-modal";
import Button from "@/components/ui/button";
import { fmt$, formatDate } from "@/lib/utils";
import { getScoreLabel } from "@/lib/scoring";
import { useAppStore } from "@/stores/app-store";

export default function DailyContent() {
  const { data, isLoading } = useDailySummary();
  const { setDetailTenantId, setAiPanelOpen } = useAppStore();

  if (isLoading || !data) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarClock className="w-5 h-5 text-accent" />
          <h1 className="text-xl font-bold text-text-primary">Daily Summary</h1>
          <span className="text-sm text-text-dim">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
        </div>
        <Button size="sm" onClick={() => setAiPanelOpen(true)} className="bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20">
          <Brain className="w-3.5 h-3.5" /> AI Briefing
        </Button>
      </div>

      {data.urgentTenants?.length > 0 && (
        <Section title="Urgent — High Priority Accounts" icon={AlertTriangle} iconColor="text-red-400">
          <div className="space-y-1">
            {data.urgentTenants.map((t: any) => {
              const { color } = getScoreLabel(t.collectionScore);
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-card-hover cursor-pointer transition-colors"
                  onClick={() => setDetailTenantId(t.id)}
                >
                  <div>
                    <span className="text-text-primary text-sm">{t.name}</span>
                    <span className="text-text-dim text-xs ml-2">#{t.unit} — {t.building}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-red-400 text-sm font-medium">{fmt$(t.balance)}</span>
                    <span className="font-mono text-xs font-bold" style={{ color }}>
                      {t.collectionScore}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {data.expiringLeases?.length > 0 && (
        <Section title="Leases Expiring Soon" icon={FileText} iconColor="text-amber-400">
          <div className="space-y-1">
            {data.expiringLeases.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-card-hover cursor-pointer transition-colors" onClick={() => setDetailTenantId(t.id)}>
                <div>
                  <span className="text-text-primary text-sm">{t.name}</span>
                  <span className="text-text-dim text-xs ml-2">#{t.unit} — {t.building}</span>
                </div>
                <span className="text-amber-400 text-xs">{formatDate(t.leaseExpiration)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.legalCases?.length > 0 && (
        <Section title="Active Legal Cases" icon={Scale} iconColor="text-purple-400">
          <div className="space-y-1">
            {data.legalCases.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-card-hover transition-colors">
                <div>
                  <span className="text-text-primary text-sm">{c.tenant?.name}</span>
                  <span className="text-text-dim text-xs ml-2">
                    #{c.tenant?.unit?.unitNumber} — {c.tenant?.unit?.building?.address}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-red-400 text-xs">{fmt$(Number(c.tenant?.balance || 0))}</span>
                  <span className="text-purple-400 text-xs">{c.stage?.replace(/_/g, " ")}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.recentPayments?.length > 0 && (
        <Section title="Recent Payments" icon={DollarSign} iconColor="text-green-400">
          <div className="space-y-1">
            {data.recentPayments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <span className="text-text-primary text-sm">{p.tenant?.name}</span>
                  <span className="text-text-dim text-xs ml-2">by {p.recorder?.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-400 text-sm font-medium">{fmt$(Number(p.amount))}</span>
                  <span className="text-text-dim text-xs">{formatDate(p.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
      <TenantDetailModal />
      <TenantEditModal />
    </div>
  );
}

function Section({ title, icon: Icon, iconColor, children }: { title: string; icon: any; iconColor: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}
