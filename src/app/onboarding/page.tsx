"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Shield,
  User,
  Eye,
  LayoutDashboard,
  Bell,
  Rocket,
  Check,
  Lock,
  Unlock,
  Loader2,
  Building2,
  Users,
  DollarSign,
  Scale,
  Wrench,
  ClipboardCheck,
  Home,
  RefreshCw,
  Zap,
  BarChart3,
  Database,
  Settings,
  Brain,
  FileText,
  AlertTriangle,
  Clock,
  TrendingUp,
  Search,
  MessageSquare,
} from "lucide-react";
import { MODULE_PERMISSIONS, type Module } from "@/lib/permissions";
import type { UserRole } from "@/types";

// ── Types ────────────────────────────────────────────────────

interface PersonalInfo {
  displayName: string;
  jobTitle: string;
  mobile: string;
  timezone: string;
}

interface DashboardPrefs {
  defaultView: string;
  briefingItems: string[];
  briefingTime: "morning" | "midday" | "off";
}

interface AlertPrefs {
  alerts: string[];
  alertChannel: "in_app" | "sms" | "both";
  quietHours: boolean;
  quietStart: string;
  quietEnd: string;
}

// ── Constants ────────────────────────────────────────────────

const STEP_ICONS = [Shield, User, Eye, LayoutDashboard, Bell, Rocket];
const STEP_LABELS = ["Legal", "Profile", "Access", "Dashboard", "Alerts", "Tour"];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
];

const JOB_SUGGESTIONS = [
  "Property Manager",
  "Senior PM",
  "Leasing Agent",
  "AR Specialist",
  "Building Super",
  "Asset Manager",
  "Broker",
];

const MODULE_LABELS: Record<string, { label: string; icon: typeof Building2 }> = {
  dashboard: { label: "Dashboard", icon: LayoutDashboard },
  properties: { label: "Properties", icon: Building2 },
  tenants: { label: "Tenants", icon: Users },
  collections: { label: "Collections", icon: DollarSign },
  legal: { label: "Legal", icon: Scale },
  maintenance: { label: "Maintenance", icon: Wrench },
  compliance: { label: "Compliance", icon: ClipboardCheck },
  vacancies: { label: "Vacancies", icon: Home },
  turnovers: { label: "Turnovers", icon: RefreshCw },
  utilities: { label: "Utilities", icon: Zap },
  "owner-dashboard": { label: "Owner Dashboard", icon: TrendingUp },
  coeus: { label: "AI Assistant", icon: Brain },
  reports: { label: "Reports", icon: BarChart3 },
  users: { label: "Users", icon: Users },
  "data-import": { label: "Data Import", icon: Database },
  settings: { label: "Settings", icon: Settings },
};

const ROLE_DISPLAY: Record<string, { name: string; description: string }> = {
  SUPER_ADMIN: { name: "Super Admin", description: "Full platform access with organization management" },
  ADMIN: { name: "Administrator", description: "Full access to all modules and user management" },
  ACCOUNT_ADMIN: { name: "Account Administrator", description: "Full access to your organization with user management" },
  PM: { name: "Property Manager", description: "Full operational access to manage properties and tenants" },
  APM: { name: "Assistant Property Manager", description: "Operational access without admin or import capabilities" },
  COLLECTOR: { name: "AR Specialist", description: "Collections, tenant management, and compliance access" },
  OWNER: { name: "Owner / Investor", description: "Read-only portfolio visibility and reporting" },
  LEASING_SPECIALIST: { name: "Leasing Specialist", description: "Vacancy and turnover management with property visibility" },
  BROKER: { name: "Broker", description: "Limited access to vacancies, properties, and reports" },
  SUPER: { name: "Building Superintendent", description: "Maintenance operations and building visibility" },
  ACCOUNTING: { name: "Accounting", description: "Financial reporting with tenant and collection visibility" },
  LEASING_AGENT: { name: "Leasing Agent", description: "Vacancy and turnover management with dashboard access" },
};

const BRIEFING_ITEMS_BY_MODULE: Record<string, { id: string; label: string }[]> = {
  collections: [{ id: "arrears_summary", label: "Arrears Summary" }],
  legal: [{ id: "legal_updates", label: "Legal Case Updates" }],
  maintenance: [{ id: "open_work_orders", label: "Open Work Orders" }],
  compliance: [{ id: "violations_due", label: "Violations Due Soon" }],
  vacancies: [{ id: "vacancy_pipeline", label: "Vacancy Pipeline" }],
  tenants: [{ id: "lease_expirations", label: "Upcoming Lease Expirations" }],
};

