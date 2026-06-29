import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useArtistPlan } from "@/hooks/useArtistPlan";
import { useAdvancedAnalytics } from "@/hooks/useAdvancedAnalytics";
import LockedFeature from "@/components/premium/LockedFeature";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Eye, Heart, UserPlus, Briefcase, Image as ImageIcon } from "lucide-react";

const STAT_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  artist_profile_viewed: { label: "Profile views", icon: Eye },
  artwork_viewed: { label: "Artwork views", icon: ImageIcon },
  artwork_liked: { label: "Likes", icon: Heart },
  artist_followed: { label: "New followers", icon: UserPlus },
  commission_requested: { label: "Commission requests", icon: Briefcase },
};

const AdvancedAnalytics: React.FC = () => {
  const { user } = useAuth();
  const { isProArtist, loading: planLoading } = useArtistPlan(user?.id) as any;
  const { data, loading, error } = useAdvancedAnalytics(
    user?.id,
    Boolean(user?.id) && isProArtist,
    30,
  );

  const content = (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Advanced analytics
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Profile traffic, engagement, and discovery sources from the last 30 days.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Object.entries(STAT_META).map(([key, meta]) => {
          const Icon = meta.icon;
          const value = data?.totals?.[key] ?? 0;
          return (
            <Card key={key} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="truncate">{meta.label}</span>
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                  {loading ? <Skeleton className="h-7 w-16" /> : value.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Profile views — 30 days</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : !data?.trend?.length ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              No views recorded yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend}>
                <defs>
                  <linearGradient id="aaViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#aaViews)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Top discovery sources</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : !data?.sources?.length ? (
            <p className="text-sm text-muted-foreground">No source data yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {data.sources.map((s) => (
                <li key={s.source} className="flex items-center justify-between py-3">
                  <span className="text-sm capitalize">{s.source}</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {s.count.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {error && (
        <p className="text-xs text-destructive">
          Couldn't refresh analytics: {error}
        </p>
      )}
    </div>
  );

  return (
    <LockedFeature
      isLocked={!planLoading && !isProArtist}
      title="Pro analytics"
      description="Track profile views, engagement, and discovery sources in real time. Available on the Premium Artist plan."
    >
      {content}
    </LockedFeature>
  );
};

export default AdvancedAnalytics;
