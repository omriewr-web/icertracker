"use client";

import Link from "next/link";

const SOURCE_CONFIG: Record<string, { label: string; href: string; color: string }> = {
  violation: { label: "From Violation", href: "/compliance", color: "bg-red-500/10 text-red-400" },
  complaint: { label: "From Complaint", href: "/compliance", color: "bg-amber-500/10 text-amber-400" },
  inspection: { label: "From Inspection", href: "/maintenance", color: "bg-blue-500/10 text-blue-400" },
  schedule: { label: "From Schedule", href: "/maintenance", color: "bg-green-500/10 text-green-400" },
  tenant_request: { label: "Tenant Request", href: "/request", color: "bg-purple-500/10 text-purple-400" },
  vacancy: { label: "From Vacancy", href: "/vacancies", color: "bg-amber-500/10 text-amber-400" },
  move_out: { label: "From Move-Out", href: "/vacancies", color: "bg-amber-500/10 text-amber-400" },
};

interface Props {
  sourceType: string | null | undefined;
  sourceId?: string | null;
  linked?: boolean; // if true, render as a link
}

export default function SourceBadge({ sourceType, sourceId, linked = false }: Props) {
  if (!sourceType) return null;
  const config = SOURCE_CONFIG[sourceType];
  if (!config) return null;

  const badge = (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${config.color}`}>
      {config.label}
    </span>
  );

  if (linked) {
    return (
      <Link href={config.href} className="hover:opacity-80 transition-opacity">
        {badge}
      </Link>
    );
  }

  return badge;
}
