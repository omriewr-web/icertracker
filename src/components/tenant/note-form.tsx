"use client";

import { useState } from "react";
import Button from "@/components/ui/button";
import { useCreateNote } from "@/hooks/use-notes";
import AIEnhanceButton from "@/components/ui/ai-enhance-button";

const CATEGORIES = ["GENERAL", "COLLECTION", "PAYMENT", "LEGAL", "LEASE", "MAINTENANCE"] as const;
const catColors: Record<string, string> = {
  GENERAL: "text-gray-400 border-gray-500/30",
  COLLECTION: "text-blue-400 border-blue-500/30",
  PAYMENT: "text-green-400 border-green-500/30",
  LEGAL: "text-purple-400 border-purple-500/30",
  LEASE: "text-amber-400 border-amber-500/30",
  MAINTENANCE: "text-orange-400 border-orange-500/30",
};

export default function NoteForm({ tenantId }: { tenantId: string }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string>("GENERAL");
  const createNote = useCreateNote(tenantId);

  function handleSubmit() {
    if (!text.trim()) return;
    createNote.mutate({ text: text.trim(), category }, { onSuccess: () => setText("") });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
              category === c ? catColors[c] + " bg-white/5" : "text-text-dim border-border"
            }`}
          >
            {c.charAt(0) + c.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a note..."
        className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
        rows={3}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={!text.trim() || createNote.isPending}>
          {createNote.isPending ? "Adding..." : "Add Note"}
        </Button>
        <AIEnhanceButton value={text} context="tenant_note" onEnhanced={(v) => setText(v)} />
      </div>
    </div>
  );
}
