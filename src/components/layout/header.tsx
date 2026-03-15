"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, Building2, Brain, Menu } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import OrgSwitcher from "./org-switcher";

export default function Header() {
  const { data: session } = useSession();
  const { setAiPanelOpen, setSidebarOpen, sidebarOpen } = useAppStore();

  return (
    <header role="banner" className="h-14 bg-card-gradient border-b border-border shadow-[0_1px_0_rgba(201,168,76,0.1)] flex items-center justify-between px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          aria-expanded={sidebarOpen}
          className="p-1.5 rounded-lg text-text-dim hover:text-text-primary hover:bg-card-hover transition-colors lg:hidden"
          title="Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Building2 className="w-5 h-5 text-accent" />
        <h1 className="text-lg font-bold text-text-primary">AtlasPM</h1>
        <span className="text-xs text-text-dim hidden sm:inline">Property Management</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <OrgSwitcher />
        <button
          onClick={() => setAiPanelOpen(true)}
          aria-label="Open Bella"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-accent bg-accent/10 hover:bg-accent/20 border border-accent/30 transition-colors"
          title="Bella"
        >
          <Brain className="w-4 h-4" />
          <span className="hidden sm:inline">Bella</span>
        </button>
        <span className="text-sm text-text-muted hidden sm:inline">
          {session?.user?.name}{" "}
          <span className="text-xs text-text-dim">({session?.user?.role})</span>
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Sign out"
          className="text-text-dim hover:text-text-muted transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
