import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users, DollarSign, Shield, AlertTriangle, ScrollText, Activity, Briefcase, Image as ImageIcon, MessageSquare, Server
} from 'lucide-react';
import { cn } from "@/lib/utils";

import DisputeSettlement from './DisputeSettlement';
import ContentModeration from './ContentModeration';
import UserGovernance from './UserGovernance';
import AuditLog from './AuditLog';
import AdminOverview from './AdminOverview';
import AdminOperations from './AdminOperations';
import AdminRevenue from './AdminRevenue';
import AdminContent from './AdminContent';
import AdminEngagement from './AdminEngagement';
import AdminSystem from './AdminSystem';

const TABS = [
  { value: 'overview', icon: Activity, full: 'Overview', short: 'Stats' },
  { value: 'operations', icon: Briefcase, full: 'Operations', short: 'Ops' },
  { value: 'revenue', icon: DollarSign, full: 'Revenue', short: 'Money' },
  { value: 'content', icon: ImageIcon, full: 'Content', short: 'Art' },
  { value: 'engagement', icon: MessageSquare, full: 'Engagement', short: 'Engage' },
  { value: 'system', icon: Server, full: 'System', short: 'Sys' },
  { value: 'users', icon: Users, full: 'Users', short: 'Users' },
  { value: 'disputes', icon: DollarSign, full: 'Disputes', short: 'Legal' },
  { value: 'takedown', icon: AlertTriangle, full: 'Takedowns', short: 'Safety' },
  { value: 'audit', icon: ScrollText, full: 'Audit', short: 'Logs' },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, [activeTab]);

  return (
    <div className="space-y-4 sm:space-y-6 w-full animate-fade-in px-2 sm:px-0">
      <div className="mb-2 sm:mb-6 animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1">
        <div>
          <h1 className="font-heading text-lg sm:text-2xl lg:text-3xl font-black mb-0.5 flex items-center gap-2 tracking-tight">
            <Shield className="h-5 w-5 sm:h-7 sm:w-7 text-primary" />
            Governance
          </h1>
          <p className="text-muted-foreground text-[10px] sm:text-sm lg:text-base font-medium">
            Manual administration · Live Sync · RBI 2026
          </p>
        </div>
        <Badge className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 px-3 py-1 font-black rounded-full tracking-widest text-[9px] w-fit uppercase">
          Root Access
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-2 sm:mb-8">
        <div className="relative mb-4 sm:mb-6 group">
          <div
            className="flex justify-center overflow-x-auto scroll-smooth snap-x snap-mandatory py-2 pb-4 no-scrollbar"
            style={{ msOverflowStyle: 'none', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
            <TabsList className="bg-white/80 dark:bg-card/80 backdrop-blur-md inline-flex gap-1.5 p-1 rounded-full shadow-lg border border-border/40 h-auto">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className={cn(
                    "flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-[10px] sm:text-sm px-3 sm:px-5 py-2.5 sm:py-3 rounded-full transition-all duration-300 snap-center min-w-[64px] sm:min-w-0",
                    "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md",
                    "hover:bg-primary/5 hover:text-primary data-[state=inactive]:text-muted-foreground font-black sm:font-medium whitespace-nowrap"
                  )}
                >
                  <t.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.full}</span>
                  <span className="sm:hidden">{t.short}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="mt-4 sm:mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <TabsContent value="overview" className="m-0 border-none outline-none focus-visible:ring-0"><AdminOverview /></TabsContent>
          <TabsContent value="operations" className="m-0 border-none outline-none focus-visible:ring-0"><AdminOperations /></TabsContent>
          <TabsContent value="revenue" className="m-0 border-none outline-none focus-visible:ring-0"><AdminRevenue /></TabsContent>
          <TabsContent value="content" className="m-0 border-none outline-none focus-visible:ring-0"><AdminContent /></TabsContent>
          <TabsContent value="engagement" className="m-0 border-none outline-none focus-visible:ring-0"><AdminEngagement /></TabsContent>
          <TabsContent value="system" className="m-0 border-none outline-none focus-visible:ring-0"><AdminSystem /></TabsContent>
          <TabsContent value="users" className="m-0 border-none outline-none focus-visible:ring-0"><UserGovernance /></TabsContent>
          <TabsContent value="disputes" className="m-0 border-none outline-none focus-visible:ring-0"><DisputeSettlement /></TabsContent>
          <TabsContent value="takedown" className="m-0 border-none outline-none focus-visible:ring-0"><ContentModeration /></TabsContent>
          <TabsContent value="audit" className="m-0 border-none outline-none focus-visible:ring-0"><AuditLog /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
