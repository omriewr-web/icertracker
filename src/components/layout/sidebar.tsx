"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  AlertTriangle,
  Scale,
  DoorOpen,
  FileText,
  CalendarClock,
  BarChart3,
  Database,
  Users,
  Wrench,
  Shield,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Radio,
  Building2,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission, UserRole } from "@/types";
import PropertySelector from "./property-selector";
import { useAppStore } from "@/stores/app-store";

type Section = "INTELLIGENCE" | "FINANCIAL" | "OPERATIONS" | "LEGAL" | "SETTINGS";

const navItems: { href: string; label: string; icon: typeof LayoutDashboard; perm: string; section: Section }[] = [
  { href: "/", label: "Command Center", icon: LayoutDashboard, perm: "dash", section: "INTELLIGENCE" },
  { href: "/owner-dashboard", label: "Owner View", icon: Building2, perm: "owner", section: "INTELLIGENCE" },
  { href: "/coeus", label: "Coeus", icon: Radio, perm: "dash", section: "INTELLIGENCE" },
  { href: "/daily", label: "Daily Briefing", icon: CalendarClock, perm: "dash", section: "INTELLIGENCE" },
  { href: "/alerts", label: "Arrears Alerts", icon: AlertTriangle, perm: "fin", section: "FINANCIAL" },
  { href: "/collections", label: "Collections", icon: DollarSign, perm: "collections", section: "FINANCIAL" },
  { href: "/vacancies", label: "Vacancies", icon: DoorOpen, perm: "vac", section: "OPERATIONS" },
  { href: "/turnovers", label: "Turnovers", icon: ClipboardList, perm: "vac", section: "OPERATIONS" },
  { href: "/leases", label: "Leases", icon: FileText, perm: "lease", section: "OPERATIONS" },
  { href: "/maintenance", label: "Work Orders", icon: Wrench, perm: "maintenance", section: "OPERATIONS" },
  { href: "/themis", label: "Themis", icon: Scale, perm: "maintenance", section: "OPERATIONS" },
  { href: "/utilities", label: "Utilities", icon: Gauge, perm: "utilities", section: "OPERATIONS" },
  { href: "/compliance", label: "Compliance", icon: Shield, perm: "compliance", section: "OPERATIONS" },
  { href: "/legal", label: "Legal Cases", icon: Scale, perm: "legal", section: "LEGAL" },
  { href: "/reports", label: "Reports", icon: BarChart3, perm: "reports", section: "SETTINGS" },
  { href: "/data", label: "Data Management", icon: Database, perm: "upload", section: "SETTINGS" },
  { href: "/users", label: "Users", icon: Users, perm: "users", section: "SETTINGS" },
];

const sectionLabels: Record<Section, string> = {
  INTELLIGENCE: "Intelligence",
  FINANCIAL: "Financial",
  OPERATIONS: "Operations",
  LEGAL: "Legal",
  SETTINGS: "Settings",
};

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user?.role || "COLLECTOR") as UserRole;
  const { setSidebarOpen, sidebarCollapsed, toggleSidebarCollapsed } = useAppStore();

  const filteredItems = navItems.filter((item) => hasPermission(role, item.perm));

  // Group by section
  const sections: { section: Section; items: typeof filteredItems }[] = [];
  let currentSection: Section | null = null;
  for (const item of filteredItems) {
    if (item.section !== currentSection) {
      currentSection = item.section;
      sections.push({ section: currentSection, items: [] });
    }
    sections[sections.length - 1].items.push(item);
  }

  const userInitial = session?.user?.name?.[0]?.toUpperCase() || "U";

  return (
    <aside
      className={cn(
        "h-full bg-atlas-navy-2 border-r border-border flex flex-col shrink-0 transition-all duration-200",
        sidebarCollapsed ? "w-16" : "w-56"
      )}
    >
      <div className="p-3 border-b border-border overflow-hidden">
        {sidebarCollapsed ? (
          <div className="flex justify-center py-1">
            <img
              src="/images/atlaspm-logo.jpg"
              alt="AtlasPM"
              className="rounded"
              style={{ height: '36px', width: '36px', objectFit: 'cover', objectPosition: 'center' }}
            />
          </div>
        ) : (
          <>
            <div className="flex justify-center items-center py-3 mb-2">
              <img
                src="/images/atlaspm-logo.jpg"
                alt="AtlasPM"
                className="rounded-lg"
                style={{ height: '80px', width: 'auto', maxWidth: '140px', objectFit: 'contain' }}
              />
            </div>
            <PropertySelector />
          </>
        )}
      </div>

      <nav className="flex-1 py-2 overflow-y-auto" aria-label="Main navigation">
        {sections.map(({ section, items }) => (
          <div key={section}>
            {!sidebarCollapsed && (
              <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.15em] text-text-dim font-medium">
                {sectionLabels[section]}
              </p>
            )}
            {sidebarCollapsed && <div className="pt-2" />}
            {items.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  title={sidebarCollapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 text-sm transition-all",
                    sidebarCollapsed ? "justify-center px-2 py-2.5" : "px-4 py-2",
                    active
                      ? "text-accent bg-accent/10 nav-active-glow"
                      : "text-text-muted hover:text-text-primary hover:bg-card-hover"
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-2">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-semibold text-accent">
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-text-primary truncate">{session?.user?.name}</p>
              <p className="text-[10px] text-text-dim">{session?.user?.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={toggleSidebarCollapsed}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden lg:flex items-center justify-center w-full py-1.5 text-text-dim hover:text-text-muted hover:bg-card-hover rounded-lg transition-colors"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
