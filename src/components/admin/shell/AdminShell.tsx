import { ReactNode, useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AdminSidebar, { AdminSection } from "./AdminSidebar";
import AdminTopBar from "./AdminTopBar";
import { useAdminRealtime } from "../hooks/useAdminRealtime";
import { useOverviewKpis } from "../hooks/useAdminOverview";

export interface AdminShellProps {
  active: AdminSection;
  onChange: (s: AdminSection) => void;
  children: ReactNode;
}

export default function AdminShell({ active, onChange, children }: AdminShellProps) {
  useAdminRealtime();
  const { data: kpis } = useOverviewKpis();
  const [ready] = useState(true);
  if (!ready) return null;

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSidebar active={active} onChange={onChange} disputeBadge={kpis?.pendingDisputes.count || 0} />
        <SidebarInset className="flex-1 flex flex-col min-w-0">
          <AdminTopBar />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
