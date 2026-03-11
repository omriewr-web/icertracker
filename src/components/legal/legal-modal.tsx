"use client";

import { useState, useEffect, useRef } from "react";
import { History, ChevronDown } from "lucide-react";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";
import {
  useLegalCase,
  useUpsertLegalCase,
  useCreateLegalNote,
  useLegalCaseHistory,
  useLegalVendors,
  useLegalUsers,
  type LegalNoteView,
  type LegalCaseHistoryItem,
} from "@/hooks/use-legal";
import StagePipeline from "./stage-pipeline";
import { formatDate, fmt$ } from "@/lib/utils";
import LoadingSpinner from "@/components/ui/loading-spinner";

interface Props {
  tenantId: string | null;
  tenantName: string;
  buildingId?: string | null;
  onClose: () => void;
}

const STATUS_OPTIONS = ["active", "settled", "dismissed", "withdrawn"] as const;

export default function LegalModal({ tenantId, tenantName, buildingId, onClose }: Props) {
  const { data: legalCase, isLoading } = useLegalCase(tenantId);
  const upsertCase = useUpsertLegalCase(tenantId || "");
  const createNote = useCreateLegalNote(tenantId || "");
  const { data: historyData } = useLegalCaseHistory(tenantId);
  const { data: attorneyData } = useLegalVendors("attorney");
  const { data: marshalData } = useLegalVendors("marshal");
  const { data: usersData } = useLegalUsers(buildingId ?? null);

  const [stage, setStage] = useState("NOTICE_SENT");
  const [caseNumber, setCaseNumber] = useState("");
  const [attorney, setAttorney] = useState("");
  const [attorneyId, setAttorneyId] = useState<string | null>(null);
  const [filedDate, setFiledDate] = useState("");
  const [courtDate, setCourtDate] = useState("");
  const [arrearsBalance, setArrearsBalance] = useState("");
  const [status, setStatus] = useState("active");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [marshalId, setMarshalId] = useState<string | null>(null);
  const [marshalScheduledDate, setMarshalScheduledDate] = useState("");
  const [marshalExecutedDate, setMarshalExecutedDate] = useState("");
  const [noteText, setNoteText] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showAttorneyDropdown, setShowAttorneyDropdown] = useState(false);
  const [showMarshalDropdown, setShowMarshalDropdown] = useState(false);
  const [attorneySearch, setAttorneySearch] = useState("");
  const [marshalSearch, setMarshalSearch] = useState("");
  const attorneyRef = useRef<HTMLDivElement>(null);
  const marshalRef = useRef<HTMLDivElement>(null);

  const attorneys = attorneyData?.vendors ?? [];
  const marshals = marshalData?.vendors ?? [];
  const history = historyData?.cases ?? [];
  const users = usersData?.users ?? [];
  const showMarshalSection = stage === "WARRANT" || stage === "EVICTION";

  useEffect(() => {
    if (legalCase) {
      setStage(legalCase.stage || "NOTICE_SENT");
      setCaseNumber(legalCase.caseNumber || "");
      setAttorney(legalCase.attorney || "");
      setAttorneyId(legalCase.attorneyId || null);
      setFiledDate(legalCase.filedDate ? new Date(legalCase.filedDate).toISOString().split("T")[0] : "");
      setCourtDate(legalCase.courtDate ? new Date(legalCase.courtDate).toISOString().split("T")[0] : "");
      setArrearsBalance(legalCase.arrearsBalance != null ? String(legalCase.arrearsBalance) : "");
      setStatus(legalCase.status || "active");
      setAssignedUserId(legalCase.assignedUserId || "");
      setMarshalId(legalCase.marshalId || null);
      setMarshalScheduledDate(legalCase.marshalScheduledDate ? new Date(legalCase.marshalScheduledDate).toISOString().split("T")[0] : "");
      setMarshalExecutedDate(legalCase.marshalExecutedDate ? new Date(legalCase.marshalExecutedDate).toISOString().split("T")[0] : "");

      // Set display text for attorney
      if (legalCase.attorneyContact) {
        setAttorneySearch(
          legalCase.attorneyContact.company
            ? `${legalCase.attorneyContact.name} — ${legalCase.attorneyContact.company}`
            : legalCase.attorneyContact.name
        );
      } else {
        setAttorneySearch(legalCase.attorney || "");
      }

      // Set display text for marshal
      if (legalCase.marshalContact) {
        setMarshalSearch(
          legalCase.marshalContact.company
            ? `${legalCase.marshalContact.name} — ${legalCase.marshalContact.company}`
            : legalCase.marshalContact.name
        );
      } else {
        setMarshalSearch("");
      }
    }
  }, [legalCase]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (attorneyRef.current && !attorneyRef.current.contains(e.target as Node)) setShowAttorneyDropdown(false);
      if (marshalRef.current && !marshalRef.current.contains(e.target as Node)) setShowMarshalDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSave() {
    const balNum = arrearsBalance ? parseFloat(arrearsBalance) : null;
    upsertCase.mutate({
      inLegal: true,
      stage,
      caseNumber: caseNumber || null,
      attorney: attorneyId ? null : (attorney || null),
      attorneyId: attorneyId || null,
      filedDate: filedDate || null,
      courtDate: courtDate || null,
      arrearsBalance: balNum != null && !isNaN(balNum) ? balNum : null,
      status,
      assignedUserId: assignedUserId || null,
      marshalId: marshalId || null,
      marshalScheduledDate: marshalScheduledDate || null,
      marshalExecutedDate: marshalExecutedDate || null,
    });
  }

  function handleAddNote() {
    if (!noteText.trim()) return;
    createNote.mutate({ text: noteText.trim(), stage }, { onSuccess: () => setNoteText("") });
  }

  function selectAttorney(v: { id: string; name: string; company: string | null }) {
    setAttorneyId(v.id);
    setAttorney("");
    setAttorneySearch(v.company ? `${v.name} — ${v.company}` : v.name);
    setShowAttorneyDropdown(false);
  }

  function handleAttorneyType(val: string) {
    setAttorneySearch(val);
    setAttorneyId(null);
    setAttorney(val);
    setShowAttorneyDropdown(true);
  }

  function selectMarshal(v: { id: string; name: string; company: string | null }) {
    setMarshalId(v.id);
    setMarshalSearch(v.company ? `${v.name} — ${v.company}` : v.name);
    setShowMarshalDropdown(false);
  }

  function handleMarshalType(val: string) {
    setMarshalSearch(val);
    setMarshalId(null);
    setShowMarshalDropdown(true);
  }

  const filteredAttorneys = attorneys.filter((a) =>
    !attorneySearch || a.name.toLowerCase().includes(attorneySearch.toLowerCase()) ||
    (a.company && a.company.toLowerCase().includes(attorneySearch.toLowerCase()))
  );

  const filteredMarshals = marshals.filter((m) =>
    !marshalSearch || m.name.toLowerCase().includes(marshalSearch.toLowerCase()) ||
    (m.company && m.company.toLowerCase().includes(marshalSearch.toLowerCase()))
  );

  const selectedAttorneyVendor = attorneyId ? attorneys.find((a) => a.id === attorneyId) || legalCase?.attorneyContact : null;
  const selectedMarshalVendor = marshalId ? marshals.find((m) => m.id === marshalId) || legalCase?.marshalContact : null;

  if (!tenantId) return null;

  return (
    <Modal open={!!tenantId} onClose={onClose} title={`Legal — ${tenantName}`} wide>
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-5">
          <StagePipeline currentStage={stage} onSelect={setStage} />

          {/* Row 1: Case Number, Filed Date, Court Date */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-text-dim mb-1">Case Number</label>
              <input
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1">Filed Date</label>
              <input
                type="date"
                value={filedDate}
                onChange={(e) => setFiledDate(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1">Court Date</label>
              <input
                type="date"
                value={courtDate}
                onChange={(e) => setCourtDate(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Row 2: Attorney (combobox), Arrears Balance, Status */}
          <div className="grid grid-cols-3 gap-3">
            <div ref={attorneyRef} className="relative">
              <label className="block text-xs text-text-dim mb-1">Attorney</label>
              <div className="relative">
                <input
                  value={attorneySearch}
                  onChange={(e) => handleAttorneyType(e.target.value)}
                  onFocus={() => setShowAttorneyDropdown(true)}
                  placeholder="Search or type..."
                  className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent pr-7"
                />
                <ChevronDown className="absolute right-2 top-2 w-3.5 h-3.5 text-text-dim pointer-events-none" />
              </div>
              {showAttorneyDropdown && filteredAttorneys.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {filteredAttorneys.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => selectAttorney(a)}
                      className="w-full text-left px-3 py-1.5 text-xs text-text-primary hover:bg-card-hover"
                    >
                      {a.name}{a.company ? ` — ${a.company}` : ""}
                    </button>
                  ))}
                </div>
              )}
              {selectedAttorneyVendor && (
                <div className="mt-1 text-[10px] text-text-dim space-y-0.5">
                  {selectedAttorneyVendor.phone && <p>Phone: {selectedAttorneyVendor.phone}</p>}
                  {selectedAttorneyVendor.email && <p>Email: {selectedAttorneyVendor.email}</p>}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1">Arrears Balance ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={arrearsBalance}
                onChange={(e) => setArrearsBalance(e.target.value)}
                placeholder="0.00"
                className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1">Case Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Assigned User */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-text-dim mb-1">Assigned To</label>
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Marshal Info — only for WARRANT/EVICTION stages */}
          {showMarshalSection && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 space-y-3">
              <h4 className="text-xs font-medium text-purple-400 uppercase">Marshal Info</h4>
              <div className="grid grid-cols-3 gap-3">
                <div ref={marshalRef} className="relative">
                  <label className="block text-xs text-text-dim mb-1">Marshal</label>
                  <div className="relative">
                    <input
                      value={marshalSearch}
                      onChange={(e) => handleMarshalType(e.target.value)}
                      onFocus={() => setShowMarshalDropdown(true)}
                      placeholder="Search marshals..."
                      className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent pr-7"
                    />
                    <ChevronDown className="absolute right-2 top-2 w-3.5 h-3.5 text-text-dim pointer-events-none" />
                  </div>
                  {showMarshalDropdown && filteredMarshals.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {filteredMarshals.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => selectMarshal(m)}
                          className="w-full text-left px-3 py-1.5 text-xs text-text-primary hover:bg-card-hover"
                        >
                          {m.name}{m.company ? ` — ${m.company}` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedMarshalVendor && selectedMarshalVendor.phone && (
                    <p className="mt-1 text-[10px] text-text-dim">Phone: {selectedMarshalVendor.phone}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-text-dim mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    value={marshalScheduledDate}
                    onChange={(e) => setMarshalScheduledDate(e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-dim mb-1">Executed Date</label>
                  <input
                    type="date"
                    value={marshalExecutedDate}
                    onChange={(e) => setMarshalExecutedDate(e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={upsertCase.isPending}>
              {upsertCase.isPending ? "Saving..." : "Save Case"}
            </Button>
            {history.length > 1 && (
              <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
                <History className="w-3.5 h-3.5 mr-1" />
                Case History ({history.length})
              </Button>
            )}
          </div>

          {/* Case History Panel */}
          {showHistory && history.length > 0 && (
            <div className="bg-bg border border-border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
              <h4 className="text-xs font-medium text-text-dim uppercase mb-2">Case History</h4>
              {history.map((h: LegalCaseHistoryItem) => (
                <div
                  key={h.id}
                  className={`border-l-2 pl-3 py-1.5 ${h.isActive ? "border-accent" : "border-border"}`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`font-medium ${h.isActive ? "text-accent" : "text-text-muted"}`}>
                      {h.stage.replace(/_/g, " ")}
                    </span>
                    {h.caseNumber && <span className="text-text-dim">#{h.caseNumber}</span>}
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      h.isActive ? "bg-accent/20 text-accent" : "bg-border/50 text-text-dim"
                    }`}>
                      {h.isActive ? "Active" : h.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-dim mt-0.5 flex gap-3">
                    {h.filedDate && <span>Filed: {formatDate(h.filedDate)}</span>}
                    {h.arrearsBalance != null && <span>Balance: {fmt$(Number(h.arrearsBalance))}</span>}
                    <span>Created: {formatDate(h.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes Section */}
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-medium text-text-muted mb-3">Legal Notes</h4>
            <div className="space-y-2 mb-3">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a legal note..."
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
                rows={2}
              />
              <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim() || createNote.isPending}>
                Add Note
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(legalCase?.notes || []).map((n: LegalNoteView) => (
                <div
                  key={n.id}
                  className={`border-l-2 pl-3 py-1 ${n.isSystem ? "border-border bg-bg/50" : "border-purple-500"}`}
                >
                  <p className={`text-sm ${n.isSystem ? "text-text-dim italic" : "text-text-primary"}`}>
                    {n.text}
                  </p>
                  <p className="text-xs text-text-dim mt-0.5">
                    {n.isSystem ? "System" : n.author?.name} &middot; {formatDate(n.createdAt)} &middot;{" "}
                    {n.stage?.replace(/_/g, " ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
