import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { computeProfileCompletion } from '@/hooks/useProfileCompletion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

import DashboardHeader from '@/components/dashboard/DashboardHeader';
import ArtworkManagement from '@/components/dashboard/ArtworkManagement';
import ArtistProfile from '@/components/dashboard/ArtistProfile';
import ArtistEarnings from '@/components/dashboard/ArtistEarnings';
import MessagingModule from '@/components/dashboard/messages/MessagingModule';
import ArtistSettings from '@/components/dashboard/ArtistSettings';
import PremiumMembership from '@/components/premium/PremiumMembership';
import { ArtistBilling } from '@/components/dashboard/ArtistBilling';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, User, DollarSign, MessageSquare, Settings, Crown, Bell, Briefcase, Wrench, Lock, Wallet, Users, LayoutDashboard, BarChart3 } from 'lucide-react';
import AdvancedAnalytics from '@/components/dashboard/artist/AdvancedAnalytics';
import { Separator } from '@/components/ui/separator';
import ProjectManagement from '@/components/dashboard/projects/ProjectManagement';
import ArtistNotifications from '@/components/dashboard/ArtistNotifications';
import ServicesManagement from '@/components/dashboard/services/ServicesManagement';
import ExclusiveMembers from '@/components/dashboard/ExclusiveMembers';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import LogoLoader from '@/components/ui/LogoLoader';
import ProfileCompletionBanner from '@/components/dashboard/ProfileCompletionBanner';
import DashboardAttentionRequired from '@/components/dashboard/DashboardAttentionRequired';
import DashboardMobileNav from '@/components/dashboard/DashboardMobileNav';

const ArtistDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading, updateProfile, uploadImage } = useProfile();
  const { countries, loading: loadingCountries, updateUserLocation } = useCurrency();
  const completion = useMemo(() => computeProfileCompletion(profile), [profile]);
  const { isComplete, completionPercentage, missingFields } = completion;
  const { toast } = useToast();
  const [isChatActive, setIsChatActive] = useState(false);
  const activeTab = tab || 'overview';
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['overview', activeTab]));

  useEffect(() => {
    if (activeTab) {
      setVisitedTabs(prev => new Set(prev).add(activeTab));
    }
  }, [activeTab]);

  useEffect(() => {
    sessionStorage.setItem('artist_dashboard_active_tab', activeTab);
  }, [activeTab]);

  // No production logging — removed console.log

  // Check if profile is loaded and complete
  const profileReady = !profileLoading;
  const profileIncomplete = profileReady && !isComplete;

  useEffect(() => {
    if (profile && profile.role !== 'artist' && profile.role !== 'premium') {
      navigate('/client-dashboard');
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (!profileReady) return;

    const savedTab = sessionStorage.getItem('artist_dashboard_active_tab');

    if (!tab) {
      if (savedTab) {
        setSearchParams({ tab: savedTab }, { replace: true });
      } else {
        setSearchParams({ tab: 'overview' }, { replace: true });
      }
    }
  }, [profileReady, isComplete, tab, navigate]);

  // Handle tab change with URL sync
  const handleTabChange = (newTab: string) => {
    setSearchParams({ tab: newTab });
  };

  const handleNotificationClick = (notification: any) => {
    if (notification.type === 'message' || notification.type === 'comment') {
      setSearchParams({ tab: 'messages' });
    } else if (notification.type === 'project') {
      setSearchParams({ tab: 'projects' });
    }
  };

  // Dashboard tabs should open from the top, not restore an old inner scroll.
  useEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  }, [activeTab]);

  // Backward-compat: legacy ?tab=premium → ?tab=membership
  useEffect(() => {
    if (tab === 'premium') {
      setSearchParams({ tab: 'membership' }, { replace: true });
    }
  }, [tab, setSearchParams]);

  if (profileLoading && !profile) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-background flex items-center justify-center">
        <LogoLoader text="Loading dashboard…" />
      </div>
    );
  }


  // Tab configuration with consolidated categories
  const tabs = [
    { value: 'overview', label: 'Overview', shortLabel: 'Home', icon: LayoutDashboard },
    { value: 'portfolio', label: 'My Works', shortLabel: 'Works', icon: Palette },
    { value: 'projects', label: 'Projects', shortLabel: 'Proj', icon: Briefcase },
    { value: 'messages', label: 'Messages', shortLabel: 'Msg', icon: MessageSquare },
    { value: 'membership', label: 'Membership', shortLabel: 'Pro', icon: Crown },
    { value: 'account', label: 'Account', shortLabel: 'Acc', icon: Settings },
  ];



  return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-background">
        <Navbar />
        <main className="w-full max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 pt-[calc(4.75rem+var(--safe-top))] sm:pt-[calc(6rem+var(--safe-top))] pb-[calc(7rem+var(--safe-bottom))] sm:pb-20">
          {activeTab === 'overview' && (
            <>
              <DashboardHeader
                user={user}
                profile={profile}
                title="Artist Dashboard"
                subtitle="Manage your projects, portfolio, and earnings in one place"
              />
              <ProfileCompletionBanner />
            </>
          )}

          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="relative mb-6 sm:mb-8 lg:mb-12">
              <div className="hidden sm:block overflow-x-auto pb-3 -mx-3 px-3 scrollbar-hide snap-x snap-mandatory scroll-smooth">
                <TabsList className="bg-white/80 dark:bg-card/80 backdrop-blur-md flex gap-1.5 sm:gap-2 p-1.5 rounded-2xl sm:rounded-3xl shadow-xl border border-border/40 h-auto w-full grid grid-cols-6 items-stretch">
                  {tabs.map((tabItem) => {
                    const Icon = tabItem.icon;
                    
                    return (
                      <TabsTrigger
                        key={tabItem.value}
                        value={tabItem.value}
                        className={cn(
                          "flex flex-col items-center gap-1.5 text-[10px] px-3.5 py-3 rounded-xl transition-all duration-300 snap-center",
                          "sm:flex-row sm:gap-2 sm:text-xs sm:px-4 sm:py-2.5 sm:rounded-2xl",
                          "lg:text-sm lg:px-5 lg:py-3",
                          "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl data-[state=active]:shadow-primary/30", 
                          "hover:bg-primary/5 hover:text-primary"
                        )}
                      >
                        <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px] shrink-0" />
                        <span className="font-bold sm:font-medium whitespace-nowrap tracking-tight">
                          {tabItem.label}
                        </span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>
            </div>

            <div className="flex-1 pt-1 sm:pt-2 scrollbar-hide pb-6">
              <TabsContent value="overview" className="outline-none focus-visible:ring-0" forceMount>
                <div className={cn(activeTab !== 'overview' && "hidden")}>
                  {visitedTabs.has('overview') && (
                    <div className="space-y-12">
                      {/* 1. Critical alerts that need action */}
                      <DashboardAttentionRequired 
                        role="artist" 
                        profile={profile} 
                        onAction={handleTabChange} 
                      />
                      {/* 2. Primary KPIs: earnings + active work */}
                      <ArtistEarnings isLoading={profileLoading} />
                      {/* 3. Engagement & activity feed */}
                      <ArtistNotifications isLoading={profileLoading} onNotificationClick={handleNotificationClick} />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="membership" className="outline-none focus-visible:ring-0" forceMount>
                <div className={cn(activeTab !== 'membership' && "hidden")}>
                  {visitedTabs.has('membership') && <PremiumMembership />}
                </div>
              </TabsContent>


              <TabsContent value="projects" className="outline-none focus-visible:ring-0" forceMount>
                <div className={cn(activeTab !== 'projects' && "hidden")}>
                  {visitedTabs.has('projects') && <ProjectManagement />}
                </div>
              </TabsContent>

              <TabsContent value="analytics" className="outline-none focus-visible:ring-0" forceMount>
                <div className={cn(activeTab !== 'analytics' && "hidden")}>
                  {visitedTabs.has('analytics') && <AdvancedAnalytics />}
                </div>
              </TabsContent>

              <TabsContent value="portfolio" className="outline-none focus-visible:ring-0" forceMount>
                <div className={cn(activeTab !== 'portfolio' && "hidden")}>
                  {visitedTabs.has('portfolio') && (
                    <div className="space-y-12">
                      <ArtworkManagement />
                      <Separator className="opacity-20" />
                      <ServicesManagement />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="finances" className="outline-none focus-visible:ring-0" forceMount>
                <div className={cn(activeTab !== 'finances' && "hidden")}>
                  {visitedTabs.has('finances') && (
                    <div className="space-y-12">
                      <ArtistBilling />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="messages" className="outline-none focus-visible:ring-0" forceMount>
                <div className={cn(activeTab !== 'messages' && "hidden")}>
                  {visitedTabs.has('messages') && <MessagingModule onChatActiveChange={setIsChatActive} />}
                </div>
              </TabsContent>

              <TabsContent value="account" className="outline-none focus-visible:ring-0" forceMount>
                <div className={cn(activeTab !== 'account' && "hidden")}>
                  {visitedTabs.has('account') && (
                    <Tabs defaultValue="profile_settings" className="w-full">
                      <TabsList className="mb-8 p-1 bg-muted/40 rounded-xl overflow-x-auto w-full flex sm:grid sm:grid-cols-4 h-auto">
                        <TabsTrigger value="profile_settings" className="rounded-lg shrink-0">Profile</TabsTrigger>
                        <TabsTrigger value="earnings" className="rounded-lg shrink-0">Earnings</TabsTrigger>
                        <TabsTrigger value="settings" className="rounded-lg shrink-0">Privacy</TabsTrigger>
                        <TabsTrigger value="exclusive" className="rounded-lg shrink-0">Exclusive</TabsTrigger>
                      </TabsList>

                      
                      <TabsContent value="profile_settings">
                        <ArtistProfile
                          isLoading={profileLoading}
                          profile={profile}
                          updateProfile={updateProfile}
                          uploadImage={uploadImage}
                          countries={countries}
                          updateUserLocation={updateUserLocation}
                        />
                      </TabsContent>
                      
                      <TabsContent value="earnings">
                        <div className="space-y-12">
                          <ArtistBilling />
                          <Separator className="opacity-20" />
                          <ArtistEarnings isLoading={profileLoading} />
                        </div>
                      </TabsContent>




                      <TabsContent value="settings">
                        <ArtistSettings isLoading={profileLoading} />
                      </TabsContent>

                      <TabsContent value="exclusive">
                        <ExclusiveMembers />
                      </TabsContent>
                    </Tabs>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>

          {!(activeTab === 'messages' && isChatActive) && (
            <DashboardMobileNav 
              activeTab={activeTab} 
              onTabChange={handleTabChange} 
              role="artist"
              isLocked={profileIncomplete}
            />
          )}
        </main>
        <div className={cn(activeTab === 'messages' && isChatActive ? "hidden md:block" : "")}>
          <Footer />
        </div>
      </div>
  );
};

export default ArtistDashboard;
