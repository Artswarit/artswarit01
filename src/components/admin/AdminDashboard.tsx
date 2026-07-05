import { useState } from "react";
import AdminShell from "./shell/AdminShell";
import type { AdminSection } from "./shell/AdminSidebar";
import OverviewSection from "./overview/OverviewSection";

import UserGovernance from "./UserGovernance";
import AdminOperations from "./AdminOperations";
import AdminFinance from "./AdminFinance";
import DisputeSettlement from "./DisputeSettlement";
import ContentModeration from "./ContentModeration";
import AdminRevenue from "./AdminRevenue";
import AdminEngagement from "./AdminEngagement";
import AdminSystem from "./AdminSystem";

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-5">
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </header>
  );
}

function SettingsStub() {
  return (
    <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
      Admin settings will appear here. Manage moderators, feature flags, and platform preferences.
    </div>
  );
}

function AnalyticsSection() {
  return (
    <div className="space-y-6">
      <AdminEngagement />
      <AdminSystem />
    </div>
  );
}

export default function AdminDashboard() {
  const [active, setActive] = useState<AdminSection>("overview");

  const body = (() => {
    switch (active) {
      case "overview":    return <OverviewSection />;
      case "users":       return <><SectionHeader title="Users" subtitle="Governance, roles, and account status." /><UserGovernance /></>;
      case "projects":    return <><SectionHeader title="Projects" subtitle="Live projects and milestone pipeline." /><AdminOperations /></>;
      case "escrow":      return <><SectionHeader title="Escrow" subtitle="Funded, held, and released milestone funds." /><AdminFinance /></>;
      case "disputes":    return <><SectionHeader title="Disputes" subtitle="Open disputes requiring admin review." /><DisputeSettlement /></>;
      case "withdrawals": return <><SectionHeader title="Withdrawals" subtitle="Artist payout requests and history." /><AdminFinance /></>;
      case "portfolio":   return <><SectionHeader title="Portfolio review" subtitle="Artworks awaiting approval and reported content." /><ContentModeration /></>;
      case "payments":    return <><SectionHeader title="Payments" subtitle="Transactions, fees, and failed charges." /><AdminRevenue /></>;
      case "analytics":   return <><SectionHeader title="Analytics" subtitle="Engagement and platform system health." /><AnalyticsSection /></>;
      case "settings":    return <><SectionHeader title="Settings" subtitle="Admin preferences and platform configuration." /><SettingsStub /></>;
    }
  })();

  return (
    <AdminShell active={active} onChange={setActive}>
      {body}
    </AdminShell>
  );
}
