"use client";

import { BarChart3, FileDown, Printer } from "lucide-react";
import Button from "@/components/ui/button";
import { useTenants } from "@/hooks/use-tenants";
import { useMetrics } from "@/hooks/use-metrics";
import { useExportExcel } from "@/hooks/use-export";
import { generateCollectionReport } from "@/lib/report-generator";
import { PageSkeleton } from "@/components/ui/skeleton";
import KpiCard from "@/components/ui/kpi-card";
import { fmt$ } from "@/lib/utils";

export default function ReportsContent() {
  const { data: tenants, isLoading } = useTenants();
  const { data: metrics } = useMetrics();
  const exportExcel = useExportExcel();

  function openCollectionReport() {
    if (!tenants || !metrics) return;
    const html = generateCollectionReport(tenants, metrics, "Collection Report");
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }

  function openArrearsReport() {
    if (!tenants || !metrics) return;
    const filtered = tenants.filter((t) => t.balance > 0 && t.arrearsCategory !== "current");
    const html = generateCollectionReport(filtered, metrics, "Arrears Report");
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }

  function openLegalReport() {
    if (!tenants || !metrics) return;
    const filtered = tenants.filter((t) => t.legalFlag || t.legalRecommended);
    const html = generateCollectionReport(filtered, metrics, "Legal Cases Report");
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }

  if (isLoading) return <PageSkeleton />;

  const arrearsTenants = (tenants || []).filter((t) => t.balance > 0 && t.arrearsCategory !== "current");
  const legalCount = (tenants || []).filter((t) => t.legalFlag).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-text-primary">Reports</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Tenants" value={tenants?.length || 0} icon={BarChart3} href="/data" />
        <KpiCard label="In Arrears" value={arrearsTenants.length} color="#EF4444" href="/collections" />
        <KpiCard label="Total Owed" value={fmt$(metrics?.totalBalance || 0)} color="#EF4444" href="/collections" />
        <KpiCard label="Legal Cases" value={legalCount} color="#8B5CF6" href="/legal" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ReportCard
          title="Collection Report"
          description="Full portfolio collection status with scores, arrears, and legal status"
          onGenerate={openCollectionReport}
        />
        <ReportCard
          title="Arrears Report"
          description="All tenants currently in arrears (30+ days)"
          onGenerate={openArrearsReport}
        />
        <ReportCard
          title="Legal Report"
          description="Active legal cases and tenants recommended for legal action"
          onGenerate={openLegalReport}
        />
      </div>

      <div className="bg-atlas-navy-3 border border-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-text-muted mb-3">Export Data</h3>
        <p className="text-xs text-text-dim mb-4">Download all tenant data as an Excel spreadsheet</p>
        <Button variant="outline" onClick={exportExcel}>
          <FileDown className="w-4 h-4" /> Export to Excel
        </Button>
      </div>
    </div>
  );
}

function ReportCard({ title, description, onGenerate }: { title: string; description: string; onGenerate: () => void }) {
  return (
    <div className="bg-atlas-navy-3 border border-border rounded-xl p-5 flex flex-col">
      <h3 className="text-sm font-medium text-text-primary mb-1">{title}</h3>
      <p className="text-xs text-text-dim mb-4 flex-1">{description}</p>
      <Button variant="outline" size="sm" onClick={onGenerate}>
        <Printer className="w-3.5 h-3.5" /> Generate
      </Button>
    </div>
  );
}
