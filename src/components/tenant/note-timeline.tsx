"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { useDeleteNote, useUpdateNote } from "@/hooks/use-notes";

const catColors: Record<string, string> = {
  GENERAL: "border-gray-500",
  COLLECTION: "border-blue-500",
  PAYMENT: "border-green-500",
  LEGAL: "border-purple-500",
  LEASE: "border-amber-500",
  MAINTENANCE: "border-orange-500",
};

interface Note {
  id: string;
  text: string;
  category: string;
  createdAt: string;
  author: { name: string };
}

export default function NoteTimeline({ notes, tenantId }: { notes: Note[]; tenantId: string }) {
  const deleteNote = useDeleteNote(tenantId);
  const updateNote = useUpdateNote(tenantId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  function startEdit(note: Note) {
    setEditingId(note.id);
    setEditText(note.text);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  function saveEdit(noteId: string) {
    if (!editText.trim()) return;
    updateNote.mutate(
      { noteId, data: { text: editText.trim() } },
      { onSuccess: () => { setEditingId(null); setEditText(""); } }
    );
  }

  if (notes.length === 0) {
    return <p className="text-text-dim text-sm">No notes yet</p>;
  }

  return (
    <div className="space-y-3">
      {notes.map((n) => (
        <div key={n.id} className={`border-l-2 ${catColors[n.category] || "border-gray-500"} pl-3 py-1`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              {editingId === n.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => saveEdit(n.id)}
                      disabled={updateNote.isPending}
                      className="text-green-400 hover:text-green-300 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={cancelEdit} className="text-text-dim hover:text-text-muted">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-text-primary whitespace-pre-wrap">{n.text}</p>
                  <p className="text-xs text-text-dim mt-1">
                    {n.author.name} &middot; {formatDate(n.createdAt)} &middot;{" "}
                    <span className="capitalize">{n.category.toLowerCase()}</span>
                  </p>
                </>
              )}
            </div>
            {editingId !== n.id && (
              <div className="flex gap-1 shrink-0 mt-0.5">
                <button
                  onClick={() => startEdit(n)}
                  className="text-text-dim hover:text-accent"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deleteNote.mutate(n.id)}
                  className="text-text-dim hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
