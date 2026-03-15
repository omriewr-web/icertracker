"use client";

import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import CityPulse from "@/components/layout/city-pulse";
import GlobalModals from "@/components/layout/global-modals";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useAppStore } from "@/stores/app-store";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed } = useAppStore();

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            aria-hidden="true"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* Sidebar — hidden on mobile unless open */}
        <div
          className={`fixed inset-y-0 left-0 z-40 ${sidebarCollapsed ? "w-16" : "w-56"} transform transition-all duration-200 ease-in-out lg:relative lg:translate-x-0 lg:z-auto ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar />
        </div>
        <main role="main" className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[34px]">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
      <CityPulse />
      <GlobalModals />
    </div>
  );
}
