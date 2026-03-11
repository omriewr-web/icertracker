"use client";

import { Clock, AlertTriangle } from "lucide-react";

interface Props {
  dueDate: string | null | undefined;
  status: string;
}

export default function DueDateBadge({ dueDate, status }: Props) {
  if (!dueDate || status === "COMPLETED") return null;

  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 whitespace-nowrap">
        <AlertTriangle className="w-3 h-3" /> Overdue
      </span>
    );
  }

  if (diffHours <= 48) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 whitespace-nowrap">
        <Clock className="w-3 h-3" /> Due Soon
      </span>
    );
  }

  return null;
}
