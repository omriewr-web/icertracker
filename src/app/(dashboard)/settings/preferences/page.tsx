"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Save, Loader2, Check } from "lucide-react";
import { MODULE_PERMISSIONS, type Module } from "@/lib/permissions";
import { canAccessModule } from "@/lib/permissions";
import type { UserRole } from "@/types";
import toast from "react-hot-toast";

interface Prefs {
  displayName: string | null;
  jobTitle: string | null;
  mobile: string | null;
  timezone: string;
  defaultView: string;
  briefingItems: string[];
  briefingTime: string;
  alertWorkOrderAssigned: boolean;
  alertTenant30Days: boolean;
  alertTenant60Days: boolean;
  alertTenant90Days: boolean;
  alertViolationClassC: boolean;
  alertViolationAll: boolean;
  alertLeaseExpiring30: boolean;
  alertWorkOrderOverdue: boolean;
  alertChannel: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
];

const JOB_TITLES = [
  "Property Manager", "Senior PM", "Leasing Agent", "AR Specialist",
  "Building Super", "Asset Manager", "Broker",
];

const BRIEFING_ITEMS_CONFIG: Array<{ key: string; label: string; modules: string[] }> = [
  { key: "work_orders", label: "Open work orders assigned to me", modules: ["maintenance"] },
  { key: "collection_alerts", label: "Collection alerts for my buildings", modules: ["collections"] },
  { key: "lease_expirations", label: "Lease expirations in next 60 days", modules: ["tenants", "vacancies"] },
  { key: "new_violations", label: "New HPD violations", modules: ["compliance"] },
  { key: "vacant_units", label: "Vacant units", modules: ["vacancies", "maintenance"] },
  { key: "legal_updates", label: "Legal case updates", modules: ["legal"] },
];

const ALERT_CONFIG: Array<{ key: keyof Prefs; label: string; modules: string[] }> = [
  { key: "alertWorkOrderAssigned", label: "New work order assigned to me", modules: ["maintenance"] },
  { key: "alertTenant30Days", label: "Tenant reaches 30 days late", modules: ["collections"] },
  { key: "alertTenant60Days", label: "Tenant reaches 60 days late", modules: ["collections"] },
  { key: "alertTenant90Days", label: "Tenant reaches 90 days late", modules: ["collections"] },
  { key: "alertViolationClassC", label: "New Class C violation", modules: ["compliance"] },
  { key: "alertViolationAll", label: "New violation (any class)", modules: ["compliance"] },
  { key: "alertLeaseExpiring30", label: "Lease expiring in 30 days", modules: ["tenants", "vacancies"] },
  { key: "alertWorkOrderOverdue", label: "Work order overdue", modules: ["maintenance"] },
];

const VIEWABLE_MODULES: Array<{ value: string; label: string; module: string }> = [
  { value: "dashboard", label: "Portfolio Overview", module: "dashboard" },
  { value: "collections", label: "Collections", module: "collections" },
  { value: "vacancies", label: "Vacancies", module: "vacancies" },
  { value: "maintenance", label: "Work Orders", module: "maintenance" },
  { value: "compliance", label: "Compliance", module: "compliance" },
  { value: "legal", label: "Legal Cases", module: "legal" },
  { value: "reports", label: "Reports", module: "reports" },
  { value: "owner-dashboard", label: "Owner Portal", module: "owner-dashboard" },
];

function TimeSelect({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      times.push(`${hh}:${mm}`);
    }
  }
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
    >
      <option value="">Select...</option>
      {times.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}

