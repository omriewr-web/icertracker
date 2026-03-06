"use client";

import { useState } from "react";
import { Building2, Home, Users, Wrench, Upload, FileDown, ClipboardCheck } from "lucide-react";
import BuildingsTab from "@/components/data/buildings-tab";
import UnitsTab from "@/components/data/units-tab";
import TenantsTab from "@/components/data/tenants-tab";
import VendorsTab from "@/components/data/vendors-tab";
import ImportTab from "@/components/data/import-tab";
import ExportTab from "@/components/data/export-tab";
import StagingTab from "@/components/data/staging-tab";

const tabs = [
  { key: "buildings", label: "Buildings", icon: Building2 },
  { key: "units", label: "Units", icon: Home },
  { key: "tenants", label: "Tenants", icon: Users },
  { key: "vendors", label: "Vendors", icon: Wrench },
  { key: "import", label: "Import", icon: Upload },
  { key: "review", label: "Review Queue", icon: ClipboardCheck },
  { key: "export", label: "Export", icon: FileDown },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function DataContent() {
  const [tab, setTab] = useState<TabKey>("buildings");

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-text-primary">Data Management</h1>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t.key
                ? "text-accent border-b-2 border-accent"
                : "text-text-dim hover:text-text-muted"
            }`}
          >
            <t.icon className="w-4 h-4 shrink-0" />
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === "buildings" && <BuildingsTab />}
        {tab === "units" && <UnitsTab />}
        {tab === "tenants" && <TenantsTab />}
        {tab === "vendors" && <VendorsTab />}
        {tab === "import" && <ImportTab />}
        {tab === "review" && <StagingTab />}
        {tab === "export" && <ExportTab />}
      </div>
    </div>
  );
}
