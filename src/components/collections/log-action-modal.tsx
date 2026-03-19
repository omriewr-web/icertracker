"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";
import { useLogCollectionAction } from "@/hooks/use-collections";

const ACTION_TYPES = [
  { value: "call", label: "Phone Call" },
  { value: "text", label: "Text Message" },
  { value: "email", label: "Email" },
  { value: "notice_14day", label: "14-Day Rent Demand Notice" },
  { value: "payment_plan", label: "Payment Plan" },
  { value: "legal_referral", label: "Legal Referral" },
  { value: "in_person", label: "In-Person Visit" },
  { value: "other", label: "Other" },
] as const;

const OUTCOME_MAP: Record<string, { value: string; label: string }[]> = {
  call: [
    { value: "reached", label: "Reached Tenant" },
    { value: "no_answer", label: "No Answer" },
    { value: "left_voicemail", label: "Left Voicemail" },
    { value: "promised_payment", label: "Promised Payment" },
    { value: "disputed", label: "Tenant Disputed" },
  ],
  text: [
    { value: "sent", label: "Sent" },
    { value: "replied", label: "Tenant Replied" },
    { value: "promised_payment", label: "Promised Payment" },
  ],
  email: [
    { value: "sent", label: "Sent" },
    { value: "replied", label: "Tenant Replied" },
    { value: "bounced", label: "Bounced" },
    { value: "promised_payment", label: "Promised Payment" },
  ],
  notice_14day: [
    { value: "served", label: "Notice Served" },
    { value: "posted", label: "Posted on Door" },
    { value: "mailed", label: "Mailed (Certified)" },
  ],
  payment_plan: [
    { value: "payment_plan", label: "Plan Agreed" },
    { value: "partial_payment", label: "Partial Payment Received" },
    { value: "payment_received", label: "Full Payment Received" },
  ],
  legal_referral: [
    { value: "attorney_notified", label: "Attorney Notified" },
    { value: "filed", label: "Filed with Court" },
  ],
  in_person: [
    { value: "met_tenant", label: "Met Tenant" },
    { value: "no_answer", label: "No Answer" },
    { value: "promised_payment", label: "Promised Payment" },
  ],
  other: [
    { value: "other", label: "Other" },
  ],
};

const NOTES_REQUIRED = new Set(["legal_referral", "in_person"]);

interface LogActionModalProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
}

export default function LogActionModal({
  open,
  onClose,
  tenantId,
  tenantName,
}: LogActionModalProps) {
  const logAction = useLogCollectionAction();

  const [actionType, setActionType] = useState("call");
  const [actionDate, setActionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [outcome, setOutcome] = useState("reached");
  const [notes, setNotes] = useState("");
  const [promisedPaymentDate, setPromisedPaymentDate] = useState("");
  const [promisedPaymentAmount, setPromisedPaymentAmount] = useState("");

  const outcomes = OUTCOME_MAP[actionType] ?? OUTCOME_MAP.other;
  const requiresNotes = NOTES_REQUIRED.has(actionType);
  const showPromiseFields = outcome === "promised_payment";

  function handleActionTypeChange(val: string) {
    setActionType(val);
    const newOutcomes = OUTCOME_MAP[val] ?? OUTCOME_MAP.other;
    setOutcome(newOutcomes[0]?.value ?? "other");
  }

  function handleSubmit() {
    if (requiresNotes && !notes.trim()) return;

    logAction.mutate(
      {
        tenantId,
        data: {
          actionType,
          actionDate,
          outcome,
          notes: notes.trim() || undefined,
          promisedPaymentDate: showPromiseFields && promisedPaymentDate
            ? promisedPaymentDate
            : undefined,
          promisedPaymentAmount: showPromiseFields && promisedPaymentAmount
            ? parseFloat(promisedPaymentAmount)
            : undefined,
        },
      },
      {
        onSuccess: () => {
          setActionType("call");
          setActionDate(new Date().toISOString().split("T")[0]);
          setOutcome("reached");
          setNotes("");
          setPromisedPaymentDate("");
          setPromisedPaymentAmount("");
          onClose();
        },
      }
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Log Action — ${tenantName}`}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-text-dim uppercase tracking-wider">
              Action Type
            </label>
            <select
              value={actionType}
              onChange={(e) => handleActionTypeChange(e.target.value)}
              className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {ACTION_TYPES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-text-dim uppercase tracking-wider">
              Date
            </label>
            <input
              type="date"
              value={actionDate}
              onChange={(e) => setActionDate(e.target.value)}
              className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-text-dim uppercase tracking-wider">
            Outcome
          </label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            {outcomes.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-text-dim uppercase tracking-wider">
            Notes{requiresNotes ? " (required)" : ""}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe the action taken..."
            rows={3}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent resize-none"
          />
        </div>

        {showPromiseFields && (
          <div className="grid grid-cols-2 gap-3 bg-accent/5 border border-accent/20 rounded-lg p-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-text-dim uppercase tracking-wider">
                Promised Payment Date
              </label>
              <input
                type="date"
                value={promisedPaymentDate}
                onChange={(e) => setPromisedPaymentDate(e.target.value)}
                className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-text-dim uppercase tracking-wider">
                Promised Amount ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={promisedPaymentAmount}
                onChange={(e) => setPromisedPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              logAction.isPending ||
              (requiresNotes && !notes.trim())
            }
          >
            {logAction.isPending ? "Saving..." : "Log Action"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