const ALERT_OPTIONS_BY_MODULE: Record<string, { id: string; label: string }[]> = {
  collections: [{ id: "new_arrears", label: "New arrears (30+ days)" }],
  legal: [{ id: "court_dates", label: "Upcoming court dates" }],
  maintenance: [{ id: "urgent_work_orders", label: "Urgent work orders" }],
  compliance: [
    { id: "violation_received", label: "New violation received" },
    { id: "compliance_due", label: "Compliance item due soon" },
  ],
  vacancies: [{ id: "new_vacancy", label: "New vacancy created" }],
  tenants: [{ id: "lease_expiring", label: "Lease expiring within 90 days" }],
};

const TOUR_CARDS_BY_PRESET: Record<string, { icon: typeof Building2; title: string; description: string }[]> = {
  PM: [
    { icon: LayoutDashboard, title: "Your Portfolio Dashboard", description: "See occupancy, arrears, and revenue at risk across all your buildings in one view." },
    { icon: Brain, title: "AI-Powered Insights", description: "Coeus analyzes your portfolio data and surfaces actionable recommendations daily." },
    { icon: ClipboardCheck, title: "Compliance Tracking", description: "HPD violations, DOB complaints, and local law deadlines are synced and tracked automatically." },
  ],
  APM: [
    { icon: LayoutDashboard, title: "Your Portfolio Dashboard", description: "See occupancy, arrears, and revenue at risk across all your buildings in one view." },
    { icon: Brain, title: "AI-Powered Insights", description: "Coeus analyzes your portfolio data and surfaces actionable recommendations daily." },
    { icon: ClipboardCheck, title: "Compliance Tracking", description: "HPD violations, DOB complaints, and local law deadlines are synced and tracked automatically." },
  ],
  COLLECTOR: [
    { icon: DollarSign, title: "Collections Dashboard", description: "Track arrears aging, payment history, and collection progress across your portfolio." },
    { icon: MessageSquare, title: "Tenant Communication", description: "Log calls, emails, and letters directly against tenant records for a complete audit trail." },
    { icon: BarChart3, title: "Collection Reports", description: "Generate detailed reports on collection performance and arrears trends." },
  ],
  OWNER: [
    { icon: TrendingUp, title: "Owner Dashboard", description: "Portfolio performance, occupancy trends, and financial summaries at a glance." },
    { icon: BarChart3, title: "Financial Reports", description: "Access detailed financial reporting across your properties." },
    { icon: ClipboardCheck, title: "Compliance Overview", description: "Monitor violation status and compliance across your portfolio." },
  ],
  LEASING_SPECIALIST: [
    { icon: Home, title: "Vacancy Management", description: "Track available units, showing activity, and application status in one place." },
    { icon: RefreshCw, title: "Turnover Tracking", description: "Manage unit turnovers from move-out inspection through make-ready to listing." },
    { icon: Search, title: "Property Access", description: "View property details and unit information to support your leasing efforts." },
  ],
  LEASING_AGENT: [
    { icon: Home, title: "Vacancy Management", description: "Track available units, showing activity, and application status in one place." },
    { icon: RefreshCw, title: "Turnover Tracking", description: "Manage unit turnovers from move-out inspection through make-ready to listing." },
    { icon: LayoutDashboard, title: "Your Dashboard", description: "See your assigned vacancies and leasing activity at a glance." },
  ],
  BROKER: [
    { icon: Home, title: "Available Listings", description: "View current vacancies and unit details for your assigned properties." },
    { icon: Building2, title: "Property Details", description: "Access building information and unit specifications." },
    { icon: BarChart3, title: "Market Reports", description: "Generate reports on vacancy rates and asking rents." },
  ],
  SUPER: [
    { icon: Wrench, title: "Work Orders", description: "View, update, and manage maintenance requests for your buildings." },
    { icon: Building2, title: "Building Info", description: "Access building systems, vendor contacts, and equipment details." },
    { icon: ClipboardCheck, title: "Inspection Tracking", description: "Track compliance inspections and violation remediation progress." },
  ],
  ACCOUNTING: [
    { icon: BarChart3, title: "Financial Reports", description: "Generate detailed AR aging, collection, and financial performance reports." },
    { icon: DollarSign, title: "Collection Monitoring", description: "Monitor arrears, payment patterns, and collection activity." },
    { icon: FileText, title: "Tenant Records", description: "Access tenant financial records and payment history." },
  ],
  SUPER_ADMIN: [
    { icon: LayoutDashboard, title: "Portfolio Command Center", description: "Full visibility across all organizations, buildings, and operational metrics." },
    { icon: Brain, title: "AI-Powered Insights", description: "Coeus analyzes portfolio data and surfaces actionable recommendations daily." },
    { icon: Settings, title: "Platform Administration", description: "Manage users, organizations, data imports, and system settings." },
  ],
  ADMIN: [
    { icon: LayoutDashboard, title: "Portfolio Command Center", description: "Full visibility across all buildings and operational metrics." },
    { icon: Brain, title: "AI-Powered Insights", description: "Coeus analyzes portfolio data and surfaces actionable recommendations daily." },
    { icon: Users, title: "Team Management", description: "Manage users, assign properties, and control access levels." },
  ],
  ACCOUNT_ADMIN: [
    { icon: LayoutDashboard, title: "Portfolio Command Center", description: "Full visibility across all buildings and operational metrics." },
    { icon: Brain, title: "AI-Powered Insights", description: "Coeus analyzes portfolio data and surfaces actionable recommendations daily." },
    { icon: Users, title: "Team Management", description: "Manage users, assign properties, and control access levels." },
  ],
};

