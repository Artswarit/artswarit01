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
import { artistDashboardTabs } from '@/components/dashboard/dashboardTabs';

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
import TabErrorBoundary from '@/components/dashboard/TabErrorBoundary';
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

  // Backward-compat: legacy ?tab=premium → ?tab=membership, ?tab=analytics → ?tab=portfolio
  useEffect(() => {
    if (tab === 'premium') {
      setSearchParams({ tab: 'membership' }, { replace: true });
    } else if (tab === 'analytics') {
      setSearchParams({ tab: 'portfolio' }, { replace: true });
    }
  }, [tab, setSearchParams]);


  if (profileLoading && !profile) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-background flex items-center justify-center">
        <LogoLoader text="Loading dashboard…" />
      </div>
    );
  }


  // Tab configuration — shared with the mobile bottom nav via
  // src/components/dashboard/dashboardTabs.ts so the two surfaces can't
  // drift out of sync when a top-level tab is added.
  const tabs = artistDashboardTabs;



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
            <div className="sticky top-[calc(4rem+var(--safe-top,0px))] z-30 -mx-3 mb-6 hidden bg-background/85 px-3 py-2.5 backdrop-blur-xl sm:block sm:mb-8">
              <DashboardTabBar tabs={tabs} />
            </div>


            <div className="flex-1 pt-1 sm:pt-2 scrollbar-hide pb-6">
              <TabsContent value="overview" className="outline-none focus-visible:ring-0" forceMount>
                <div className={cn(activeTab !== 'overview' && "hidden")}>
                  {visitedTabs.has('overview') && (
                    <TabErrorBoundary tabLabel="Overview">
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
                    </TabErrorBoundary>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="membership" className="outline-none focus-visible:ring-0" forceMount>
                <div className={cn(activeTab !== 'membership' && "hidden")}>
                  {visitedTabs.has('membership') && (
                    <TabErrorBoundary tabLabel="Membership"><PremiumMembership /></TabErrorBoundary>
                  )}
                </div>
              </TabsContent>


              <TabsContent value="projects" className="outline-none focus-visible:ring-0" forceMount>
                <div className={cn(activeTab !== 'projects' && "hidden")}>
                  {visitedTabs.has('projects') && (
                    <TabErrorBoundary tabLabel="Projects"><ProjectManagement /></TabErrorBoundary>
                  )}
                </div>
              </TabsContent>




              <TabsContent value="portfolio" className="outline-none focus-visible:ring-0" forceMount>
                <div className={cn(activeTab !== 'portfolio' && "hidden")}>
                  {visitedTabs.has('portfolio') && (
                    <TabErrorBoundary tabLabel="Portfolio">
                      <Tabs defaultValue="artworks" className="w-full">
                        <TabsList className="mb-6 p-1 bg-muted/40 rounded-xl overflow-x-auto w-full flex sm:grid sm:grid-cols-2 h-auto">
                          <TabsTrigger value="artworks" className="rounded-lg shrink-0">Artworks</TabsTrigger>
                          <TabsTrigger value="services" className="rounded-lg shrink-0">Services</TabsTrigger>
                        </TabsList>
                        <TabsContent value="artworks"><ArtworkManagement /></TabsContent>
                        <TabsContent value="services"><ServicesManagement /></TabsContent>
                      </Tabs>
                    </TabErrorBoundary>
                  )}
                </div>
              </TabsContent>




              <TabsContent value="messages" className="outline-none focus-visible:ring-0" forceMount>
                <div className={cn(activeTab !== 'messages' && "hidden")}>
                  {visitedTabs.has('messages') && (
                    <TabErrorBoundary tabLabel="Messages">
                      <MessagingModule onChatActiveChange={setIsChatActive} />
                    </TabErrorBoundary>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="account" className="outline-none focus-visible:ring-0" forceMount>
                <div className={cn(activeTab !== 'account' && "hidden")}>
                  {visitedTabs.has('account') && (
                    <TabErrorBoundary tabLabel="Account">
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
                    </TabErrorBoundary>
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
