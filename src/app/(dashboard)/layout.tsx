import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import GlobalModals from "@/components/layout/global-modals";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <GlobalModals />
    </div>
  );
}
