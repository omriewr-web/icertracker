"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, Brain, Menu } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useMetrics } from "@/hooks/use-metrics";
import OrgSwitcher from "./org-switcher";

export default function Header() {
  const { data: session } = useSession();
  const { setAiPanelOpen, setSidebarOpen, sidebarOpen } = useAppStore();
  const { data: metrics } = useMetrics();

  return (
    <header role="banner" className="h-[52px] bg-atlas-navy-2 border-b border-border shadow-[0_1px_0_rgba(201,168,76,0.08)] flex items-center justify-between px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          aria-expanded={sidebarOpen}
          className="p-1.5 rounded-lg text-text-dim hover:text-text-primary hover:bg-card-hover transition-colors lg:hidden"
          title="Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-wider text-accent">ATLASPM</h1>
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-[10px] font-medium tracking-[0.2em] text-text-dim uppercase">AtlasPM</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-atlas-green/10 border border-atlas-green/20">
              <span className="w-1.5 h-1.5 rounded-full bg-atlas-green animate-atlas-live-blink" />
              <span className="text-[10px] font-medium tracking-wider text-atlas-green uppercase">ARGUS ACTIVE{metrics?.totalUnits != null ? ` · ${metrics.totalUnits} UNITS` : ""}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <OrgSwitcher />
        <button
          onClick={() => setAiPanelOpen(true)}
          aria-label="Open Atlas AI"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-accent bg-accent/10 hover:bg-accent/20 border border-accent/30 transition-colors"
          title="Atlas AI"
        >
          <Brain className="w-4 h-4" />
          <span className="hidden sm:inline">Atlas AI</span>
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
