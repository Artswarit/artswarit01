import OverviewKpis from "./OverviewKpis";
import RevenueTrendChart from "./RevenueTrendChart";
import EscrowVolumeChart from "./EscrowVolumeChart";
import UserGrowthChart from "./UserGrowthChart";
import SubscriptionGrowthChart from "./SubscriptionGrowthChart";
import TopCategoriesChart from "./TopCategoriesChart";
import RecentActivityFeed from "./RecentActivityFeed";
import PlatformHealthPanel from "./PlatformHealthPanel";

export default function OverviewSection() {
  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-300">
      <header>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Here's what's happening across Artswarit today.</p>
      </header>

      <OverviewKpis />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="lg:col-span-2"><RevenueTrendChart /></div>
        <EscrowVolumeChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <UserGrowthChart />
        <SubscriptionGrowthChart />
        <TopCategoriesChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <RecentActivityFeed />
        <PlatformHealthPanel />
      </div>
    </div>
  );
}