const DEFAULT_VIEW_BY_ROLE: Record<string, string> = {
  SUPER_ADMIN: "dashboard",
  ADMIN: "dashboard",
  ACCOUNT_ADMIN: "dashboard",
  PM: "dashboard",
  APM: "dashboard",
  COLLECTOR: "collections",
  OWNER: "owner-dashboard",
  LEASING_SPECIALIST: "vacancies",
  LEASING_AGENT: "vacancies",
  BROKER: "vacancies",
  SUPER: "maintenance",
  ACCOUNTING: "reports",
};

// ── Progress Dots ────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
            i < current
              ? "bg-accent"
              : i === current
                ? "bg-accent ring-2 ring-accent/30 ring-offset-1 ring-offset-bg"
                : "bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}

// ── Step 0: Legal Agreement ──────────────────────────────────

function StepLegal({
  onAgree,
  saving,
}: {
  onAgree: () => void;
  saving: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (atBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  }, [hasScrolledToBottom]);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-text-primary font-display tracking-wide">
          Platform Services Agreement
        </h2>
        <p className="text-text-muted text-sm mt-1">
          Please review and accept the terms before continuing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Legal Text */}
        <div className="bg-atlas-navy-3 border border-border rounded-xl p-6">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="max-h-[480px] overflow-y-auto pr-2 scrollbar-thin"
          >
            <div className="prose prose-sm prose-invert text-text-dim">
              <p className="font-bold text-text-primary text-base">ATLASPM PLATFORM SERVICES AGREEMENT</p>
              <p className="font-semibold text-text-muted">End User Terms of Use &amp; Confidentiality Agreement</p>
              <p className="text-text-muted">Version 1.0</p>

              <p className="font-semibold text-accent mt-4">IMPORTANT: READ CAREFULLY BEFORE ACCESSING THE ATLASPM PLATFORM.</p>

              <p className="font-bold text-text-primary mt-6">1. PROPRIETARY SOFTWARE AND INTELLECTUAL PROPERTY</p>
              <p>The AtlasPM Platform, including all software code, algorithms, interfaces, database architecture, AI models, and all related materials (&ldquo;Proprietary Materials&rdquo;), are the exclusive property of Omri Kedem d/b/a AtlasPM and are protected by copyright, trade secret, and intellectual property laws.</p>
              <p>No ownership interest is transferred to you by your use of the Platform. You receive only a limited, non-exclusive, non-transferable, revocable license to use the Platform for authorized business purposes.</p>
              <p>You agree you will NOT:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Copy, reproduce, or distribute the Platform or any Proprietary Materials</li>
                <li>Reverse engineer, decompile, or attempt to derive source code</li>
                <li>Build competing products based on the Platform</li>
                <li>Scrape, extract, or export data for unauthorized purposes</li>
                <li>Share your credentials or allow others to access via your account</li>
                <li>Access the Platform for competitive intelligence purposes</li>
              </ul>

              <p className="font-bold text-text-primary mt-6">2. CONFIDENTIALITY</p>
              <p>All information accessed through the Platform — including tenant names, financial data, legal cases, violations, owner identities, portfolio data, and all operational records — is strictly confidential.</p>
              <p>You agree to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Hold all Platform data in strict confidence</li>
                <li>Not disclose any data to unauthorized parties</li>
                <li>Use data only for authorized job functions</li>
                <li>Immediately report any unauthorized access or disclosure</li>
                <li>Upon termination, cease all use and destroy any copies</li>
              </ul>

              <p className="font-bold text-text-primary mt-6">3. TENANT AND OWNER DATA</p>
              <p>You acknowledge that the Platform processes sensitive personal and financial information. You agree to handle all tenant and owner data in compliance with applicable privacy laws including the NY SHIELD Act.</p>

              <p className="font-bold text-text-primary mt-6">4. ACCEPTABLE USE</p>
              <p>You may use the Platform only for legitimate business purposes within your assigned role. Prohibited activities include unauthorized access, credential sharing, data scraping, and any use that violates applicable law.</p>

              <p className="font-bold text-text-primary mt-6">5. ACCOUNT SECURITY</p>
              <p>You are solely responsible for your account credentials. You acknowledge that your Platform activity is monitored and logged. Accessing functionality beyond your assigned permission level may violate the Computer Fraud and Abuse Act (18 U.S.C. &sect; 1030).</p>

              <p className="font-bold text-text-primary mt-6">6. ENFORCEMENT</p>
              <p>Breach of these terms may cause irreparable harm. The Company is entitled to seek immediate injunctive relief and full damages including attorneys&apos; fees.</p>

              <p className="font-bold text-text-primary mt-6">7. GOVERNING LAW</p>
              <p>This Agreement is governed by New York law. Disputes are subject to the exclusive jurisdiction of New York County courts.</p>

              <p className="font-bold text-text-primary mt-6">8. ELECTRONIC ACCEPTANCE</p>
              <p>Your click of &ldquo;I Agree&rdquo; constitutes a legally binding signature under the E-SIGN Act and the NY Electronic Signatures and Records Act.</p>

              <p className="mt-6 text-text-muted text-xs">&copy; 2026 Omri Kedem d/b/a AtlasPM. All Rights Reserved.</p>
              <p className="text-text-muted text-xs">Unauthorized reproduction or disclosure is strictly prohibited.</p>
            </div>
          </div>

          {!hasScrolledToBottom && (
            <div className="flex items-center justify-center gap-2 mt-3 text-text-dim text-xs animate-pulse">
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Scroll to read the full agreement</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        {/* Right: Acceptance Panel */}
        <div className="bg-atlas-navy-3 border border-border rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-accent/10">
                <Shield className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Your Agreement</h3>
                <p className="text-sm text-text-muted">Review required before accessing AtlasPM</p>
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <div className="flex items-start gap-3 text-sm text-text-dim">
                <Lock className="w-4 h-4 text-text-dim mt-0.5 shrink-0" />
                <span>All platform data is encrypted and access-logged</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-text-dim">
                <Shield className="w-4 h-4 text-text-dim mt-0.5 shrink-0" />
                <span>Your access is limited to your assigned role and properties</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-text-dim">
                <AlertTriangle className="w-4 h-4 text-text-dim mt-0.5 shrink-0" />
                <span>Unauthorized disclosure may result in legal action</span>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                hasScrolledToBottom
                  ? "border-border hover:border-accent/50 cursor-pointer"
                  : "border-border/50 opacity-50 cursor-not-allowed"
              }`}
            >
              <input
                type="checkbox"
                checked={agreed}
                disabled={!hasScrolledToBottom}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 accent-accent"
              />
              <span className="text-sm text-text-muted">
                I have read and agree to the AtlasPM Platform Services Agreement, including
                the confidentiality and acceptable use provisions.
              </span>
            </label>

            <button
              onClick={onAgree}
              disabled={!agreed || saving}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Continue to AtlasPM <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Personal Info ────────────────────────────────────

function StepPersonalInfo({
  info,
  onChange,
  onNext,
}: {
  info: PersonalInfo;
  onChange: (info: PersonalInfo) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-primary font-display tracking-wide">
          Your Profile
        </h2>
        <p className="text-text-muted text-sm mt-1">
          Confirm your details so your team knows who you are.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-text-muted mb-1">Display Name</label>
          <input
            type="text"
            value={info.displayName}
            onChange={(e) => onChange({ ...info, displayName: e.target.value })}
            placeholder="Your name"
            className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-1">Job Title</label>
          <input
            type="text"
            value={info.jobTitle}
            onChange={(e) => onChange({ ...info, jobTitle: e.target.value })}
            placeholder="e.g. Property Manager"
            list="job-suggestions"
            className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent"
          />
          <datalist id="job-suggestions">
            {JOB_SUGGESTIONS.map((j) => (
              <option key={j} value={j} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-1">
            Mobile Number <span className="text-text-dim">(optional)</span>
          </label>
          <input
            type="tel"
            value={info.mobile}
            onChange={(e) => onChange({ ...info, mobile: e.target.value })}
            placeholder="(212) 555-0100"
            className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-1">Timezone</label>
          <select
            value={info.timezone}
            onChange={(e) => onChange({ ...info, timezone: e.target.value })}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!info.displayName.trim()}
        className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-40"
      >
        Next <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Step 2: Access Review ────────────────────────────────────

function StepAccessReview({
  role,
  onNext,
}: {
  role: UserRole;
  onNext: () => void;
}) {
  const roleInfo = ROLE_DISPLAY[role] ?? { name: role, description: "" };
  const perms = MODULE_PERMISSIONS[role];

  const modules = useMemo(() => {
    if (!perms) return [];
    return (Object.keys(perms) as Module[])
      .filter((m) => m !== "organizations") // internal module
      .map((m) => ({
        key: m,
        label: MODULE_LABELS[m]?.label ?? m,
        Icon: MODULE_LABELS[m]?.icon ?? Building2,
        read: perms[m].read,
        write: perms[m].write,
      }));
  }, [perms]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-primary font-display tracking-wide">
          Your Access Level
        </h2>
        <p className="text-text-muted text-sm mt-1">
          Here&apos;s what you can see and do in AtlasPM.
        </p>
      </div>

      {/* Role Card */}
      <div className="bg-atlas-navy-3 border border-accent/30 rounded-xl p-5 flex items-center gap-4">
        <div className="p-3 rounded-xl bg-accent/10">
          <Unlock className="w-7 h-7 text-accent" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-text-primary">{roleInfo.name}</h3>
          <p className="text-sm text-text-muted">{roleInfo.description}</p>
        </div>
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {modules.map(({ key, label, Icon, read, write }) => {
          if (!read && !write) return null;
          const level = read && write ? "Full" : "View";
          const badgeColor =
            level === "Full"
              ? "bg-green-500/10 text-green-400 border-green-500/20"
              : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";

          return (
            <div
              key={key}
              className="bg-atlas-navy-3 border border-border rounded-lg p-3 flex items-center gap-3"
            >
              <Icon className="w-4 h-4 text-text-dim shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{label}</p>
              </div>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${badgeColor}`}
              >
                {level}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-text-dim text-center">
        To change your access level, contact your account administrator.
      </p>

      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white font-medium py-3 px-6 rounded-lg transition-colors"
      >
        Next <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Step 3: Dashboard & Briefing ─────────────────────────────

