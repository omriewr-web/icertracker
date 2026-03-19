"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink, LogOut, Clock, CheckCircle, Circle, AlertTriangle,
  FileText, ClipboardList, Settings, StickyNote, Map,
  Shield, DollarSign, Building2, Bug, Zap, Layers,
} from "lucide-react";

// ── Types ──

interface DocFile { name: string; lastModified: string; dir: string }
interface BuildStatus { lastDeploy: string; testsPassing: number; typescriptErrors: number; liveUrl: string }

// ── Colors ──

const BG = "#0A0F1C";
const BG_CARD = "#111827";
const BG_CARD_HOVER = "#1a2236";
const GOLD = "#B8972B";
const GOLD_DIM = "#B8972B60";
const GREEN = "#4caf82";
const RED = "#e05c5c";
const AMBER = "#e09a3e";
const TEXT = "#e2e8f0";
const TEXT_DIM = "#64748b";
const BORDER = "#1e293b";

// ── Roadmap Data (fetched from TRACKER.md at runtime) ──

type TaskStatus = "done" | "in-progress" | "todo" | "warning";

// ── Business Checklist Data ──

interface CheckItem { label: string; defaultChecked?: boolean }
interface CheckSection { title: string; icon: typeof Shield; items: CheckItem[] }

const CHECKLIST: CheckSection[] = [
  {
    title: "Company Setup", icon: Building2,
    items: [
      { label: "Form LLC (NY or Delaware + NY registration)" },
      { label: "Obtain EIN" },
      { label: "Open business bank account" },
      { label: "Set up accounting (QuickBooks or Xero)" },
    ],
  },
  {
    title: "Legal", icon: FileText,
    items: [
      { label: "Terms of Service (drafted \u2014 attorney review pending)" },
      { label: "Privacy Policy" },
      { label: "Data Processing Agreement" },
      { label: "SaaS Agreement" },
      { label: "Hire SaaS-focused lawyer" },
    ],
  },
  {
    title: "Insurance", icon: Shield,
    items: [
      { label: "General Liability" },
      { label: "Professional Liability (E&O)" },
      { label: "Cyber Liability" },
    ],
  },
  {
    title: "Product Readiness", icon: Zap,
    items: [
      { label: "Stable collections module", defaultChecked: true },
      { label: "Stable work orders module", defaultChecked: true },
      { label: "Stable violations tracking", defaultChecked: true },
      { label: "User permissions fully implemented", defaultChecked: true },
      { label: "Audit logs implemented (in production audit sprint)" },
    ],
  },
  {
    title: "Security", icon: Shield,
    items: [
      { label: "Multi-tenant isolation verified (production audit)" },
      { label: "Daily backups configured" },
      { label: "Encryption enabled" },
      { label: "Authentication secure" },
    ],
  },
  {
    title: "Go-To-Market", icon: Map,
    items: [
      { label: "Use internally on own buildings (in progress)" },
      { label: "Onboard 2-5 pilot clients" },
      { label: "Create onboarding process", defaultChecked: true },
      { label: "Set up support channel" },
    ],
  },
  {
    title: "Tech Infrastructure", icon: Settings,
    items: [
      { label: "1Password / Bitwarden set up" },
      { label: "Supabase daily backups enabled" },
      { label: "Supabase restore tested" },
      { label: "Google Workspace: ai@myatlaspm.com" },
      { label: "Vercel env vars per environment verified" },
      { label: "Stripe set up" },
      { label: "UptimeRobot set up" },
      { label: "PostHog set up" },
    ],
  },
];

// ── Tech Setup Data ──

