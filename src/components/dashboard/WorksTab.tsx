import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Palette, Briefcase, Crown, Infinity as InfinityIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGating } from '@/hooks/useFeatureGating';
import { SectionHeading } from '@/components/dashboard/ui/SectionHeading';
import ArtworkManagement from '@/components/dashboard/ArtworkManagement';
import ServicesManagement from '@/components/dashboard/services/ServicesManagement';

interface WorksTabProps {
  /** Navigate to another top-level dashboard tab (used by the upgrade CTA). */
  onNavigate: (tab: string) => void;
}

interface CapacityMeterProps {
  label: string;
  used: number;
  limit: number;
  unlimited: boolean;
}

/**
 * Plan capacity for one work type. Starter artists get a real bar so they can
 * see how close they are to the limit before hitting the upload wall; Pro
 * artists just get a quiet "Unlimited" marker.
 */
const CapacityMeter = ({ label, used, limit, unlimited }: CapacityMeterProps) => {
  const pct = unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const nearLimit = !unlimited && pct >= 80;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-token-xs">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        {unlimited ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-success">
            <InfinityIcon className="h-3.5 w-3.5" />
            Unlimited
          </span>
        ) : (
          <span
            className={cn(
              'text-[11px] font-semibold tabular-nums',
              nearLimit ? 'text-warning' : 'text-muted-foreground',
            )}
          >
            {used} / {limit}
          </span>
        )}
      </div>
      {!unlimited && (
        <Progress
          value={pct}
          aria-label={`${label}: ${used} of ${limit} used`}
          className={cn('mt-3 h-1.5 rounded-full bg-muted/40', nearLimit && '[&>div]:bg-warning')}
        />
      )}
    </div>
  );
};

/**
 * "My Works" tab — the artist's sellable inventory.
 *
 * Groups the two things clients can actually buy (portfolio artworks and
 * hireable services) behind one heading, with plan capacity surfaced up front
 * instead of only appearing as an error once the limit is already hit.
 */
const WorksTab = ({ onNavigate }: WorksTabProps) => {
  const { user } = useAuth();
  const {
    portfolioCount,
    portfolioLimit,
    serviceCount,
    serviceLimit,
    isProArtist,
    showUpgradePrompt,
    loading,
  } = useFeatureGating(user?.id);

  return (
    <div className="space-y-6 sm:space-y-8">
      <SectionHeading
        title="My Works"
        description="Your public portfolio and the services clients can hire you for."
        actions={
          !isProArtist && !loading ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('membership')}
              className="rounded-xl font-semibold"
            >
              <Crown className="mr-1.5 h-3.5 w-3.5 text-warning" />
              Upgrade
            </Button>
          ) : undefined
        }
      />

      {!loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <CapacityMeter
            label="Artworks"
            used={portfolioCount}
            limit={portfolioLimit}
            unlimited={isProArtist}
          />
          <CapacityMeter
            label="Services"
            used={serviceCount}
            limit={serviceLimit}
            unlimited={isProArtist}
          />
        </div>
      )}

      {showUpgradePrompt && (
        <div className="flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Crown className="mt-0.5 h-[18px] w-[18px] shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold">You're close to your plan limit</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pro removes the caps on artworks and services, and drops commission to 0%.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => onNavigate('membership')}
            className="shrink-0 rounded-xl font-semibold"
          >
            See Pro
          </Button>
        </div>
      )}

      <Tabs defaultValue="artworks" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border border-border/60 bg-muted/40 p-1">
          <TabsTrigger
            value="artworks"
            className="gap-2 rounded-xl py-2.5 font-semibold data-[state=active]:bg-background data-[state=active]:shadow-token-xs"
          >
            <Palette className="h-4 w-4" />
            <span>Artworks</span>
            {!loading && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {portfolioCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="services"
            className="gap-2 rounded-xl py-2.5 font-semibold data-[state=active]:bg-background data-[state=active]:shadow-token-xs"
          >
            <Briefcase className="h-4 w-4" />
            <span>Services</span>
            {!loading && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {serviceCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="artworks" className="mt-6 outline-none focus-visible:ring-0">
          <ArtworkManagement />
        </TabsContent>
        <TabsContent value="services" className="mt-6 outline-none focus-visible:ring-0">
          <ServicesManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorksTab;
