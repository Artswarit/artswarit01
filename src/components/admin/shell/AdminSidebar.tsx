import {
  LayoutDashboard, Users, Briefcase, Wallet, Scale,
  Banknote, ImageIcon, CreditCard, LineChart, Settings,
  ChevronLeft,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export type AdminSection =
  | "overview" | "users" | "projects" | "escrow" | "disputes"
  | "withdrawals" | "portfolio" | "payments" | "analytics" | "settings";

export interface AdminSidebarProps {
  active: AdminSection;
  onChange: (s: AdminSection) => void;
  disputeBadge?: number;
}

const ITEMS: { key: AdminSection; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview",    label: "Dashboard",       icon: LayoutDashboard },
  { key: "users",       label: "Users",           icon: Users },
  { key: "projects",    label: "Projects",        icon: Briefcase },
  { key: "escrow",      label: "Escrow",          icon: Wallet },
  { key: "disputes",    label: "Disputes",        icon: Scale },
  { key: "withdrawals", label: "Withdrawals",     icon: Banknote },
  { key: "portfolio",   label: "Portfolio review",icon: ImageIcon },
  { key: "payments",    label: "Payments",        icon: CreditCard },
  { key: "analytics",   label: "Analytics",       icon: LineChart },
  { key: "settings",    label: "Settings",        icon: Settings },
];

export default function AdminSidebar({ active, onChange, disputeBadge = 0 }: AdminSidebarProps) {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="h-16 px-3 flex-row items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 shrink-0" />
        {!collapsed && <span className="font-semibold text-base tracking-tight">Artswarit</span>}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {ITEMS.map((it) => {
                const isActive = active === it.key;
                return (
                  <SidebarMenuItem key={it.key}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => onChange(it.key)}
                      tooltip={collapsed ? it.label : undefined}
                      className={cn(
                        "h-10 rounded-lg font-medium text-sm",
                        isActive
                          ? "bg-primary/10 text-primary hover:bg-primary/15"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <it.icon className="h-4 w-4" />
                      {!collapsed && (
                        <span className="flex-1 flex items-center justify-between">
                          {it.label}
                          {it.key === "disputes" && disputeBadge > 0 && (
                            <span className="h-5 min-w-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center">
                              {disputeBadge}
                            </span>
                          )}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <button
          onClick={toggleSidebar}
          className="w-full h-9 rounded-lg flex items-center gap-2 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