const TECH_SECTIONS = [
  { title: "Monitoring & Errors", content: "Sentry \u2014 already configured \u2713\n  Verify production alerts: sentry.io dashboard" },
  { title: "Security & Access", content: "Password Manager \u2014 1Password or Bitwarden\n  Store: API keys, DB credentials, OAuth secrets, Stripe keys\n  Rule: Never in notes, Slack, or code comments\n\nEnvironment Variables\n  Vercel: vercel.com/omriewr-webs-projects/atlaspm/settings/env\n  Never hardcode. Ever." },
  { title: "Database & Backups", content: "Supabase project: crhcuhjriccnfrcjcorz\n  Dashboard: supabase.com/dashboard/project/crhcuhjriccnfrcjcorz\n  Enable: Settings \u2192 Backups \u2192 Point-in-time recovery\n  Test: Actually restore a backup before real data lives there" },
  { title: "Payments", content: "Stripe \u2014 not yet set up\n  Need: Subscription plans, webhooks, customer portal\n  Pricing: $2/unit/month\n  1,000 units = $2K MRR | 5,000 units = $10K MRR" },
  { title: "Email", content: "Google Workspace\n  Target: ai@myatlaspm.com\n  Use: Atlas Inbox ingestion, user notifications, support" },
  { title: "Deployment", content: "Vercel: vercel.com/omriewr-webs-projects/atlaspm/deployments\n  Prod URL: myatlaspm.com\n  Deploy: npm run deploy\n  Filter 500s: ?statusCode=500" },
  { title: "Observability (not yet set up)", content: "UptimeRobot \u2014 uptimerobot.com (free tier)\nPostHog \u2014 posthog.com (product analytics)" },
];

// ── Quick Links ──

const LINKS = [
  { label: "myatlaspm.com", url: "https://www.myatlaspm.com" },
  { label: "Vercel deployments", url: "https://vercel.com/omriewr-webs-projects/atlaspm/deployments" },
  { label: "Supabase dashboard", url: "https://supabase.com/dashboard/project/crhcuhjriccnfrcjcorz" },
  { label: "Sentry dashboard", url: "https://sentry.io" },
  { label: "GitHub repo", url: "https://github.com/omriewr/atlaspm" },
];

const PRIORITIES = [
  "Form LLC",
  "Set up password manager",
  "Enable Supabase backups + test restore",
  "Send legal doc to attorney",
  "Reset demo + import first Yardi portfolio",
];

const KEY_NUMBERS = [
  { label: "Buildings", value: "79" },
  { label: "Units", value: "~1,200" },
  { label: "Portfolios", value: "5" },
  { label: "Tests passing", value: "99" },
  { label: "Bugs closed", value: "7/7" },
  { label: "Waves complete", value: "5/5" },
];

// ── Helpers ──

function StatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, { bg: string; text: string; label: string }> = {
    done: { bg: `${GREEN}20`, text: GREEN, label: "Done" },
    "in-progress": { bg: `${AMBER}20`, text: AMBER, label: "In Progress" },
    todo: { bg: `${TEXT_DIM}20`, text: TEXT_DIM, label: "Planned" },
    warning: { bg: `${RED}20`, text: RED, label: "Watch" },
  };
  const s = map[status];
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === "done") return <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: GREEN }} />;
  if (status === "in-progress") return <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: AMBER }} />;
  if (status === "warning") return <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: RED }} />;
  return <Circle className="w-3.5 h-3.5 shrink-0" style={{ color: TEXT_DIM }} />;
}

// ── Main Page ──

