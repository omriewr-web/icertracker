"use client";

import { useState } from "react";
import { AlertTriangle, MessageSquare, Calendar, ClipboardCheck, CalendarDays, Building2 } from "lucide-react";
import ViolationsTab from "@/components/compliance/violations-tab";
import ComplaintsTab from "@/components/compliance/complaints-tab";
import HearingsTab from "@/components/compliance/hearings-tab";
import TrackerTab from "@/components/compliance/tracker-tab";
import CalendarTab from "@/components/compliance/calendar-tab";
import ScorecardTab from "@/components/compliance/scorecard-tab";

const tabs = [
  { key: "violations", label: "Violations", icon: AlertTriangle },
  { key: "complaints", label: "Complaints", icon: MessageSquare },
  { key: "hearings", label: "Hearings", icon: Calendar },
  { key: "tracker", label: "Compliance Tracker", icon: ClipboardCheck },
  { key: "calendar", label: "Compliance Calendar", icon: CalendarDays },
  { key: "scorecard", label: "Building Scorecard", icon: Building2 },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function ComplianceContent() {
  const [tab, setTab] = useState<TabKey>("violations");

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-text-primary font-display tracking-wide">Compliance & Violations</h1>

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
        {tab === "violations" && <ViolationsTab />}
        {tab === "complaints" && <ComplaintsTab />}
        {tab === "hearings" && <HearingsTab />}
        {tab === "tracker" && <TrackerTab />}
        {tab === "calendar" && <CalendarTab />}
        {tab === "scorecard" && <ScorecardTab />}
      </div>
    </div>
  );
}
