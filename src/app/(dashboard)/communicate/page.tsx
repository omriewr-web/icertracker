"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, Send, BarChart3, Megaphone, Mail, Phone } from "lucide-react";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import AIEnhanceButton from "@/components/ui/ai-enhance-button";
import { cn } from "@/lib/utils";

type TriggerType = "DAYS_10" | "DAYS_30" | "DAYS_60" | "MANUAL";
type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";

interface Campaign {
  id: string;
  name: string;
  triggerType: TriggerType;
  status: CampaignStatus;
  createdAt: string;
  _count: { messages: number };
}

const triggerLabels: Record<TriggerType, string> = {
  DAYS_10: "10 Days Past Due",
  DAYS_30: "30 Days Past Due",
  DAYS_60: "60 Days Past Due",
  MANUAL: "Manual",
};

const statusConfig: Record<CampaignStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-white/10 text-text-muted" },
  ACTIVE: { label: "Active", className: "bg-green-500/15 text-green-400" },
  PAUSED: { label: "Paused", className: "bg-amber-500/15 text-amber-400" },
  COMPLETED: { label: "Completed", className: "bg-blue-500/15 text-blue-400" },
};

async function fetchCampaigns(): Promise<Campaign[]> {
  const res = await fetch("/api/communicate/campaigns");
  if (!res.ok) throw new Error("Failed to load campaigns");
  return res.json();
}

export default function CommunicatePage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("DAYS_30");
  const [messageTemplate, setMessageTemplate] = useState("");

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["communicate-campaigns"],
    queryFn: fetchCampaigns,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; triggerType: TriggerType }) => {
      const res = await fetch("/api/communicate/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create campaign");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communicate-campaigns"] });
      setShowForm(false);
      setName("");
      setTriggerType("DAYS_30");
      setMessageTemplate("");
    },
  });

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;
  const totalMessages = campaigns.reduce((sum, c) => sum + c._count.messages, 0);
  const responseRate = 0; // Placeholder — no response tracking yet

  const stats = [
    { label: "Total Campaigns", value: totalCampaigns, icon: Megaphone },
    { label: "Active", value: activeCampaigns, icon: BarChart3 },
    { label: "Messages Sent", value: totalMessages, icon: Send },
    { label: "Response Rate", value: `${responseRate}%`, icon: MessageSquare },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary font-display">
            Atlas Communicate
          </h1>
          <p className="text-sm text-text-muted mt-0.5">Tenant Outreach</p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Campaign
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-atlas-navy-3 border border-border rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <s.icon className="w-4 h-4 text-text-dim" />
              <span className="text-xs text-text-dim">{s.label}</span>
            </div>
            <p className="text-2xl font-display font-bold text-text-primary">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* New Campaign form */}
      {showForm && (
        <div className="bg-atlas-navy-3 border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">
            New Campaign
          </h2>

          <div>
            <label className="block text-xs text-text-muted mb-1">
              Campaign Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 30-Day Past Due Follow-up"
              className="w-full px-3 py-2 text-sm bg-atlas-navy-2 border border-border rounded-lg text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">
              Trigger
            </label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as TriggerType)}
              className="w-full px-3 py-2 text-sm bg-atlas-navy-2 border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
            >
              {(Object.keys(triggerLabels) as TriggerType[]).map((t) => (
                <option key={t} value={t}>
                  {triggerLabels[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">
              Channel
            </label>
            <div className="flex gap-2">
              {[
                { icon: Mail, label: "Email" },
                { icon: Phone, label: "SMS" },
              ].map((ch) => (
                <div key={ch.label} className="relative group">
                  <button
                    disabled
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg text-text-dim cursor-not-allowed opacity-50"
                  >
                    <ch.icon className="w-3.5 h-3.5" />
                    {ch.label}
                  </button>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-[10px] bg-atlas-navy-1 border border-border rounded text-text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Coming soon
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-text-muted">
                Message Template
              </label>
              <AIEnhanceButton
                value={messageTemplate}
                context="collection_note"
                onEnhanced={(enhanced) => setMessageTemplate(enhanced)}
                className="scale-90"
              />
            </div>
            <textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={3}
              placeholder="Draft your outreach message..."
              className="w-full px-3 py-2 text-sm bg-atlas-navy-2 border border-border rounded-lg text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ name: name.trim(), triggerType })}
            >
              {createMutation.isPending ? "Saving..." : "Save as Draft"}
            </Button>
          </div>
        </div>
      )}

      {/* Campaign table or empty state */}
      {isLoading ? (
        <div className="text-center py-12 text-text-dim text-sm">
          Loading campaigns...
        </div>
      ) : campaigns.length === 0 && !showForm ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create your first outreach campaign to start communicating with tenants."
        />
      ) : campaigns.length > 0 ? (
        <div className="bg-atlas-navy-3 border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-text-dim">Name</th>
                <th className="px-4 py-3 text-xs font-medium text-text-dim">Trigger</th>
                <th className="px-4 py-3 text-xs font-medium text-text-dim">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-text-dim">Messages</th>
                <th className="px-4 py-3 text-xs font-medium text-text-dim">Created</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, idx) => {
                const sc = statusConfig[c.status];
                return (
                  <tr
                    key={c.id}
                    className={cn(
                      "border-b border-border last:border-0",
                      idx % 2 === 1 && "bg-white/[0.02]"
                    )}
                  >
                    <td className="px-4 py-3 text-text-primary font-medium">
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {triggerLabels[c.triggerType]}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-block px-2 py-0.5 rounded text-xs font-medium",
                          sc.className
                        )}
                      >
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {c._count.messages}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
