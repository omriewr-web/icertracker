"use client";

import CommsLayout from "@/components/comms/CommsLayout";

export default function CommsPage() {
  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-xl font-bold text-text-primary font-display tracking-wide">
          Communications
        </h1>
        <span className="text-[10px] text-text-dim tracking-[0.2em] uppercase">
          Internal team messaging
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <CommsLayout />
      </div>
    </div>
  );
}
