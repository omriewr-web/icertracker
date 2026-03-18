"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Scale, ArrowLeft, ArrowRight, Upload, Mail, PenLine, Check, AlertTriangle, Download, Loader2, Plus, Trash2, Shield, Copy, Building2, X } from "lucide-react";
import Button from "@/components/ui/button";
import AIEnhanceButton from "@/components/ui/ai-enhance-button";
import { useBuildings } from "@/hooks/use-buildings";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────────

interface ThemisIntake {
  id: string;
  source: string;
  buildingId: string | null;
  rawBody: string | null;
  aiSummary: string | null;
  extractedIssue: string | null;
  extractedUnit: string | null;
  extractedContact: string | null;
  extractedDate: string | null;
  status: string;
  createdAt: string;
  attachmentUrls: string[] | null;
  building?: { address: string } | null;
}

interface SimilarWO {
  id: string;
  title: string;
  description: string | null;
  completedDate: string | null;
}

interface ExposureResult {
  exposureLevel: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  triggers: string[];
  relevantLaws: string[];
  recommendedActions: string[];
  hpdComplaintRisk: boolean;
  isChronicIssue: boolean;
  chronicCount: number;
  hasOpenClassC: boolean;
  hasOpenLegalCases: boolean;
}

interface PortfolioContext {
  buildingMatch: { id: string; address: string; totalUnits: number } | null;
  tenantMatches: { id: string; name: string; unitNumber: string; balance: number; leaseStatus?: string | null; moveInDate?: string | null }[];
  openViolations: { id: string; externalId: string; description: string; class: string | null; source: string; issuedDate?: string | null }[];
  recentWorkOrders: { id: string; title: string; status: string; category?: string; createdAt: string; completedDate?: string | null }[];
  openLegalCases: { id: string; stage: string; tenantName: string; filedDate?: string | null }[];
  tenantNotes?: { id: string; content: string; createdAt: string; category: string | null }[];
}

interface DraftResponse {
  draft: any;
  similarWorkOrders: SimilarWO[];
  review: { flaggedIssues: string[]; completenessScore: number; readyForPromotion: boolean };
  portfolioContext?: PortfolioContext;
  exposure?: ExposureResult;
  suggestedResponseEmail?: { subject: string; body: string };
  linkedViolations?: { id: string; externalId: string; description: string; class: string | null }[];
}

interface AccessAttempt {
  date: string;
  result: string;
  notes: string;
}

// ── Step Indicator ───────────────────────────────────────────────

