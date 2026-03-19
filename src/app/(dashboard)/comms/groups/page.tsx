"use client";
import CommsLayout from "@/components/comms/CommsLayout";
export default function CommsGroupsPage() {
  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-xl font-bold text-text-primary font-display tracking-wide">Group Chats</h1>
      </div>
      <div className="flex-1 overflow-hidden"><CommsLayout initialFilter="group" /></div>
    </div>
  );
}