export default function PreferencesPage() {
  const { data: session } = useSession();
  const role = (session?.user?.role || "PM") as UserRole;
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/preferences")
      .then((r) => r.json())
      .then((data) => { setPrefs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function hasModule(mod: string): boolean {
    return canAccessModule(role, mod);
  }

  async function saveSection(section: string, data: Partial<Prefs>) {
    setSaving(section);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();
      setPrefs(updated);
      toast.success("Preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(null);
    }
  }

  if (loading || !prefs) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  function update(key: keyof Prefs, value: unknown) {
    setPrefs((p) => p ? { ...p, [key]: value } : p);
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Preferences</h1>
        <p className="text-sm text-text-dim mt-1">Customize your AtlasPM experience.</p>
      </div>

      {/* Section 1 — Personal Info */}
      <section className="bg-atlas-navy-3 border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Personal Info</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Display Name</label>
            <input
              type="text" value={prefs.displayName || ""}
              onChange={(e) => update("displayName", e.target.value || null)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Job Title</label>
            <input
              type="text" value={prefs.jobTitle || ""} list="job-titles"
              onChange={(e) => update("jobTitle", e.target.value || null)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
            <datalist id="job-titles">
              {JOB_TITLES.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Mobile</label>
            <input
              type="tel" value={prefs.mobile || ""} placeholder="+1 (212) 555-0100"
              onChange={(e) => update("mobile", e.target.value || null)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
            <p className="text-[11px] text-text-dim mt-1">For SMS alerts — coming soon</p>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Timezone</label>
            <select
              value={prefs.timezone}
              onChange={(e) => update("timezone", e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {US_TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => saveSection("personal", { displayName: prefs.displayName, jobTitle: prefs.jobTitle, mobile: prefs.mobile, timezone: prefs.timezone })}
            disabled={saving === "personal"}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-light text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving === "personal" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </section>

      {/* Section 2 — Dashboard & Briefing */}
      <section className="bg-atlas-navy-3 border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Dashboard & Briefing</h2>

        <div>
          <label className="block text-sm text-text-muted mb-2">Default view when you log in</label>
          <select
            value={prefs.defaultView}
            onChange={(e) => update("defaultView", e.target.value)}
            className="bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            {VIEWABLE_MODULES.filter((m) => hasModule(m.module)).map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-2">Morning briefing items</label>
          <div className="space-y-2">
            {BRIEFING_ITEMS_CONFIG.filter((item) => item.modules.some(hasModule)).map((item) => (
              <label key={item.key} className="flex items-center gap-3 text-sm text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.briefingItems.includes(item.key)}
                  onChange={(e) => {
                    const items = e.target.checked
                      ? [...prefs.briefingItems, item.key]
                      : prefs.briefingItems.filter((k) => k !== item.key);
                    update("briefingItems", items);
                  }}
                  className="rounded border-border"
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-2">Briefing time</label>
          <div className="flex gap-2">
            {(["morning", "midday", "off"] as const).map((t) => (
              <button
                key={t}
                onClick={() => update("briefingTime", t)}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                  prefs.briefingTime === t ? "bg-accent text-white border-accent" : "bg-bg border-border text-text-muted hover:border-accent/50"
                }`}
              >
                {t === "morning" ? "Morning (7-9am)" : t === "midday" ? "Midday (12-1pm)" : "Off"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => saveSection("briefing", { defaultView: prefs.defaultView, briefingItems: prefs.briefingItems, briefingTime: prefs.briefingTime })}
            disabled={saving === "briefing"}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-light text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving === "briefing" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </section>

      {/* Section 3 — Alert Preferences */}
      <section className="bg-atlas-navy-3 border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Alert Preferences</h2>

        <div className="space-y-2">
          {ALERT_CONFIG.filter((a) => a.modules.some(hasModule)).map((alert) => (
            <label key={alert.key} className="flex items-center gap-3 text-sm text-text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={prefs[alert.key] as boolean}
                onChange={(e) => update(alert.key, e.target.checked)}
                className="rounded border-border"
              />
              {alert.label}
            </label>
          ))}
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-2">Alert delivery</label>
          <div className="flex gap-2">
            {(["in_app", "sms", "both"] as const).map((ch) => {
              const disabled = ch !== "in_app" && !prefs.mobile;
              return (
                <button
                  key={ch}
                  onClick={() => !disabled && update("alertChannel", ch)}
                  disabled={disabled}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    prefs.alertChannel === ch ? "bg-accent text-white border-accent" : "bg-bg border-border text-text-muted hover:border-accent/50"
                  } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  {ch === "in_app" ? "In-app" : ch === "sms" ? "SMS" : "Both"}
                  {disabled && " (add mobile first)"}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-3 text-sm text-text-primary cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={prefs.quietHoursEnabled}
              onChange={(e) => update("quietHoursEnabled", e.target.checked)}
              className="rounded border-border"
            />
            Enable quiet hours
          </label>
          {prefs.quietHoursEnabled && (
            <div className="flex items-center gap-2 ml-7">
              <span className="text-sm text-text-dim">From</span>
              <TimeSelect value={prefs.quietHoursStart} onChange={(v) => update("quietHoursStart", v)} />
              <span className="text-sm text-text-dim">to</span>
              <TimeSelect value={prefs.quietHoursEnd} onChange={(v) => update("quietHoursEnd", v)} />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => saveSection("alerts", {
              alertWorkOrderAssigned: prefs.alertWorkOrderAssigned,
              alertTenant30Days: prefs.alertTenant30Days,
              alertTenant60Days: prefs.alertTenant60Days,
              alertTenant90Days: prefs.alertTenant90Days,
              alertViolationClassC: prefs.alertViolationClassC,
              alertViolationAll: prefs.alertViolationAll,
              alertLeaseExpiring30: prefs.alertLeaseExpiring30,
              alertWorkOrderOverdue: prefs.alertWorkOrderOverdue,
              alertChannel: prefs.alertChannel,
              quietHoursEnabled: prefs.quietHoursEnabled,
              quietHoursStart: prefs.quietHoursStart,
              quietHoursEnd: prefs.quietHoursEnd,
            })}
            disabled={saving === "alerts"}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-light text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving === "alerts" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </section>
    </div>
  );
}