function StepDashboard({
  role,
  prefs,
  onChange,
  onNext,
}: {
  role: UserRole;
  prefs: DashboardPrefs;
  onChange: (prefs: DashboardPrefs) => void;
  onNext: () => void;
}) {
  const perms = MODULE_PERMISSIONS[role];

  const accessibleModules = useMemo(() => {
    if (!perms) return [];
    return (Object.keys(perms) as Module[]).filter(
      (m) => perms[m].read && m !== "organizations" && MODULE_LABELS[m]
    );
  }, [perms]);

  const briefingOptions = useMemo(() => {
    const items: { id: string; label: string }[] = [];
    for (const mod of accessibleModules) {
      const modItems = BRIEFING_ITEMS_BY_MODULE[mod];
      if (modItems) items.push(...modItems);
    }
    return items;
  }, [accessibleModules]);

  const toggleBriefingItem = (id: string) => {
    const next = prefs.briefingItems.includes(id)
      ? prefs.briefingItems.filter((x) => x !== id)
      : [...prefs.briefingItems, id];
    onChange({ ...prefs, briefingItems: next });
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-primary font-display tracking-wide">
          Dashboard &amp; Briefing
        </h2>
        <p className="text-text-muted text-sm mt-1">
          Choose your default landing page and daily briefing.
        </p>
      </div>

      {/* Default View */}
      <div>
        <label className="block text-sm text-text-muted mb-2">Default View</label>
        <div className="flex flex-wrap gap-2">
          {accessibleModules.map((m) => (
            <button
              key={m}
              onClick={() => onChange({ ...prefs, defaultView: m })}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                prefs.defaultView === m
                  ? "bg-accent text-white border-accent"
                  : "bg-bg border-border text-text-muted hover:border-accent/50"
              }`}
            >
              {MODULE_LABELS[m]?.label ?? m}
            </button>
          ))}
        </div>
      </div>

      {/* Briefing Items */}
      {briefingOptions.length > 0 && (
        <div>
          <label className="block text-sm text-text-muted mb-2">Daily Briefing Items</label>
          <div className="space-y-2">
            {briefingOptions.map((item) => (
              <label
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  prefs.briefingItems.includes(item.id)
                    ? "border-accent/30 bg-accent/5"
                    : "border-border hover:border-border"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                    prefs.briefingItems.includes(item.id)
                      ? "bg-accent border-accent"
                      : "border-border"
                  }`}
                >
                  {prefs.briefingItems.includes(item.id) && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
                <span className="text-sm text-text-primary">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Briefing Time */}
      <div>
        <label className="block text-sm text-text-muted mb-2">Briefing Delivery</label>
        <div className="flex gap-2">
          {(["morning", "midday", "off"] as const).map((t) => (
            <button
              key={t}
              onClick={() => onChange({ ...prefs, briefingTime: t })}
              className={`flex-1 text-sm py-2 rounded-lg border transition-colors capitalize ${
                prefs.briefingTime === t
                  ? "bg-accent text-white border-accent"
                  : "bg-bg border-border text-text-muted hover:border-accent/50"
              }`}
            >
              {t === "off" ? "Off" : t === "morning" ? "Morning" : "Midday"}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white font-medium py-3 px-6 rounded-lg transition-colors"
      >
        Next <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Step 4: Alert Preferences ────────────────────────────────

function StepAlerts({
  role,
  mobile,
  prefs,
  onChange,
  onNext,
}: {
  role: UserRole;
  mobile: string;
  prefs: AlertPrefs;
  onChange: (prefs: AlertPrefs) => void;
  onNext: () => void;
}) {
  const rolePerms = MODULE_PERMISSIONS[role];
  const hasMobile = mobile.trim().length > 0;

  const alertOptions = useMemo(() => {
    if (!rolePerms) return [];
    const items: { id: string; label: string }[] = [];
    for (const mod of Object.keys(rolePerms) as Module[]) {
      if (!rolePerms[mod].read) continue;
      const modAlerts = ALERT_OPTIONS_BY_MODULE[mod];
      if (modAlerts) items.push(...modAlerts);
    }
    return items;
  }, [rolePerms]);

  const toggleAlert = (id: string) => {
    const next = prefs.alerts.includes(id)
      ? prefs.alerts.filter((x) => x !== id)
      : [...prefs.alerts, id];
    onChange({ ...prefs, alerts: next });
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-primary font-display tracking-wide">
          Alert Preferences
        </h2>
        <p className="text-text-muted text-sm mt-1">
          Choose what you want to be notified about.
        </p>
      </div>

      {/* Alert Toggles */}
      {alertOptions.length > 0 && (
        <div className="space-y-2">
          {alertOptions.map((item) => (
            <label
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                prefs.alerts.includes(item.id)
                  ? "border-accent/30 bg-accent/5"
                  : "border-border hover:border-border"
              }`}
            >
              <div
                className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                  prefs.alerts.includes(item.id)
                    ? "bg-accent border-accent"
                    : "border-border"
                }`}
              >
                {prefs.alerts.includes(item.id) && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </div>
              <span className="text-sm text-text-primary">{item.label}</span>
            </label>
          ))}
        </div>
      )}

      {/* Alert Channel */}
      <div>
        <label className="block text-sm text-text-muted mb-2">Notification Channel</label>
        <div className="flex gap-2">
          {(["in_app", "sms", "both"] as const).map((ch) => {
            const disabled = (ch === "sms" || ch === "both") && !hasMobile;
            return (
              <button
                key={ch}
                onClick={() => !disabled && onChange({ ...prefs, alertChannel: ch })}
                disabled={disabled}
                className={`flex-1 text-sm py-2 rounded-lg border transition-colors ${
                  prefs.alertChannel === ch
                    ? "bg-accent text-white border-accent"
                    : disabled
                      ? "bg-bg border-border text-text-dim opacity-40 cursor-not-allowed"
                      : "bg-bg border-border text-text-muted hover:border-accent/50"
                }`}
              >
                {ch === "in_app" ? "In-App" : ch === "sms" ? "SMS" : "Both"}
              </button>
            );
          })}
        </div>
        {!hasMobile && (
          <p className="text-xs text-text-dim mt-1">
            Add a mobile number in your profile to enable SMS alerts.
          </p>
        )}
      </div>

      {/* Quiet Hours */}
      <div className="bg-atlas-navy-3 border border-border rounded-xl p-4">
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-text-dim" />
            <span className="text-sm text-text-primary">Quiet Hours</span>
          </div>
          <div
            className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
              prefs.quietHours ? "bg-accent" : "bg-white/10"
            }`}
            onClick={() => onChange({ ...prefs, quietHours: !prefs.quietHours })}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                prefs.quietHours ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </div>
        </label>

        {prefs.quietHours && (
          <div className="flex items-center gap-3 mt-3 pl-7">
            <select
              value={prefs.quietStart}
              onChange={(e) => onChange({ ...prefs, quietStart: e.target.value })}
              className="bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {Array.from({ length: 24 }, (_, i) => {
                const h = i.toString().padStart(2, "0");
                return (
                  <option key={h} value={`${h}:00`}>
                    {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                  </option>
                );
              })}
            </select>
            <span className="text-text-dim text-sm">to</span>
            <select
              value={prefs.quietEnd}
              onChange={(e) => onChange({ ...prefs, quietEnd: e.target.value })}
              className="bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {Array.from({ length: 24 }, (_, i) => {
                const h = i.toString().padStart(2, "0");
                return (
                  <option key={h} value={`${h}:00`}>
                    {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white font-medium py-3 px-6 rounded-lg transition-colors"
      >
        Next <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Step 5: Quick Tour ───────────────────────────────────────

function StepTour({
  role,
  saving,
  onFinish,
}: {
  role: UserRole;
  saving: boolean;
  onFinish: () => void;
}) {
  const cards = TOUR_CARDS_BY_PRESET[role] ?? TOUR_CARDS_BY_PRESET.PM ?? [];

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-primary font-display tracking-wide">
          You&apos;re Ready
        </h2>
        <p className="text-text-muted text-sm mt-1">
          Here&apos;s a quick look at what&apos;s waiting for you.
        </p>
      </div>

      <div className="space-y-3">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="bg-atlas-navy-3 border border-border rounded-xl p-5 flex items-start gap-4 hover:border-accent/30 transition-colors"
            >
              <div className="p-2.5 rounded-xl bg-accent/10 shrink-0">
                <Icon className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">{card.title}</h3>
                <p className="text-sm text-text-muted mt-1">{card.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onFinish}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white font-semibold py-3.5 px-6 rounded-lg transition-colors disabled:opacity-50 text-lg"
      >
        {saving ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            Go to my dashboard <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </div>
  );
}

// ── Main Wizard ──────────────────────────────────────────────

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const role = (session?.user?.role ?? "PM") as UserRole;

  // Personal Info
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    displayName: "",
    jobTitle: "",
    mobile: "",
    timezone: "America/New_York",
  });
  const [personalInfoInitialized, setPersonalInfoInitialized] = useState(false);

  // Initialize displayName from session once loaded
  if (session?.user?.name && !personalInfoInitialized) {
    setPersonalInfo((prev) => ({ ...prev, displayName: session.user.name }));
    setPersonalInfoInitialized(true);
  }

  // Dashboard Prefs
  const [dashboardPrefs, setDashboardPrefs] = useState<DashboardPrefs>({
    defaultView: DEFAULT_VIEW_BY_ROLE[role] ?? "dashboard",
    briefingItems: [],
    briefingTime: "morning",
  });

  // Alert Prefs
  const [alertPrefs, setAlertPrefs] = useState<AlertPrefs>({
    alerts: [],
    alertChannel: "in_app",
    quietHours: false,
    quietStart: "22:00",
    quietEnd: "07:00",
  });

  // Already onboarded -> go to dashboard
  if (status === "authenticated" && session?.user?.onboardingComplete) {
    router.replace("/");
    return null;
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  const TOTAL_STEPS = 6;
  const canGoBack = step > 0;
  const canSkip = step >= 3;

  async function handleAgreeTerms() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/user/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true }),
      });
      if (!res.ok) {
        const data: Record<string, string> = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to accept terms");
      }
      setStep(1);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleFinish() {
    setSaving(true);
    setError("");
    try {
      // Map wizard alert IDs to API boolean fields
      const alerts = alertPrefs.alerts;
      const prefsPayload = {
        displayName: personalInfo.displayName.trim(),
        jobTitle: personalInfo.jobTitle.trim() || null,
        mobile: personalInfo.mobile.trim() || null,
        timezone: personalInfo.timezone,
        defaultView: dashboardPrefs.defaultView,
        briefingItems: dashboardPrefs.briefingItems,
        briefingTime: dashboardPrefs.briefingTime,
        alertTenant30Days: alerts.includes("new_arrears"),
        alertTenant60Days: alerts.includes("new_arrears"),
        alertTenant90Days: alerts.includes("new_arrears"),
        alertViolationClassC: alerts.includes("violation_received"),
        alertViolationAll: alerts.includes("violation_received"),
        alertLeaseExpiring30: alerts.includes("lease_expiring"),
        alertWorkOrderAssigned: alerts.includes("urgent_work_orders"),
        alertWorkOrderOverdue: alerts.includes("urgent_work_orders"),
        alertChannel: alertPrefs.alertChannel,
        quietHoursEnabled: alertPrefs.quietHours,
        quietHoursStart: alertPrefs.quietHours ? alertPrefs.quietStart : null,
        quietHoursEnd: alertPrefs.quietHours ? alertPrefs.quietEnd : null,
      };

      const prefsRes = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefsPayload),
      });
      if (!prefsRes.ok) {
        const data: Record<string, string> = await prefsRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save preferences");
      }

      // Mark onboarding complete
      const completeRes = await fetch("/api/onboarding/complete", {
        method: "PATCH",
      });
      if (!completeRes.ok) {
        const data: Record<string, string> = await completeRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to complete onboarding");
      }

      // Refresh the NextAuth session so the JWT picks up onboardingComplete=true
      await update();

      // Redirect to chosen default view
      const dest = dashboardPrefs.defaultView === "dashboard" ? "/" : `/${dashboardPrefs.defaultView}`;
      router.push(dest);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <div className="pt-8 pb-4 px-6 flex flex-col items-center">
        <Image
          src="/images/atlaspm-logo.jpg"
          alt="AtlasPM"
          width={160}
          height={80}
          className="rounded-xl mb-6"
          style={{ height: "80px", width: "auto", filter: "drop-shadow(0 0 24px rgba(201, 168, 76, 0.3))" }}
          priority
        />
        <ProgressDots current={step} total={TOTAL_STEPS} />

        {/* Step Label */}
        <div className="flex items-center gap-2 mt-3">
          {(() => {
            const Icon = STEP_ICONS[step];
            return Icon ? <Icon className="w-4 h-4 text-accent" /> : null;
          })()}
          <span className="text-xs text-text-dim font-mono uppercase tracking-wider">
            {STEP_LABELS[step]}
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-6 mb-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm text-center max-w-2xl self-center w-full">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6 pb-12 pt-4">
        <div className="w-full max-w-5xl animate-fade-in">
          {step === 0 && (
            <StepLegal onAgree={handleAgreeTerms} saving={saving} />
          )}
          {step === 1 && (
            <StepPersonalInfo
              info={personalInfo}
              onChange={setPersonalInfo}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <StepAccessReview role={role} onNext={() => setStep(3)} />
          )}
          {step === 3 && (
            <StepDashboard
              role={role}
              prefs={dashboardPrefs}
              onChange={setDashboardPrefs}
              onNext={() => setStep(4)}
            />
          )}
          {step === 4 && (
            <StepAlerts
              role={role}
              mobile={personalInfo.mobile}
              prefs={alertPrefs}
              onChange={setAlertPrefs}
              onNext={() => setStep(5)}
            />
          )}
          {step === 5 && (
            <StepTour role={role} saving={saving} onFinish={handleFinish} />
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="py-4 px-6 border-t border-border/30">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            {canGoBack && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>

          <p className="text-xs text-text-dim">
            &copy; 2026 AtlasPM&trade;. All rights reserved.
          </p>

          <div>
            {canSkip && (
              <button
                onClick={() => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))}
                className="text-sm text-text-dim hover:text-text-muted transition-colors"
              >
                Skip
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
