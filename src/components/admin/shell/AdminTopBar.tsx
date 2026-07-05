import { Search, Bell, Crosshair, Plus } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePlatformHealth } from "../hooks/useAdminOverview";
import { cn } from "@/lib/utils";

export default function AdminTopBar() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { data: health } = usePlatformHealth();

  const allOk = (health || []).every((h) => h.status === "operational");
  const anyDown = (health || []).some((h) => h.status === "down");
  const label = anyDown ? "Incident detected" : allOk ? "All systems normal" : "Partial degradation";
  const dot = anyDown ? "bg-rose-500" : allOk ? "bg-emerald-500" : "bg-amber-500";

  const initials = (profile?.full_name || user?.email || "A")
    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <header className="h-16 border-b bg-background/85 backdrop-blur-md sticky top-0 z-30 flex items-center gap-3 px-4">
      <SidebarTrigger className="md:hidden" />

      <div className="flex-1 max-w-xl relative hidden sm:block">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search users, projects, transactions…"
          className="w-full h-10 pl-9 pr-16 rounded-full bg-muted/60 border border-transparent focus:border-border focus:bg-background text-sm outline-none transition"
        />
        <kbd className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 h-5 items-center px-1.5 rounded border bg-background text-[10px] font-mono text-muted-foreground">⌘K</kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden md:flex items-center gap-2 h-9 pl-2.5 pr-3 rounded-full bg-muted/60">
          <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <button className="h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Focus">
          <Crosshair className="h-4 w-4" />
        </button>
        <button className="h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
        </button>
        <button className="h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="New">
          <Plus className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 pl-2 border-l h-9">
          <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
            {initials}
          </div>
          <div className="hidden sm:block leading-tight">
            <div className="text-xs font-semibold">{profile?.full_name || "Admin"}</div>
            <div className="text-[10px] text-muted-foreground">Super Admin</div>
          </div>
        </div>
      </div>
    </header>
  );
}
