"use client";

import { useState } from "react";
import {
  Building2, Home, Users, Wrench, Scale, DollarSign,
  Zap, UserCheck, Download, Upload, FileSpreadsheet,
} from "lucide-react";
import Button from "@/components/ui/button";

interface ImportTypeCard {
  key: string;
  label: string;
  description: string;
  icon: typeof Building2;
  templateFile: string;
  importEndpoint: string;
  color: string;
}

const IMPORT_TYPES: ImportTypeCard[] = [
  { key: "buildings", label: "Buildings", description: "Portfolio properties with addresses, block/lot, units", icon: Building2, templateFile: "AtlasPM_Buildings_Template.xlsx", importEndpoint: "/api/import/buildings", color: "#C9A84C" },
  { key: "units", label: "Units", description: "Apartments and commercial spaces per building", icon: Home, templateFile: "AtlasPM_Units_Template.xlsx", importEndpoint: "/api/import/units", color: "#3B82F6" },
  { key: "tenants", label: "Tenants", description: "Residents with lease dates, rents, balances", icon: Users, templateFile: "AtlasPM_Tenants_Template.xlsx", importEndpoint: "/api/import/tenants", color: "#10B981" },
  { key: "workorders", label: "Work Orders", description: "Maintenance requests and repairs", icon: Wrench, templateFile: "AtlasPM_WorkOrders_Template.xlsx", importEndpoint: "/api/import/workorders", color: "#F59E0B" },
  { key: "legal", label: "Legal Cases", description: "Active court cases and eviction proceedings", icon: Scale, templateFile: "AtlasPM_LegalCases_Template.xlsx", importEndpoint: "/api/import/legal-cases", color: "#8B5CF6" },
  { key: "vendors", label: "Vendors", description: "Contractors, plumbers, electricians", icon: UserCheck, templateFile: "AtlasPM_Vendors_Template.xlsx", importEndpoint: "/api/import/vendors", color: "#EC4899" },
  { key: "ar", label: "AR Balances", description: "Aging receivables by tenant", icon: DollarSign, templateFile: "AtlasPM_ARBalance_Template.xlsx", importEndpoint: "/api/import/ar-aging", color: "#EF4444" },
  { key: "utilities", label: "Utilities", description: "Utility accounts and meters", icon: Zap, templateFile: "AtlasPM_Utilities_Template.xlsx", importEndpoint: "/api/import/utilities", color: "#06B6D4" },
];

interface Props {
  onStartImport?: (type: ImportTypeCard) => void;
}

export default function OnboardingCards({ onStartImport }: Props) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <FileSpreadsheet className="w-5 h-5 text-accent" />
        <h2 className="text-sm font-semibold text-text-primary">Quick Import</h2>
        <span className="text-[10px] text-text-dim uppercase tracking-wider">Download template → Fill data → Upload</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {IMPORT_TYPES.map((t) => (
          <ImportCard key={t.key} type={t} onImport={onStartImport} />
        ))}
      </div>
    </div>
  );
}

function ImportCard({ type, onImport }: { type: ImportTypeCard; onImport?: (t: ImportTypeCard) => void }) {
  const Icon = type.icon;

  return (
    <div className="bg-atlas-navy-3 border border-border rounded-xl p-4 flex flex-col gap-3 group hover:border-accent/30 transition-colors">
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${type.color}15` }}>
          <Icon className="w-4 h-4" style={{ color: type.color }} />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary">{type.label}</p>
        <p className="text-[11px] text-text-dim mt-0.5 leading-snug">{type.description}</p>
      </div>
      <div className="flex gap-2 mt-auto">
        <a
          href={`/templates/${type.templateFile}`}
          download
          className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium text-text-muted border border-border rounded-lg hover:bg-card-hover hover:text-text-primary transition-colors"
        >
          <Download className="w-3 h-3" />
          Template
        </a>
        <button
          onClick={() => onImport?.(type)}
          className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent/10 transition-colors"
        >
          <Upload className="w-3 h-3" />
          Import
        </button>
      </div>
    </div>
  );
}

export { IMPORT_TYPES };
export type { ImportTypeCard };
