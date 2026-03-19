"use client";

import { BarChart3, FileDown, Printer, AlertTriangle, RefreshCw, Database } from "lucide-react";
import Button from "@/components/ui/button";
import { useTenants } from "@/hooks/use-tenants";
import { useMetrics } from "@/hooks/use-metrics";
import { useExportExcel } from "@/hooks/use-export";
import { generateCollectionReport } from "@/lib/report-generator";
import { PageSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import KpiCard from "@/components/ui/kpi-card";
import { fmt$ } from "@/lib/utils";

export default function ReportsContent() {
  const { data: tenants, isLoading, isError, refetch } = useTenants();
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

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-dim animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>
        <p className="text-sm text-text-muted">Failed to load report data. Please try again.</p>
        <button onClick={() => refetch()} className="mt-3 text-xs text-accent hover:underline flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  if (!tenants || tenants.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
        <EmptyState
          icon={Database}
          title="No tenant data available"
          description="Import tenant data to generate reports."
          action={{ label: "Import Data", href: "/data" }}
        />
      </div>
    );
  }

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
