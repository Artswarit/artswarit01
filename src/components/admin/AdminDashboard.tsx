import { useState, useEffect } from 'react';
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
  { value: 'overview', icon: Activity, label: 'Overview' },
  { value: 'operations', icon: Briefcase, label: 'Operations' },
  { value: 'revenue', icon: DollarSign, label: 'Revenue' },
  { value: 'content', icon: ImageIcon, label: 'Content' },
  { value: 'engagement', icon: MessageSquare, label: 'Engagement' },
  { value: 'system', icon: Server, label: 'System' },
  { value: 'users', icon: Users, label: 'Users' },
  { value: 'disputes', icon: DollarSign, label: 'Disputes' },
  { value: 'takedown', icon: AlertTriangle, label: 'Takedowns' },
  { value: 'audit', icon: ScrollText, label: 'Audit' },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, [activeTab]);

  return (
    <div className="w-full animate-fade-in">
      {/* Header */}
      <header className="flex items-center justify-between px-1 sm:px-2 mb-4 sm:mb-6">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-foreground/5 border border-border/60 flex items-center justify-center">
            <Shield className="h-4 w-4 text-foreground" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-semibold tracking-tight">Governance</h1>
            <p className="text-[11px] text-muted-foreground font-medium">Live · Root access</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">live</span>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Sticky scrollable tab bar */}
        <div className="sticky top-16 sm:top-20 z-20 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 bg-background/85 backdrop-blur-md border-b border-border/60">
          <div
            className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2.5"
            style={{ msOverflowStyle: 'none', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
            <TabsList className="bg-transparent inline-flex gap-1.5 p-0 h-auto">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-full transition-all whitespace-nowrap font-medium ease-apple",
                    "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_2px_10px_-2px_hsl(var(--primary)/0.4)]",
                    "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground"
                  )}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="mt-5 sm:mt-6 animate-in fade-in slide-in-from-bottom-1 duration-300">
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