const STEPS = ["Intake", "Verify", "AI Review", "Output"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < current;
        const isCurrent = stepNum === current;
        return (
          <div key={label} className="flex items-center gap-1.5">
            {i > 0 && <div className={cn("w-6 h-px", isCompleted ? "bg-green-500" : isCurrent ? "bg-accent" : "bg-border")} />}
            <div className={cn(
              "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
              isCompleted ? "bg-atlas-green/10 text-atlas-green" : isCurrent ? "bg-accent/10 text-accent animate-atlas-pulse-gold" : "bg-atlas-navy-3 text-text-dim"
            )}>
              <span>{stepNum}</span>
              <span>{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Source Badge ──────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
  const color = source === "EMAIL" ? "text-atlas-blue bg-atlas-blue/10" : source === "UPLOAD" ? "text-atlas-purple bg-atlas-purple/10" : "text-accent bg-accent/10";
  return <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", color)}>{source}</span>;
}

// ── Main Component ───────────────────────────────────────────────

export default function ThemisContent() {
  const searchParams = useSearchParams();
  const workOrderIdParam = searchParams.get("workOrderId");
  const { data: buildings } = useBuildings();
  const [step, setStep] = useState(1);
  const [intakes, setIntakes] = useState<ThemisIntake[]>([]);
  const [selectedIntake, setSelectedIntake] = useState<ThemisIntake | null>(null);
  const [currentDraft, setCurrentDraft] = useState<DraftResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Form state for intake submission ──
  const [formBuildingId, setFormBuildingId] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formSource, setFormSource] = useState("MANUAL");
  const [formDescription, setFormDescription] = useState("");
  const [formFiles, setFormFiles] = useState<{ name: string; dataUrl: string; isImage: boolean }[]>([]);
  const [prefillWOId, setPrefillWOId] = useState<string | null>(null);

  // ── Form state for verification ──
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftCategory, setDraftCategory] = useState("GENERAL");
  const [draftPriority, setDraftPriority] = useState("MEDIUM");
  const [draftTrade, setDraftTrade] = useState("");
  const [draftIncidentDate, setDraftIncidentDate] = useState("");
  const [draftScheduledDate, setDraftScheduledDate] = useState("");
  const [draftAssignedTo, setDraftAssignedTo] = useState("");
  const [accessAttempts, setAccessAttempts] = useState<AccessAttempt[]>([]);

  // ── Promotion state ──
  const [promoted, setPromoted] = useState(false);
  const [promotedWOId, setPromotedWOId] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Load intakes
  useEffect(() => {
    loadIntakes();
  }, []);

  // Pre-fill from work order if workOrderId is in URL
  useEffect(() => {
    if (!workOrderIdParam) return;
    setPrefillWOId(workOrderIdParam);
    fetch(`/api/work-orders/${workOrderIdParam}`)
      .then((r) => r.ok ? r.json() : null)
      .then((wo) => {
        if (!wo) return;
        setFormBuildingId(wo.buildingId || "");
        setFormDescription(`Work Order #${workOrderIdParam.slice(0, 8)}: ${wo.title}\n\n${wo.description || ""}`);
        setFormSource("MANUAL");
      })
      .catch(() => {});
  }, [workOrderIdParam]);

  function clearPrefill() {
    setPrefillWOId(null);
    setFormBuildingId("");
    setFormDescription("");
    setFormSource("MANUAL");
  }

  async function loadIntakes() {
    setLoading(true);
    try {
      const res = await fetch("/api/themis/intake?status=pending");
      if (res.ok) setIntakes(await res.json());
    } catch (err: any) {
      toast.error(err?.message || "Operation failed");
    }
    setLoading(false);
  }

  function selectIntake(intake: ThemisIntake) {
    setSelectedIntake(intake);
    setDraftTitle(intake.extractedIssue ? intake.extractedIssue.slice(0, 100) : "");
    setDraftDescription(intake.rawBody || "");
    setDraftCategory("GENERAL");
    setDraftPriority("MEDIUM");
    setDraftTrade("");
    setDraftIncidentDate(intake.extractedDate ? intake.extractedDate.split("T")[0] : "");
    setDraftScheduledDate("");
    setDraftAssignedTo("");
    setAccessAttempts([]);
    setCurrentDraft(null);
    setPromoted(false);
    setPromotedWOId(null);
    setStep(2);
  }

  async function submitIntake() {
    if (!formBuildingId || !formDescription) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/themis/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: formSource,
          buildingId: formBuildingId,
          unitId: formUnit || null,
          rawBody: formDescription,
          attachmentUrls: formFiles.length > 0 ? formFiles.map((f) => f.dataUrl) : null,
        }),
      });
      if (res.ok) {
        setFormBuildingId("");
        setFormUnit("");
        setFormSource("MANUAL");
        setFormDescription("");
        setFormFiles([]);
        loadIntakes();
      }
    } catch (err: any) {
      toast.error(err?.message || "Operation failed");
    }
    setSubmitting(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const isImage = file.type.startsWith("image/");
        setFormFiles((prev) => [...prev, { name: file.name, dataUrl, isImage }]);
      };
      reader.readAsDataURL(file);
    });
  }

  async function createDraft() {
    if (!selectedIntake || !draftTitle || !draftDescription) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/themis/intake/${selectedIntake.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle,
          description: draftDescription,
          category: draftCategory,
          priority: draftPriority,
          trade: draftTrade || null,
          scheduledDate: draftScheduledDate || null,
          incidentDate: draftIncidentDate || null,
          assignedToId: draftAssignedTo || null,
          accessAttempts: accessAttempts.length > 0 ? accessAttempts : null,
        }),
      });
      if (res.ok) {
        const data: DraftResponse = await res.json();
        setCurrentDraft(data);
        setStep(3);
      }
    } catch (err: any) {
      toast.error(err?.message || "Operation failed");
    }
    setSubmitting(false);
  }

  async function verifyDraft() {
    if (!currentDraft) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/themis/draft/${currentDraft.draft.id}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setStep(4);
      }
    } catch (err: any) {
      toast.error(err?.message || "Operation failed");
    }
    setSubmitting(false);
  }

  async function promoteDraft() {
    if (!currentDraft) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/themis/draft/${currentDraft.draft.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setPromoted(true);
        setPromotedWOId(data.workOrderId);
      }
    } catch (err: any) {
      toast.error(err?.message || "Operation failed");
    }
    setSubmitting(false);
  }

  async function downloadPdf() {
    if (!currentDraft) return;
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/themis/draft/${currentDraft.draft.id}/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `WO-${currentDraft.draft.id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      toast.error(err?.message || "Operation failed");
    }
    setPdfLoading(false);
  }

  function addAccessAttempt() {
    setAccessAttempts([...accessAttempts, { date: "", result: "no_answer", notes: "" }]);
  }

  function removeAccessAttempt(index: number) {
    setAccessAttempts(accessAttempts.filter((_, i) => i !== index));
  }

  function updateAccessAttempt(index: number, field: keyof AccessAttempt, value: string) {
    setAccessAttempts(accessAttempts.map((a, i) => i === index ? { ...a, [field]: value } : a));
  }

  const CATEGORIES = ["PLUMBING", "ELECTRICAL", "HVAC", "APPLIANCE", "GENERAL", "OTHER"];
  const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

  const inputClass = "w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent";
  const labelClass = "block text-xs text-text-dim mb-1";

  return (
    <div className="p-6 max-w-7xl mx-auto bg-atlas-navy-1 min-h-screen -m-4 sm:-m-6">
      <div className="flex items-center gap-3 mb-4">
        <Scale className="w-6 h-6 text-accent" />
        <div>
          <h1 className="text-xl font-semibold text-text-primary font-display tracking-wide">Legal Defense</h1>
          <span className="text-[10px] text-text-dim tracking-[0.2em] uppercase">Violation Response Packages</span>
        </div>
      </div>

      <StepIndicator current={step} />

      {/* ═══ STEP 1: INTAKE DASHBOARD ═══ */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Pending Intakes */}
          <div className="lg:col-span-1 space-y-2">
            <h2 className="text-sm font-semibold text-text-primary mb-2">Pending Intakes</h2>
            {loading && <p className="text-xs text-text-dim">Loading...</p>}
            {!loading && intakes.length === 0 && (
              <div className="bg-atlas-navy-3 border border-border rounded-lg p-6 text-center">
                <Scale className="w-8 h-8 text-text-dim mx-auto mb-2" />
                <p className="text-sm text-text-dim">No pending intakes — submit one using the form</p>
              </div>
            )}
            {intakes.map((intake) => (
              <button
                key={intake.id}
                onClick={() => selectIntake(intake)}
                className="w-full text-left bg-atlas-navy-3 border border-border rounded-lg p-3 hover:border-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <SourceBadge source={intake.source} />
                  <span className="text-xs text-text-dim">{intake.building?.address || "No building"}</span>
                </div>
                <p className="text-sm text-text-primary truncate">{(intake.rawBody || "").slice(0, 80)}</p>
                {intake.aiSummary && <p className="text-xs text-text-muted italic mt-1 truncate">{intake.aiSummary}</p>}
                <p className="text-[10px] text-text-dim mt-1">{new Date(intake.createdAt).toLocaleString()}</p>
              </button>
            ))}
          </div>

          {/* Right: Submit Form */}
          <div className="lg:col-span-2 bg-atlas-navy-3 border border-border rounded-lg p-5">
            {prefillWOId && (
              <div className="flex items-center justify-between rounded-md px-3 py-2 mb-3 border bg-blue-500/10 border-blue-500/20">
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px' }} className="text-blue-400">
                  Pre-filled from Work Order #{prefillWOId.slice(0, 8)}
                </span>
                <button onClick={clearPrefill} className="text-text-muted hover:text-text-primary transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <h2 className="text-sm font-semibold text-text-primary mb-4">New Intake</h2>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Building *</label>
                <select value={formBuildingId} onChange={(e) => setFormBuildingId(e.target.value)} className={inputClass}>
                  <option value="">Select building</option>
                  {buildings?.map((b) => <option key={b.id} value={b.id}>{b.address}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Unit Number (optional)</label>
                <input value={formUnit} onChange={(e) => setFormUnit(e.target.value)} className={inputClass} placeholder="e.g. 4A" />
              </div>
              <div>
                <label className={labelClass}>Source</label>
                <div className="flex gap-3">
                  {[{ value: "MANUAL", label: "Manual Entry", icon: PenLine }, { value: "UPLOAD", label: "File Upload", icon: Upload }, { value: "EMAIL", label: "Forwarded Email", icon: Mail }].map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setFormSource(s.value)}
                      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors",
                        formSource === s.value ? "border-accent text-accent bg-accent/10" : "border-border text-text-dim hover:text-text-muted")}
                    >
                      <s.icon className="w-3.5 h-3.5" />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Describe the issue or paste email content</label>
                <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={6} className={cn(inputClass, "resize-none")} placeholder="Tenant reported a leak in the bathroom ceiling..." />
                <AIEnhanceButton value={formDescription} context="general" onEnhanced={(v) => setFormDescription(v)} />
              </div>
              <div>
                <label className={labelClass}>Attachments</label>
                <input type="file" accept="image/*,.pdf,.txt" multiple onChange={handleFileChange} className="text-xs text-text-dim" />
                {formFiles.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {formFiles.map((f, i) => (
                      <div key={i} className="bg-bg border border-border rounded px-2 py-1 text-xs text-text-dim flex items-center gap-1">
                        {f.isImage ? <img src={f.dataUrl} alt={f.name} className="w-8 h-8 rounded object-cover" /> : <span>{f.name}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={submitIntake} disabled={!formBuildingId || !formDescription || submitting}>
                  {submitting ? "Submitting..." : "Submit Intake"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STEP 2: VERIFICATION FORM ═══ */}
      {step === 2 && selectedIntake && (
        <div className="bg-atlas-navy-3 border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-text-primary">Verify Intake</h2>
              <SourceBadge source={selectedIntake.source} />
            </div>
            <Button variant="outline" size="sm" onClick={() => setStep(1)}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Title *</label>
              <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Category</label>
                <select value={draftCategory} onChange={(e) => setDraftCategory(e.target.value)} className={inputClass}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Priority</label>
                <select value={draftPriority} onChange={(e) => setDraftPriority(e.target.value)} className={inputClass}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className={labelClass}>Description *</label>
              <textarea value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} rows={5} className={cn(inputClass, "resize-none")} />
            </div>
            <div>
              <label className={labelClass}>Trade</label>
              <input value={draftTrade} onChange={(e) => setDraftTrade(e.target.value)} className={inputClass} placeholder="e.g. PLUMBING" />
            </div>
            <div>
              <label className={labelClass}>Assigned To (User ID)</label>
              <input value={draftAssignedTo} onChange={(e) => setDraftAssignedTo(e.target.value)} className={inputClass} placeholder="User ID" />
            </div>
            <div>
              <label className={labelClass}>Incident Date</label>
              <input type="date" value={draftIncidentDate} onChange={(e) => setDraftIncidentDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Scheduled Date</label>
              <input type="date" value={draftScheduledDate} onChange={(e) => setDraftScheduledDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Access Attempts */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass}>Access Attempts</label>
              <button onClick={addAccessAttempt} className="text-xs text-accent hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {accessAttempts.map((a, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                <input type="date" value={a.date} onChange={(e) => updateAccessAttempt(i, "date", e.target.value)} className={inputClass} />
                <select value={a.result} onChange={(e) => updateAccessAttempt(i, "result", e.target.value)} className={inputClass}>
                  <option value="accessed">Accessed</option>
                  <option value="no_answer">No Answer</option>
                  <option value="refused">Refused</option>
                  <option value="not_home">Not Home</option>
                </select>
                <input value={a.notes} onChange={(e) => updateAccessAttempt(i, "notes", e.target.value)} className={inputClass} placeholder="Notes" />
                <button onClick={() => removeAccessAttempt(i)} className="text-red-400 hover:text-red-300 text-xs flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Attachment preview */}
          {selectedIntake.attachmentUrls && (selectedIntake.attachmentUrls as string[]).length > 0 && (
            <div className="mt-4">
              <label className={labelClass}>Attachments</label>
              <div className="flex gap-2 flex-wrap">
                {(selectedIntake.attachmentUrls as string[]).map((url, i) => (
                  <div key={i} className="w-16 h-16 rounded border border-border overflow-hidden">
                    {url.startsWith("data:image") ? (
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-text-dim bg-bg">File</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <Button onClick={createDraft} disabled={!draftTitle || !draftDescription || submitting}>
              {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Creating...</> : "Confirm & Create Draft"}
            </Button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: AI REVIEW ═══ */}
      {step === 3 && currentDraft && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: AI Flags */}
          <div className="bg-atlas-navy-3 border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-3">AI Flags</h2>
            {currentDraft.review.flaggedIssues.length > 0 ? (
              <div className="space-y-2">
                {currentDraft.review.flaggedIssues.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-yellow-200">{flag}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                <Check className="w-5 h-5 text-green-400 mx-auto mb-1" />
                <p className="text-sm text-green-300">No flags — package complete</p>
              </div>
            )}

            {/* Completeness Score */}
            <div className="mt-4">
              <label className="text-xs text-text-dim mb-1 block">Completeness Score</label>
              <div className="w-full bg-bg rounded-full h-3 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", currentDraft.review.completenessScore >= 80 ? "bg-green-500" : currentDraft.review.completenessScore >= 50 ? "bg-yellow-500" : "bg-red-500")}
                  style={{ width: `${currentDraft.review.completenessScore}%` }}
                />
              </div>
              <p className="text-xs text-text-dim mt-1">{currentDraft.review.completenessScore}/100</p>
            </div>

            {currentDraft.review.completenessScore >= 80 && currentDraft.review.flaggedIssues.length === 0 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mt-4 text-center">
                <p className="text-sm text-green-300 font-medium">Ready for promotion</p>
              </div>
            )}
          </div>

          {/* Right: Similar Work Orders */}
          <div className="bg-atlas-navy-3 border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Similar Past Work Orders</h2>
            {currentDraft.similarWorkOrders.length > 0 ? (
              <div className="space-y-2">
                {currentDraft.similarWorkOrders.map((wo) => (
                  <div key={wo.id} className="bg-bg border border-border rounded-lg p-3">
                    <p className="text-sm text-text-primary font-medium">{wo.title}</p>
                    <p className="text-xs text-text-dim mt-1">{wo.completedDate ? `Completed: ${new Date(wo.completedDate).toLocaleDateString()}` : "In Progress"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-bg border border-border rounded-lg p-6 text-center">
                <p className="text-sm text-text-dim">No similar records found</p>
              </div>
            )}
          </div>

          {/* Legal Exposure */}
          {currentDraft.exposure && currentDraft.exposure.exposureLevel !== "NONE" && (
            <div className="lg:col-span-2 bg-atlas-navy-3 border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <Scale className="w-4 h-4 text-text-muted" />
                <h2 className="text-sm font-semibold text-text-primary">Legal Exposure</h2>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                  currentDraft.exposure.exposureLevel === "CRITICAL" ? "bg-atlas-red/20 text-atlas-red" :
                  currentDraft.exposure.exposureLevel === "HIGH" ? "bg-atlas-amber/20 text-atlas-amber" :
                  currentDraft.exposure.exposureLevel === "MEDIUM" ? "bg-accent/20 text-accent" :
                  currentDraft.exposure.exposureLevel === "LOW" ? "bg-atlas-blue/20 text-atlas-blue" :
                  "bg-atlas-green/20 text-atlas-green"
                )}>
                  {currentDraft.exposure.exposureLevel}
                </span>
              </div>

              {currentDraft.exposure.hpdComplaintRisk && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-xs text-red-300 font-medium">HPD Complaint Risk — Document everything</span>
                </div>
              )}

              {currentDraft.exposure.isChronicIssue && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2.5 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                  <span className="text-xs text-orange-300 font-medium">Chronic Issue — {currentDraft.exposure.chronicCount} prior occurrences found</span>
                </div>
              )}

              <div className="space-y-1.5 mb-3">
                {currentDraft.exposure.triggers.map((t, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-yellow-200">{t}</span>
                  </div>
                ))}
              </div>

              {currentDraft.exposure.relevantLaws.length > 0 && (
                <div className="text-[11px] text-text-dim space-y-0.5 mb-3">
                  {currentDraft.exposure.relevantLaws.map((law, i) => (
                    <p key={i}>{law}</p>
                  ))}
                </div>
              )}

              {currentDraft.exposure.recommendedActions.length > 0 && (
                <div className="border-t border-border/50 pt-2.5 mt-2.5">
                  <p className="text-[10px] text-text-dim font-semibold mb-1.5 uppercase tracking-wide">Recommended Actions</p>
                  <div className="space-y-1">
                    {currentDraft.exposure.recommendedActions.map((action, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Check className="w-3 h-3 text-accent shrink-0 mt-0.5" />
                        <span className="text-xs text-text-primary">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Portfolio Context */}
          {currentDraft.portfolioContext && (
            <div className="lg:col-span-2 bg-atlas-navy-3 border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-text-muted" />
                <h2 className="text-sm font-semibold text-text-primary">Portfolio Context</h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {currentDraft.portfolioContext.tenantMatches.length > 0 && (
                  <div>
                    <span className="text-text-dim">Matched Tenants:</span>
                    {currentDraft.portfolioContext.tenantMatches.slice(0, 3).map((t) => (
                      <p key={t.id} className="text-text-primary">
                        {t.name} (Unit {t.unitNumber})
                        {t.balance > 0 ? ` — $${t.balance.toLocaleString()} bal` : ""}
                        {t.leaseStatus ? ` [${t.leaseStatus}]` : ""}
                      </p>
                    ))}
                  </div>
                )}
                <div>
                  <span className="text-text-dim">Open Violations:</span>
                  <p className={cn("font-medium", currentDraft.portfolioContext.openViolations.length > 0 ? "text-red-400" : "text-text-primary")}>
                    {currentDraft.portfolioContext.openViolations.length} open
                  </p>
                </div>
                <div>
                  <span className="text-text-dim">Recent Work Orders:</span>
                  <p className="text-text-primary">{currentDraft.portfolioContext.recentWorkOrders.length} recent</p>
                </div>
                {currentDraft.portfolioContext.openLegalCases.length > 0 && (
                  <div>
                    <span className="text-text-dim">Open Legal Cases:</span>
                    <p className="text-orange-400 font-medium">{currentDraft.portfolioContext.openLegalCases.length} active</p>
                  </div>
                )}
              </div>
              {currentDraft.portfolioContext.tenantNotes && currentDraft.portfolioContext.tenantNotes.length > 0 && (
                <div className="border-t border-border/50 mt-3 pt-2.5">
                  <p className="text-[10px] text-text-dim font-semibold mb-1.5 uppercase tracking-wide">Recent Tenant Notes</p>
                  <div className="space-y-1">
                    {currentDraft.portfolioContext.tenantNotes.slice(0, 3).map((note) => (
                      <p key={note.id} className="text-[11px] text-text-muted truncate">
                        {note.category && <span className="text-text-dim">[{note.category}] </span>}
                        {note.content}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Suggested Response Email */}
          {currentDraft.suggestedResponseEmail && (
            <div className="lg:col-span-2 bg-atlas-navy-3 border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-text-muted" />
                  <h2 className="text-sm font-semibold text-text-primary">Draft Tenant Response</h2>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`Subject: ${currentDraft.suggestedResponseEmail!.subject}\n\n${currentDraft.suggestedResponseEmail!.body}`);
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" /> Copy to Clipboard
                </Button>
              </div>
              <div className="mb-2">
                <span className="text-xs text-text-dim">Subject:</span>
                <p className="text-sm text-text-primary font-medium">{currentDraft.suggestedResponseEmail.subject}</p>
              </div>
              <textarea
                readOnly
                rows={5}
                value={currentDraft.suggestedResponseEmail.body}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary resize-none"
              />
              <p className="text-[10px] text-text-dim mt-1.5">Review before sending — do not send directly from AtlasPM</p>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="lg:col-span-2 flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Edit Details
            </Button>
            <Button onClick={verifyDraft} disabled={submitting}>
              {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Verifying...</> : <>Mark as Verified <ArrowRight className="w-3.5 h-3.5 ml-1" /></>}
            </Button>
          </div>
        </div>
      )}

      {/* ═══ STEP 4: OUTPUT ═══ */}
      {step === 4 && currentDraft && (
        <div>
          {currentDraft.draft.status === "verified" || step === 4 ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6 flex items-center gap-2">
              <Check className="w-5 h-5 text-green-400" />
              <span className="text-sm text-green-300 font-medium">Draft Verified</span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Download PDF */}
            <div className="bg-atlas-navy-3 border border-border rounded-lg p-6 text-center">
              <Download className="w-8 h-8 text-text-dim mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-text-primary mb-2">Download PDF Package</h3>
              <p className="text-xs text-text-dim mb-4">Full work order package with all details, flags, and history</p>
              <Button variant="outline" onClick={downloadPdf} disabled={pdfLoading}>
                {pdfLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Generating...</> : "Download PDF"}
              </Button>
            </div>

            {/* Promote */}
            <div className="bg-atlas-navy-3 border border-border rounded-lg p-6 text-center">
              <Scale className="w-8 h-8 text-accent mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-text-primary mb-2">Promote to Work Order</h3>
              <p className="text-xs text-text-dim mb-4">Create a live work order from this verified draft</p>
              {promoted ? (
                <div>
                  <p className="text-sm text-green-400 font-medium mb-2">Work Order Created</p>
                  <a href="/maintenance" className="text-xs text-accent hover:underline">Go to Maintenance →</a>
                </div>
              ) : (
                <Button onClick={promoteDraft} disabled={submitting || promoted}>
                  {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Promoting...</> : "Promote to Work Order"}
                </Button>
              )}
            </div>
          </div>

          {/* Read-only summary */}
          <div className="bg-atlas-navy-3 border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Draft Summary</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-text-dim">Title:</span> <span className="text-text-primary">{currentDraft.draft.title}</span></div>
              <div><span className="text-text-dim">Category:</span> <span className="text-text-primary">{currentDraft.draft.category}</span></div>
              <div><span className="text-text-dim">Priority:</span> <span className="text-text-primary">{currentDraft.draft.priority}</span></div>
              <div><span className="text-text-dim">Trade:</span> <span className="text-text-primary">{currentDraft.draft.trade || "N/A"}</span></div>
              <div><span className="text-text-dim">Incident Date:</span> <span className="text-text-primary">{currentDraft.draft.incidentDate ? new Date(currentDraft.draft.incidentDate).toLocaleDateString() : "N/A"}</span></div>
              <div><span className="text-text-dim">Scheduled Date:</span> <span className="text-text-primary">{currentDraft.draft.scheduledDate ? new Date(currentDraft.draft.scheduledDate).toLocaleDateString() : "N/A"}</span></div>
              <div className="col-span-2"><span className="text-text-dim">Description:</span> <p className="text-text-primary mt-1">{currentDraft.draft.description}</p></div>
            </div>
          </div>

          <div className="flex justify-start mt-4">
            <Button variant="outline" onClick={() => { setStep(1); setSelectedIntake(null); setCurrentDraft(null); setPromoted(false); }}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> New Intake
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