export default function ODKCommandCenter() {
  const router = useRouter();
  const [tab, setTab] = useState<"roadmap" | "docs" | "checklist" | "tech" | "notes">("roadmap");
  const [time, setTime] = useState(new Date());
  const [status, setStatus] = useState<BuildStatus | null>(null);

  // Docs state
  const [docFiles, setDocFiles] = useState<DocFile[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [docContent, setDocContent] = useState("");

  // Checklist state (persisted to localStorage)
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Notes state
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);

  // Clock
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Load status
  useEffect(() => {
    fetch("/api/command/status").then((r) => r.json()).then(setStatus).catch(() => {});
  }, []);

  // Load checklist from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("odk-checklist");
      if (stored) setChecked(JSON.parse(stored));
    } catch {}
  }, []);

  // Load notes from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("odk-notes");
      if (stored) setNotes(stored);
    } catch {}
  }, []);

  // Load doc list
  useEffect(() => {
    if (tab === "docs") {
      fetch("/api/command/docs").then((r) => r.json()).then((d) => setDocFiles(d.files || [])).catch(() => {});
    }
  }, [tab]);

  // Save checklist
  const toggleCheck = useCallback((key: string) => {
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("odk-checklist", JSON.stringify(next));
      return next;
    });
  }, []);

  // Save notes (debounced)
  useEffect(() => {
    if (!notes && notes !== "") return;
    const timer = setTimeout(() => {
      localStorage.setItem("odk-notes", notes);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 1500);
    }, 1000);
    return () => clearTimeout(timer);
  }, [notes]);

  // Load specific doc
  const loadDoc = useCallback(async (name: string) => {
    setSelectedDoc(name);
    try {
      const res = await fetch(`/api/command/docs?file=${encodeURIComponent(name)}`);
      const data = await res.json();
      setDocContent(data.content || "File not found");
    } catch {
      setDocContent("Failed to load file");
    }
  }, []);

  function logout() {
    document.cookie = "odk-session=; path=/; max-age=0";
    router.push("/odk/login");
  }

  const TABS = [
    { key: "roadmap" as const, label: "Roadmap", icon: Map },
    { key: "docs" as const, label: "Docs", icon: FileText },
    { key: "checklist" as const, label: "Business Checklist", icon: ClipboardList },
    { key: "tech" as const, label: "Tech Setup", icon: Settings },
    { key: "notes" as const, label: "Notes", icon: StickyNote },
  ];

  // Compute checklist item checked state (merge defaults + user toggles)
  const isChecked = useCallback((key: string, defaultChecked?: boolean) => {
    if (key in checked) return checked[key];
    return defaultChecked ?? false;
  }, [checked]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: BG, color: TEXT }}>
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: BORDER }}>
        <div>
          <h1 className="text-lg font-bold tracking-wider" style={{ color: GOLD }}>ODK Command Center</h1>
          <p className="text-xs" style={{ color: TEXT_DIM }}>AtlasPM — Internal View</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono" style={{ color: TEXT_DIM }}>
            {time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <a href="https://www.myatlaspm.com" target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 hover:opacity-80" style={{ color: GOLD }}>
            myatlaspm.com <ExternalLink className="w-3 h-3" />
          </a>
          <button onClick={logout} className="text-xs flex items-center gap-1 hover:opacity-80" style={{ color: TEXT_DIM }}>
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row">
        {/* ── Left Column ── */}
        <div className="flex-1 lg:w-[65%] p-6">
          {/* Tab bar */}
          <div className="flex gap-1 mb-6 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
                style={{
                  backgroundColor: tab === t.key ? `${GOLD}15` : "transparent",
                  color: tab === t.key ? GOLD : TEXT_DIM,
                  border: `1px solid ${tab === t.key ? `${GOLD}30` : "transparent"}`,
                }}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "roadmap" && <RoadmapTab />}
          {tab === "docs" && <DocsTab files={docFiles} selected={selectedDoc} content={docContent} onSelect={loadDoc} />}
          {tab === "checklist" && <ChecklistTab sections={CHECKLIST} isChecked={isChecked} onToggle={toggleCheck} />}
          {tab === "tech" && <TechTab />}
          {tab === "notes" && <NotesTab notes={notes} onNotesChange={setNotes} saved={notesSaved} />}
        </div>

        {/* ── Right Column — Live Status ── */}
        <div className="lg:w-[35%] p-6 border-t lg:border-t-0 lg:border-l" style={{ borderColor: BORDER }}>
          {/* Build Status */}
          <SideSection title="Build Status">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span style={{ color: TEXT_DIM }}>Last deploy</span><span>{status?.lastDeploy || "---"}</span></div>
              <div className="flex justify-between"><span style={{ color: TEXT_DIM }}>Tests</span><span style={{ color: GREEN }}>{status?.testsPassing || 99} passing</span></div>
              <div className="flex justify-between"><span style={{ color: TEXT_DIM }}>TypeScript</span><span style={{ color: GREEN }}>{status?.typescriptErrors || 0} errors</span></div>
              <div className="flex justify-between">
                <span style={{ color: TEXT_DIM }}>Live URL</span>
                <a href="https://www.myatlaspm.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ color: GOLD }}>
                  myatlaspm.com <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </SideSection>

          {/* Quick Links */}
          <SideSection title="Quick Links">
            <div className="space-y-1.5">
              {LINKS.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs hover:opacity-80" style={{ color: GOLD }}>
                  <ExternalLink className="w-3 h-3" /> {l.label}
                </a>
              ))}
            </div>
          </SideSection>

          {/* This Week's Priority */}
          <SideSection title="This Week's Priority">
            <ol className="space-y-1.5 text-xs list-decimal list-inside" style={{ color: TEXT }}>
              {PRIORITIES.map((p, i) => <li key={i}>{p}</li>)}
            </ol>
          </SideSection>

          {/* Key Numbers */}
          <SideSection title="Key Numbers">
            <div className="grid grid-cols-2 gap-2">
              {KEY_NUMBERS.map((n) => (
                <div key={n.label} className="rounded-lg p-2" style={{ backgroundColor: `${GOLD}08`, border: `1px solid ${GOLD}15` }}>
                  <p className="text-[10px] uppercase" style={{ color: TEXT_DIM }}>{n.label}</p>
                  <p className="text-sm font-bold font-mono" style={{ color: GOLD }}>{n.value}</p>
                </div>
              ))}
            </div>
          </SideSection>

          {/* Stack */}
          <SideSection title="Stack Reference">
            <div className="text-xs space-y-1" style={{ color: TEXT_DIM }}>
              <p>Next.js 14 / TypeScript / Prisma</p>
              <p>PostgreSQL / Supabase</p>
              <p>Vercel / Sentry</p>
              <p>Anthropic Claude API</p>
              <p className="font-mono text-[10px]">DB: crhcuhjriccnfrcjcorz</p>
            </div>
          </SideSection>
        </div>
      </div>
    </div>
  );
}

