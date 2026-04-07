import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users, DollarSign, Shield, AlertTriangle, ScrollText, Activity
} from 'lucide-react';
import { cn } from "@/lib/utils";

// Governance modules
import DisputeSettlement from './DisputeSettlement';
import ContentModeration from './ContentModeration';
import UserGovernance from './UserGovernance';
import AuditLog from './AuditLog';
import AdminOverview from './AdminOverview';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  // Trigger a window resize event to ensure any responsive components inside tabs adjust correctly when opened
  useEffect(() => {
    const handleResize = () => window.dispatchEvent(new Event('resize'));
    handleResize();
  }, [activeTab]);

  return (
    <div className="space-y-4 sm:space-y-6 w-full animate-fade-in px-2 sm:px-0">
      {/* Platform Heading - Compact for Mobile */}
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

      {/* Standard Platform Responsive Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-2 sm:mb-8">
        <div className="relative mb-4 sm:mb-6 group">
          <div 
            className="flex justify-center overflow-x-auto scroll-smooth snap-x snap-mandatory py-2 pb-4 no-scrollbar"
            style={{ 
              msOverflowStyle: 'none', 
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <style>{`
              .no-scrollbar::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            <TabsList className="bg-white/80 dark:bg-card/80 backdrop-blur-md inline-flex sm:flex sm:flex-wrap lg:grid lg:grid-cols-5 gap-1.5 p-1 rounded-full shadow-lg border border-border/40 min-w-full sm:min-w-0 h-auto">
              
              <TabsTrigger 
                value="overview" 
                className={cn(
                  "flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-[10px] sm:text-sm px-4 sm:px-6 py-2.5 sm:py-3 rounded-full transition-all duration-300 snap-center flex-1 sm:flex-initial min-w-[70px] sm:min-w-0",
                  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md",
                  "hover:bg-primary/5 hover:text-primary data-[state=inactive]:text-muted-foreground font-black sm:font-medium"
                )}
              >
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
                <span className="sm:hidden">Stats</span>
              </TabsTrigger>

              <TabsTrigger 
                value="users" 
                className={cn(
                  "flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-[10px] sm:text-sm px-4 sm:px-6 py-2.5 sm:py-3 rounded-full transition-all duration-300 snap-center flex-1 sm:flex-initial min-w-[70px] sm:min-w-0",
                  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md",
                  "hover:bg-primary/5 hover:text-primary data-[state=inactive]:text-muted-foreground font-black sm:font-medium"
                )}
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">User Governance</span>
                <span className="sm:hidden">Users</span>
              </TabsTrigger>
              
              <TabsTrigger 
                value="disputes" 
                className={cn(
                  "flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-[10px] sm:text-sm px-4 sm:px-6 py-2.5 sm:py-3 rounded-full transition-all duration-300 snap-center flex-1 sm:flex-initial min-w-[70px] sm:min-w-0",
                  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md",
                  "hover:bg-primary/5 hover:text-primary data-[state=inactive]:text-muted-foreground font-black sm:font-medium"
                )}
              >
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Disputes</span>
                <span className="sm:hidden">Legal</span>
              </TabsTrigger>
              
              <TabsTrigger 
                value="takedown" 
                className={cn(
                  "flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-[10px] sm:text-sm px-4 sm:px-6 py-2.5 sm:py-3 rounded-full transition-all duration-300 snap-center flex-1 sm:flex-initial min-w-[70px] sm:min-w-0",
                  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md",
                  "hover:bg-primary/5 hover:text-primary data-[state=inactive]:text-muted-foreground font-black sm:font-medium"
                )}
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden sm:inline">Takedowns</span>
                <span className="sm:hidden">Safety</span>
              </TabsTrigger>
              
              <TabsTrigger 
                value="audit" 
                className={cn(
                  "flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-[10px] sm:text-sm px-4 sm:px-6 py-2.5 sm:py-3 rounded-full transition-all duration-300 snap-center flex-1 sm:flex-initial min-w-[70px] sm:min-w-0",
                  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md",
                  "hover:bg-primary/5 hover:text-primary data-[state=inactive]:text-muted-foreground font-black sm:font-medium"
                )}
              >
                <ScrollText className="h-4 w-4" />
                <span className="hidden sm:inline">Audit Log</span>
                <span className="sm:hidden">Logs</span>
              </TabsTrigger>
  
            </TabsList>
          </div>
        </div>

        <div className="mt-4 sm:mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <TabsContent value="overview" className="m-0 border-none outline-none focus-visible:ring-0">
            <AdminOverview />
          </TabsContent>

          <TabsContent value="users" className="m-0 border-none outline-none focus-visible:ring-0">
            <UserGovernance />
          </TabsContent>
          
          <TabsContent value="disputes" className="m-0 border-none outline-none focus-visible:ring-0">
            <DisputeSettlement />
          </TabsContent>
          
          <TabsContent value="takedown" className="m-0 border-none outline-none focus-visible:ring-0">
            <ContentModeration />
          </TabsContent>
          
          <TabsContent value="audit" className="m-0 border-none outline-none focus-visible:ring-0">
            <AuditLog />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
