"use client";
import CommsLayout from "@/components/comms/CommsLayout";
export default function CommsWorkOrdersPage() {
  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-xl font-bold text-text-primary font-display tracking-wide">Work Order Threads</h1>
      </div>
      <div className="flex-1 overflow-hidden"><CommsLayout initialFilter="work_order" /></div>
    </div>
  );
}