// ── Tab Components ──

interface TrackerSection {
  title: string;
  status: TaskStatus;
  tasks: { label: string; status: TaskStatus }[];
}

interface TrackerData {
  sections: TrackerSection[];
  activeWork: string[];
  knownIssues: string[];
  lastUpdated: string;
}

function RoadmapTab() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [tracker, setTracker] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const toggle = (title: string) => setCollapsed((p) => ({ ...p, [title]: !p[title] }));

  useEffect(() => {
    fetch("/api/command/tracker")
      .then((r) => r.json())
      .then((d: TrackerData) => { setTracker(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl p-4 animate-pulse" style={{ backgroundColor: BG_CARD, border: `1px solid ${BORDER}` }}>
            <div className="h-4 w-48 rounded" style={{ backgroundColor: `${TEXT_DIM}20` }} />
          </div>
        ))}
      </div>
    );
  }

  if (!tracker || tracker.sections.length === 0) {
    return <p className="text-xs" style={{ color: TEXT_DIM }}>No tracker data found. Check docs/TRACKER.md.</p>;
  }

  return (
    <div className="space-y-4">
      {tracker.lastUpdated && (
        <p className="text-[10px] font-mono" style={{ color: TEXT_DIM }}>
          Last updated: {tracker.lastUpdated}
        </p>
      )}

      {tracker.sections.map((section) => {
        const doneCount = section.tasks.filter((t) => t.status === "done").length;
        const pct = section.tasks.length > 0 ? (doneCount / section.tasks.length) * 100 : 0;

        return (
          <div key={section.title} className="rounded-xl overflow-hidden" style={{ backgroundColor: BG_CARD, border: `1px solid ${BORDER}` }}>
            <button
              onClick={() => toggle(section.title)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:opacity-90"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{section.title}</span>
                <StatusBadge status={section.status} />
              </div>
              <span className="text-xs" style={{ color: TEXT_DIM }}>
                {doneCount}/{section.tasks.length}
              </span>
            </button>
            {!collapsed[section.title] && (
              <div className="px-4 pb-3 space-y-1.5">
                <div className="h-1 rounded-full overflow-hidden mb-3" style={{ backgroundColor: `${TEXT_DIM}20` }}>
                  <div className="h-full rounded-full transition-all" style={{ backgroundColor: GREEN, width: `${pct}%` }} />
                </div>
                {section.tasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <StatusIcon status={task.status} />
                    <span className="text-xs flex-1" style={{ color: task.status === "done" ? TEXT_DIM : TEXT, textDecoration: task.status === "done" ? "line-through" : "none" }}>
                      {task.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Active Work */}
      {tracker.activeWork.length > 0 && (
        <div className="rounded-xl p-4" style={{ backgroundColor: BG_CARD, border: `1px solid ${BORDER}` }}>
          <h3 className="text-sm font-medium mb-2" style={{ color: GOLD }}>Active Work</h3>
          <ul className="space-y-1">
            {tracker.activeWork.map((item, i) => (
              <li key={i} className="text-xs flex items-start gap-2" style={{ color: TEXT }}>
                <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: AMBER }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Known Issues */}
      {tracker.knownIssues.length > 0 && (
        <div className="rounded-xl p-4" style={{ backgroundColor: BG_CARD, border: `1px solid ${BORDER}` }}>
          <h3 className="text-sm font-medium mb-2" style={{ color: RED }}>Known Issues</h3>
          <ul className="space-y-1">
            {tracker.knownIssues.map((item, i) => (
              <li key={i} className="text-xs flex items-start gap-2" style={{ color: TEXT_DIM }}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: RED }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DocsTab({ files, selected, content, onSelect }: { files: DocFile[]; selected: string | null; content: string; onSelect: (name: string) => void }) {
  return (
    <div className="flex gap-4 min-h-[500px]">
      <div className="w-48 shrink-0 space-y-1">
        {files.map((f) => (
          <button
            key={f.name}
            onClick={() => onSelect(f.name)}
            className="w-full text-left text-xs px-2 py-1.5 rounded truncate transition-colors"
            style={{
              backgroundColor: selected === f.name ? `${GOLD}15` : "transparent",
              color: selected === f.name ? GOLD : TEXT_DIM,
            }}
          >
            {f.name}
          </button>
        ))}
      </div>
      <div className="flex-1 rounded-xl p-4 overflow-auto" style={{ backgroundColor: BG_CARD, border: `1px solid ${BORDER}` }}>
        {selected ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium" style={{ color: GOLD }}>{selected}</h3>
              <button onClick={() => navigator.clipboard.writeText(content)} className="text-[10px] px-2 py-1 rounded" style={{ color: TEXT_DIM, border: `1px solid ${BORDER}` }}>
                Copy raw
              </button>
            </div>
            <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed" style={{ color: TEXT }}>{content}</pre>
          </>
        ) : (
          <p className="text-xs" style={{ color: TEXT_DIM }}>Select a document from the list.</p>
        )}
      </div>
    </div>
  );
}

function ChecklistTab({ sections, isChecked, onToggle }: { sections: CheckSection[]; isChecked: (key: string, def?: boolean) => boolean; onToggle: (key: string) => void }) {
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.title} className="rounded-xl p-4" style={{ backgroundColor: BG_CARD, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-2 mb-3">
            <section.icon className="w-4 h-4" style={{ color: GOLD }} />
            <h3 className="text-sm font-medium">{section.title}</h3>
          </div>
          <div className="space-y-2">
            {section.items.map((item) => {
              const key = `${section.title}:${item.label}`;
              const on = isChecked(key, item.defaultChecked);
              return (
                <label key={key} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onToggle(key)}
                    className="rounded border-gray-600 text-amber-600 focus:ring-amber-600/50 bg-transparent"
                  />
                  <span className="text-xs" style={{ color: on ? TEXT_DIM : TEXT, textDecoration: on ? "line-through" : "none" }}>
                    {item.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TechTab() {
  return (
    <div className="space-y-4">
      {TECH_SECTIONS.map((section) => (
        <div key={section.title} className="rounded-xl p-4" style={{ backgroundColor: BG_CARD, border: `1px solid ${BORDER}` }}>
          <h3 className="text-sm font-medium mb-2" style={{ color: GOLD }}>{section.title}</h3>
          <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed" style={{ color: TEXT_DIM }}>{section.content}</pre>
        </div>
      ))}
    </div>
  );
}

function NotesTab({ notes, onNotesChange, saved }: { notes: string; onNotesChange: (v: string) => void; saved: boolean }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: BG_CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium" style={{ color: GOLD }}>Scratchpad</h3>
        {saved && <span className="text-[10px]" style={{ color: GREEN }}>Saved</span>}
      </div>
      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        className="w-full min-h-[400px] bg-transparent text-xs font-mono outline-none resize-none leading-relaxed"
        style={{ color: TEXT }}
        placeholder="Type anything here. Saved locally."
      />
    </div>
  );
}

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-[10px] uppercase tracking-wider font-medium mb-3" style={{ color: TEXT_DIM }}>{title}</h3>
      {children}
    </div>
  );
}
