import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LayoutDashboard, Users, MessageSquare, FileText, Settings, CreditCard, Bell, ChevronRight, Search, CheckCircle, Clock, Star, Lock, User, PlusCircle, Bookmark, ShoppingBag, Trash2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import SavedArtists from "@/components/dashboard/SavedArtists";
import SavedArtworks from "@/components/dashboard/SavedArtworks";
import MessagingModule from "@/components/dashboard/messages/MessagingModule";
import ProjectRating from "@/components/dashboard/ProjectRating";
import ClientPayments from "@/components/dashboard/ClientPayments";
import ClientSettings from "@/components/dashboard/ClientSettings";
import { clientDashboardTabs } from "@/components/dashboard/dashboardTabs";
import ClientProfile from "@/components/dashboard/ClientProfile";
import PurchasedArtworks from "@/components/dashboard/PurchasedArtworks";
import ProjectDetailModal from "@/components/dashboard/projects/ProjectDetailModal";
import { CreateProjectForm } from "@/components/projects";
import ArtistSelectionModal from "@/components/dashboard/projects/ArtistSelectionModal";
import ProfileCompletionBanner from "@/components/dashboard/ProfileCompletionBanner";
import DashboardAttentionRequired from "@/components/dashboard/DashboardAttentionRequired";
import DashboardMobileNav from "@/components/dashboard/DashboardMobileNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { computeProfileCompletion } from "@/hooks/useProfileCompletion";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { broadcastRefresh, useRealtimeSync } from "@/lib/realtime-sync";
import TabErrorBoundary from "@/components/dashboard/TabErrorBoundary";
import LogoLoader from "@/components/ui/LogoLoader";
import PageHeader from "@/components/shared/PageHeader";
import DashboardTabBar from "@/components/dashboard/ui/DashboardTabBar";
import StatTile from "@/components/dashboard/ui/StatTile";
import SectionHeading from "@/components/dashboard/ui/SectionHeading";
import StatusPill, { statusTone } from "@/components/dashboard/ui/StatusPill";

interface Project {
  id: string;
  title: string;
  description: string;
  artist: string;
  artistId: string;
  artistAvatar: string;
  dueDate: string;
  completedDate?: string;
  progress: number;
  status: string;
  rating?: number;
  budget: number;
  isLocked: boolean;
  currency?: string;
  exchangeRate?: number;
}
interface RecommendedArtist {
  id: string;
  name: string;
  profession: string;
  rating: number;
  profileImage: string;
}
const ClientDashboard = () => {
  const { user } = useAuth();
  const { toast: hookToast } = useToast();
  const { profile, loading: profileLoading } = useProfile();
  const { format } = useCurrencyFormat();
  
  // Profile completion check
  const completion = useMemo(() => computeProfileCompletion(profile), [profile]);
  const { isComplete, completionPercentage, missingFields } = completion;
  const profileReady = !profileLoading;
  const profileIncomplete = profileReady && !isComplete;
  
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTabFromUrl = searchParams.get('tab') || 'overview';
  const [selectedTab, setSelectedTab] = useState(currentTabFromUrl);
  const [isChatActive, setIsChatActive] = useState(false);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['overview', currentTabFromUrl]));

  // Sync visitedTabs with selectedTab to ensure content is rendered
  useEffect(() => {
    if (selectedTab) {
      setVisitedTabs(prev => {
        if (prev.has(selectedTab)) return prev;
        const next = new Set(prev);
        next.add(selectedTab);
        return next;
      });
    }
  }, [selectedTab]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [savedArtistsCount, setSavedArtistsCount] = useState(0);
  const [recommendedArtists, setRecommendedArtists] = useState<RecommendedArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [artistSelectionOpen, setArtistSelectionOpen] = useState(false);
  const [assigningProjectId, setAssigningProjectId] = useState<string | null>(null);
  const [projectModalInitialTab, setProjectModalInitialTab] = useState<string | undefined>(undefined);
  // Button-level loading state to prevent double-clicks
  const [buttonLoading, setButtonLoading] = useState<Record<string, boolean>>({});
  // Project search state — wired to the projects tab filter
  const [projectSearch, setProjectSearch] = useState('');
  // Load-more state for Projects tab
  const [visibleActive, setVisibleActive] = useState(5);
  const [visibleCompleted, setVisibleCompleted] = useState(5);
  const [isDeletingProject, setIsDeletingProject] = useState<string | null>(null);
  const PROJECTS_PER_PAGE = 5;

  // Read tab from URL on mount
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['overview', 'profile', 'projects', 'collection', 'messages', 'artists', 'account', 'settings'].includes(tabParam)) {
      setSelectedTab(tabParam === 'settings' ? 'account' : tabParam);
    } else if (!tabParam) {
      // Default to overview if no tab specified
      setSelectedTab('overview');
      setSearchParams({ tab: 'overview' }, { replace: true });
    }
  }, [searchParams]);

  const fetchProjects = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Fetch projects
      const {
        data: projectsData,
        error
      } = await supabase.from('projects').select('*').eq('client_id', user.id).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      const projects = projectsData || [];

      // Fetch artist profiles for all projects that have artist_id
      const artistIds = projects.filter(p => p.artist_id).map(p => p.artist_id);
      let artistProfiles: Record<string, any> = {};
      if (artistIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('public_profiles')
          .select('id, full_name, avatar_url')
          .in('id', artistIds);
        if (profileError) {
          console.warn('Artist profile lookup failed; continuing with fallback names.', profileError);
        }
        (profiles || []).forEach(p => {
          if (p.id) artistProfiles[p.id] = p;
        });
      }

      // Fetch reviews for completed projects to get ratings
      const projectIds = projects.filter(p => p.status === 'completed').map(p => p.id);
      let ratingsMap: Record<string, number> = {};
      if (projectIds.length > 0) {
        const { data: reviews, error: reviewsError } = await supabase
          .from('project_reviews')
          .select('project_id, rating')
          .in('project_id', projectIds);
        if (reviewsError) {
          console.warn('Project rating lookup failed; continuing without ratings.', reviewsError);
        }
        (reviews || []).forEach(r => {
          ratingsMap[r.project_id] = r.rating;
        });
      }
      const transformedProjects: Project[] = projects.map((project: any) => {
        const artistProfile = artistProfiles[project.artist_id] || {};
        
        let statusDisplay = 'Pending Artist';
        if (project.status === 'accepted') statusDisplay = 'In Progress';
        else if (project.status === 'completed') statusDisplay = 'Completed';
        else if (project.status === 'pending') {
          if (!project.artist_id) {
            statusDisplay = 'Draft';
          } else if (project.is_locked) {
            statusDisplay = 'Pending Artist';
          } else {
            statusDisplay = 'Pending Confirm';
          }
        }
        else if (project.status === 'cancelled') statusDisplay = 'Rejected';
        else if (project.status === 'review') statusDisplay = 'Review';

        return {
          id: project.id,
          title: project.title,
          description: project.description || '',
          artist: artistProfile.full_name || (project.artist_id ? 'Artist' : 'Unassigned'),
          artistId: project.artist_id || '',
          artistAvatar: artistProfile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${project.artist_id || 'default'}`,
          dueDate: project.deadline ? new Date(project.deadline).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : 'No deadline',
          completedDate: project.status === 'completed' ? new Date(project.updated_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : undefined,
          progress: project.progress ?? (project.status === 'completed' ? 100 : project.status === 'accepted' ? 10 : project.status === 'cancelled' ? 0 : 0),
          status: statusDisplay,
          rating: ratingsMap[project.id] || 0,
          budget: project.amount_usd ?? project.budget ?? 0,
          sourceCurrency: project.amount_usd ? 'USD' : (project.currency || 'USD'),
          isLocked: !!project.is_locked,
          currency: project.currency,
          exchangeRate: project.exchange_rate
        };
      });
      setProjects(transformedProjects);
    } catch (err) {
      // Keep dashboard usable if an optional nested lookup/RLS edge fails; avoid a blocking toast loop.
      console.warn('Project refresh skipped:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);
  
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    const {
      data
    } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', {
      ascending: false
    }).limit(5);
    setNotifications((data || []).map(n => ({
      id: n.id,
      content: n.message,
      time: new Date(n.created_at).toLocaleDateString(),
      read: n.is_read,
      type: n.type,
      metadata: n.metadata
    })));
  }, [user?.id]);

  const fetchSavedArtistsCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const {
        count
      } = await supabase.from('saved_artists').select('*', {
        count: 'exact',
        head: true
      }).eq('client_id', user.id);
      setSavedArtistsCount(count || 0);
    } catch (err) {
      console.error('Error fetching saved artists:', err);
    }
  }, [user?.id]);
  // Realtime Sync - Moved after function definitions to avoid TDZ error
  useRealtimeSync('projects', fetchProjects);
  useRealtimeSync('notifications', fetchNotifications);
  useRealtimeSync('saved_artists', fetchSavedArtistsCount);
  const fetchRecommendedArtists = useCallback(async () => {
    try {
      // Fetch artists from profiles
      const {
        data: artists,
        error
      } = await supabase.from('public_profiles').select('id, full_name, avatar_url, bio, tags').eq('role', 'artist').limit(10);
      if (error) throw error;
      if (!artists || artists.length === 0) {
        setRecommendedArtists([]);
        return;
      }
      const artistIds = artists.map(a => a.id).filter(Boolean) as string[];

      // Get ratings for these artists
      const {
        data: reviews
      } = await supabase.from('project_reviews').select('artist_id, rating').in('artist_id', artistIds);
      const ratingMap = new Map<string, {
        total: number;
        count: number;
      }>();
      reviews?.forEach(r => {
        const existing = ratingMap.get(r.artist_id) || {
          total: 0,
          count: 0
        };
        ratingMap.set(r.artist_id, {
          total: existing.total + r.rating,
          count: existing.count + 1
        });
      });

      // Map to recommended artists format
      const mapped: RecommendedArtist[] = artists.filter(a => a.id).map(artist => {
        const ratingData = ratingMap.get(artist.id!);
        const avgRating = ratingData ? Math.round(ratingData.total / ratingData.count * 10) / 10 : 0;
        return {
          id: artist.id!,
          name: artist.full_name || 'Unknown Artist',
          profession: artist.tags?.[0] || 'Artist',
          rating: avgRating,
          profileImage: artist.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${artist.id}`
        };
      })
      // Sort by rating (highest first) then take top 3
      .sort((a, b) => b.rating - a.rating).slice(0, 3);
      setRecommendedArtists(mapped);
    } catch (err) {
      console.error('Error fetching recommended artists:', err);
    }
  }, []);
  useEffect(() => {
    fetchProjects();
    fetchNotifications();
    fetchSavedArtistsCount();
    fetchRecommendedArtists();
  }, [fetchProjects, fetchNotifications, fetchSavedArtistsCount, fetchRecommendedArtists]);

  // State Preservation Logic
  useEffect(() => {
    // Restore state from storage on mount
    const restoreState = () => {
      // 1. Restore Tab (if not in URL)
      if (!searchParams.get('tab')) {
        const savedTab = localStorage.getItem('client_dashboard_active_tab');
        if (savedTab && ['overview', 'profile', 'projects', 'collection', 'messages', 'artists', 'account', 'settings'].includes(savedTab)) {
          if (!profileIncomplete || savedTab === 'profile') {
            const normalizedTab = savedTab === 'settings' ? 'account' : savedTab;
            setSelectedTab(normalizedTab);
            setSearchParams({ tab: normalizedTab }, { replace: true });
          }
        }
      }

      // 2. Restore UI State (Dialogs, etc.)
      try {
        const savedUIState = sessionStorage.getItem('client_dashboard_ui_state');
        if (savedUIState) {
          const parsed = JSON.parse(savedUIState);
          if (parsed.createProjectOpen) setCreateProjectOpen(true);
          if (parsed.projectModalOpen && parsed.selectedProjectId) {
            setSelectedProjectId(parsed.selectedProjectId);
            setProjectModalOpen(true);
          }
          if (parsed.artistSelectionOpen && parsed.assigningProjectId) {
            setAssigningProjectId(parsed.assigningProjectId);
            setArtistSelectionOpen(true);
          }
        }
      } catch (e) {
        console.error("Failed to restore UI state", e);
      }
    };

    restoreState();
  }, []);

  // Dashboard tabs should open from the top, not restore an old inner scroll.
  useEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  }, [selectedTab]);

  // Save State Logic
  useEffect(() => {
    // 1. Save Tab
    if (selectedTab) {
      localStorage.setItem('client_dashboard_active_tab', selectedTab);
    }

    // 2. Save UI State
    const uiState = {
      createProjectOpen,
      projectModalOpen,
      selectedProjectId,
      artistSelectionOpen,
      assigningProjectId
    };
    sessionStorage.setItem('client_dashboard_ui_state', JSON.stringify(uiState));

  }, [selectedTab, createProjectOpen, projectModalOpen, selectedProjectId, artistSelectionOpen, assigningProjectId]);

  // Real-time subscription for notifications and saved artists
  // (projects realtime handled by useRealtimeSync above to avoid double-fetch)
  useEffect(() => {
    if (!user?.id) return;
    const notificationsChannel = supabase.channel(`client-notifications-${user.id}`).on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${user.id}`
    }, () => {
      fetchNotifications();
      toast.info('New notification received!');
    }).subscribe();
    const savedArtistsChannel = supabase.channel(`client-saved-artists-${user.id}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'saved_artists',
      filter: `client_id=eq.${user.id}`
    }, () => {
      fetchSavedArtistsCount();
    }).subscribe();
    return () => {
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(savedArtistsChannel);
    };
  }, [user?.id, fetchProjects, fetchNotifications, fetchSavedArtistsCount]);
  const handleUnassignArtist = async (projectId: string) => {
    const key = `unassign-${projectId}`;
    if (buttonLoading[key]) return;
    setButtonLoading(prev => ({ ...prev, [key]: true }));
    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          artist_id: null,
          status: 'pending',
          is_locked: false
        })
        .eq('id', projectId);

      if (error) throw error;
      
      toast.success('Artist unassigned successfully');
      broadcastRefresh('projects');
      fetchProjects();
    } catch (err: any) {
      const msg = err?.code === 'PGRST301' ? 'Permission denied. You can only edit your own projects.'
        : err?.code === '23505' ? 'Duplicate entry — this artist is already assigned.'
        : err?.message || 'Failed to unassign artist';
      toast.error(msg);
    } finally {
      setButtonLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({
        is_read: true
      }).eq('id', id);
      fetchNotifications();
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (notification.type === 'message' || notification.type === 'project') {
      if (notification.metadata?.projectId) {
        setProjectModalInitialTab(notification.type === 'message' ? 'communication' : 'workflow');
        setSelectedProjectId(notification.metadata.projectId);
        setProjectModalOpen(true);
      } else {
        setSelectedTab('messages');
      }
    }
    markAsRead(notification.id);
  };

  const handleConfirmProject = async (projectId: string, artistId: string) => {
    const key = `confirm-${projectId}`;
    if (buttonLoading[key]) return;
    setButtonLoading(prev => ({ ...prev, [key]: true }));
    try {
      const { error: updateError } = await supabase
        .from('projects')
        .update({ is_locked: true })
        .eq('id', projectId);

      if (updateError) {
        if (updateError.code === 'PGRST301') throw new Error('Permission denied — you can only confirm your own projects.');
        throw updateError;
      }

      const { error: notifyError } = await supabase.from('notifications').insert({
        user_id: artistId,
        title: 'New Project Request',
        message: 'You have received a new project request.',
        type: 'project',
        metadata: { projectId }
      });

      if (notifyError) throw notifyError;
      
      toast.success('Project sent to artist for approval');
      broadcastRefresh('projects');
      fetchProjects();
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm project');
    } finally {
      setButtonLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleArtistSelected = async (artistId: string) => {
    if (!assigningProjectId) return;
    const key = `assign-${assigningProjectId}`;
    if (buttonLoading[key]) return;
    setButtonLoading(prev => ({ ...prev, [key]: true }));
    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          artist_id: artistId,
          status: 'pending',
          is_locked: false
        })
        .eq('id', assigningProjectId);

      if (error) throw error;
      
      toast.success('Artist assigned successfully. Click confirm to send project.');
      setArtistSelectionOpen(false);
      setAssigningProjectId(null);
      broadcastRefresh('projects');
      fetchProjects();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign artist');
    } finally {
      setButtonLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const key = `delete-${projectId}`;
    if (buttonLoading[key]) return;
    setButtonLoading(prev => ({ ...prev, [key]: true }));
    try {
      const { data, error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .select();

      if (error) {
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.warn('Delete warning: No rows were deleted. Check RLS or Project ID.');
      }
      
      toast.success('Project deleted successfully');
      broadcastRefresh('projects');
      fetchProjects();
    } catch (err: any) {
      console.error('Delete project error:', err);
      toast.error(err.message || 'Failed to delete project', {
        description: "Please ensure all associated milestones and files are not locked."
      });
    } finally {
      setButtonLoading(prev => ({ ...prev, [key]: false }));
      setIsDeletingProject(null);
    }
  };

  const handleTabChange = (newTab: string) => {
    setSelectedTab(newTab);
    setSearchParams({ tab: newTab });
    setVisitedTabs(prev => new Set(prev).add(newTab));
  };

  const activeProjects = projects.filter(p => ["In Progress", "Review", "Pending Artist", "Pending Confirm", "Draft"].includes(p.status));
  const completedProjects = projects.filter(p => p.status === "Completed");
  const rejectedProjects = projects.filter(p => p.status === "Rejected");
  // Real profile name — fallback chain: full_name → email prefix → 'there'
  const userName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  // Filtered projects for the search box in projects tab
  const searchedActiveProjects = projectSearch
    ? activeProjects.filter(p =>
        p.title.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.artist.toLowerCase().includes(projectSearch.toLowerCase())
      )
    : activeProjects;
  const searchedCompletedProjects = projectSearch
    ? completedProjects.filter(p =>
        p.title.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.artist.toLowerCase().includes(projectSearch.toLowerCase())
      )
    : completedProjects;

  if (loading || profileLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-background dark:via-background dark:to-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <LogoLoader text="Loading your dashboard..." />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <div className="w-full max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 pb-[calc(7rem+var(--safe-bottom))] sm:pb-12 pt-[calc(4.75rem+var(--safe-top))] sm:pt-[calc(6rem+var(--safe-top))] lg:pt-[calc(6.5rem+var(--safe-top))]">
        {/* Dashboard Header */}
        {selectedTab === 'overview' && (
          <div className="pt-4 sm:pt-6 mb-5 sm:mb-6 animate-fade-in">
            <PageHeader
              title="Client Dashboard"
              size="lg"
              description={
                <>
                  Hi <span className="font-semibold text-foreground">{userName}</span>, your projects and artists are here.
                </>
              }
              actions={
                <Button className="h-11 rounded-xl" onClick={() => setCreateProjectOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New project
                </Button>
              }
            />
          </div>
        )}

        {/* Dashboard Navigation */}
        <Tabs value={selectedTab} className="mb-4 sm:mb-6 lg:mb-8" onValueChange={handleTabChange}>
          <div className="sticky top-[calc(4rem+var(--safe-top,0px))] z-30 -mx-3 mb-6 hidden bg-background/85 px-3 py-2.5 backdrop-blur-xl sm:block">
            <DashboardTabBar tabs={clientDashboardTabs} />
          </div>


          {/* Overview Tab Content */}
          <TabsContent value="overview" className="space-y-4 sm:space-y-6 lg:space-y-8 animate-fade-in outline-none focus-visible:ring-0" forceMount>
            <div className={cn(selectedTab !== 'overview' && "hidden")}>
              {visitedTabs.has('overview') && (
                <TabErrorBoundary tabLabel="Overview">
                <div className="space-y-4 sm:space-y-6 lg:space-y-8">
                  <DashboardAttentionRequired 
                    role="client" 
                    profile={profile} 
                    onAction={handleTabChange} 
                  />

                  {/* Profile Completion Alert - Realtime & Auto-disappearing */}
                  <ProfileCompletionBanner />
            {/* Stats row */}
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3 sm:gap-4">
              <StatTile
                label="Active"
                value={activeProjects.length}
                hint="Projects in progress"
                icon={Clock}
                tone="info"
                onClick={() => handleTabChange('projects')}
                actionLabel="View active projects"
              />
              <StatTile
                label="Done"
                value={completedProjects.length}
                hint="Completed projects"
                icon={CheckCircle}
                tone="success"
                onClick={() => handleTabChange('projects')}
                actionLabel="View completed projects"
              />
              <StatTile
                label="Saved"
                value={savedArtistsCount}
                hint="Artists you follow"
                icon={Users}
                tone="primary"
                onClick={() => handleTabChange('artists')}
                actionLabel="View saved artists"
              />
            </div>


            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              {/* Active Projects Section - Larger */}
              <div className="lg:col-span-2 space-y-4">
                <SectionHeading
                  title="Active projects"
                  icon={LayoutDashboard}
                  meta={activeProjects.length || undefined}
                  actions={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-lg text-primary hover:bg-primary/10"
                      onClick={() => handleTabChange('projects')}
                    >
                      View all <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  }
                />


                <div className="grid grid-cols-1 gap-3">
                  {activeProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12">
                      <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <h3 className="mb-1 text-base font-semibold tracking-tight text-foreground">No active projects yet</h3>
                      <p className="mb-5 max-w-xs text-center text-sm text-muted-foreground">
                        Create a project and we'll help you match with the right artist.
                      </p>
                      <Button onClick={() => setCreateProjectOpen(true)} className="h-11 gap-2 rounded-xl">
                        <PlusCircle className="h-4 w-4" />
                        Create project
                      </Button>
                    </div>
                  ) : (
                    activeProjects.slice(0, 3).map((project) => (
                      <div
                        key={project.id}
                        className="group rounded-2xl border border-border/60 bg-card p-4 shadow-token-xs transition-all duration-300 ease-apple hover:border-primary/40 hover:shadow-token-sm sm:p-5"
                      >
                        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <StatusPill tone={statusTone(project.status)}>{project.status}</StatusPill>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" /> Due {project.dueDate}
                              </span>
                            </div>
                            <h3 className="mb-1.5 truncate text-base font-semibold tracking-tight transition-colors group-hover:text-primary">
                              {project.title}
                            </h3>
                            <div className="mb-4 flex items-center gap-2">
                              <img
                                loading="lazy"
                                decoding="async"
                                src={project.artistAvatar}
                                alt={project.artist}
                                className="h-5 w-5 rounded-full object-cover"
                              />
                              <span className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">{project.artist}</span>
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-medium text-foreground">{project.progress}%</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary transition-all duration-700 ease-apple"
                                  style={{ width: `${project.progress}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2 self-end sm:self-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-10 rounded-xl px-4"
                              onClick={() => {
                                setSelectedProjectId(project.id);
                                setProjectModalOpen(true);
                              }}
                            >
                              View details
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>

              {/* Sidebar: Recommendations & Notifications */}
              <div className="space-y-6 lg:space-y-8">
                {/* Recommended Section */}
                <div className="space-y-3">
                  <SectionHeading
                    title="Artists for you"
                    icon={Star}
                    actions={
                      <Link
                        to="/explore"
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        Explore <ChevronRight className="h-3 w-3" />
                      </Link>
                    }
                  />

                  <div className="grid grid-cols-1 gap-2">
                    {recommendedArtists.slice(0, 3).map((artist) => (
                      <Link
                        key={artist.id}
                        to={`/artist/${artist.id}`}
                        className="group rounded-xl border border-border/60 bg-card p-3 transition-all duration-300 ease-apple hover:border-primary/40 hover:shadow-token-xs active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            loading="lazy"
                            decoding="async"
                            src={artist.profileImage}
                            alt={artist.name}
                            className="h-11 w-11 shrink-0 rounded-xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-semibold transition-colors group-hover:text-primary">
                              {artist.name}
                            </h3>
                            <p className="truncate text-xs text-muted-foreground">{artist.profession}</p>
                          </div>
                          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
                            <Star className="h-3 w-3 fill-warning text-warning" /> {artist.rating}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Notifications Section */}
                <div className="space-y-3">
                  <SectionHeading
                    title="Activity"
                    icon={Bell}
                    actions={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 rounded-lg text-xs text-muted-foreground"
                        onClick={() => handleTabChange('account')}
                      >
                        Manage
                      </Button>
                    }
                  />

                  <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                    <div className="divide-y divide-border/50">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
                          <Bell className="h-5 w-5 opacity-40" />
                          <p>No new updates</p>
                        </div>
                      ) : (
                        notifications.slice(0, 4).map((notification) => (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => handleNotificationClick(notification)}
                            className={cn(
                              "flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/40",
                              !notification.read && "bg-primary/[0.04]"
                            )}
                          >
                            <span
                              className={cn(
                                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                                notification.read ? "bg-transparent" : "bg-primary"
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-xs leading-relaxed text-foreground">{notification.content}</p>
                              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Clock className="h-3 w-3" /> {notification.time}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                  </div>
                </div>
              </div>

            </div>
                </div>
              </div>
                </TabErrorBoundary>
              )}
          </div>
        </TabsContent>


          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-4 sm:space-y-6 lg:space-y-8 animate-fade-in outline-none focus-visible:ring-0" forceMount>
            <div className={cn(selectedTab !== 'projects' && "hidden")}>
              {visitedTabs.has('projects') && (
                <TabErrorBoundary tabLabel="Projects">
                <>
                  <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <h2 className="text-lg font-semibold tracking-tight sm:text-xl">All projects</h2>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                      <div className="relative flex-1 sm:flex-initial">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search projects"
                          value={projectSearch}
                          onChange={e => setProjectSearch(e.target.value)}
                          className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-4 text-sm transition-shadow placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-56 lg:w-64"
                        />
                      </div>
                      <Button className="h-11 w-full rounded-xl sm:w-auto" onClick={() => setCreateProjectOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        New project
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
                      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
                        <Clock className="h-4 w-4 text-warning" />
                        In progress
                        {projectSearch && <span className="text-xs font-normal text-muted-foreground">({searchedActiveProjects.length} result{searchedActiveProjects.length !== 1 ? 's' : ''})</span>}
                      </h3>

                <div className="space-y-3">
                  {searchedActiveProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10">
                      <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-muted">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="mb-1 text-sm font-semibold text-foreground">{projectSearch ? 'No matches' : 'No active projects'}</p>
                      <p className="mb-4 text-center text-xs text-muted-foreground">{projectSearch ? 'Try a different search term.' : 'Create a project to get started.'}</p>
                      {!projectSearch && (
                        <Button size="sm" onClick={() => setCreateProjectOpen(true)} className="h-10 rounded-xl px-4 text-xs">
                          <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> New project
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      {searchedActiveProjects.slice(0, visibleActive).map((project) => <div key={project.id} className="rounded-xl border border-border/60 bg-background p-3 transition-all duration-300 ease-apple hover:border-primary/30 hover:shadow-token-xs sm:p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                <img loading="lazy" decoding="async" src={project.artistAvatar} alt={project.artist} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                                <div className="min-w-0 flex-1">
                                  <h4 className="truncate text-sm font-semibold tracking-tight">{project.title}</h4>
                                  <Link to={`/artist/${project.artistId}`} className="text-xs text-muted-foreground transition-colors hover:text-primary">
                                    {project.artist}
                                  </Link>
                                </div>
                              </div>
                              <StatusPill tone={statusTone(project.status)} className="shrink-0">{project.status}</StatusPill>
                            </div>
                            {project.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{project.description}</p>}
                            <div className="mt-3 flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full bg-primary transition-all duration-700 ease-apple" style={{
                            width: `${project.progress}%`
                          }} />
                              </div>
                              <span className="text-[11px] font-medium text-muted-foreground">{project.progress}%</span>
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] text-muted-foreground">Due {project.dueDate}</span>
                                {project.budget > 0 && <span className="text-[11px] font-medium text-success">
                                    {format(project.budget, 'USD', project.exchangeRate)}
                                  </span>}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                  <Button size="sm" variant="outline" className="h-7 sm:h-8 text-xs" onClick={() => {
                                    setSelectedProjectId(project.id);
                                    setProjectModalOpen(true);
                                  }}>
                                    View
                                  </Button>
                                  
                                  {project.status === 'Draft' && (
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className="h-7 sm:h-8 px-2 text-destructive hover:bg-destructive/10 border-destructive"
                                      disabled={!!buttonLoading[`delete-${project.id}`]}
                                      onClick={() => setIsDeletingProject(project.id)}
                                    >
                                      {buttonLoading[`delete-${project.id}`] ? (
                                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                                      ) : <Trash2 className="h-4 w-4" />}
                                    </Button>
                                  )}
                                  
                                  {(project.status === 'Draft' || project.status === 'Pending Confirm') && (
                                    <>
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="h-9 sm:h-10 min-w-[44px] text-xs border-primary text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                                        disabled={!!buttonLoading[`assign-${project.id}`]}
                                        onClick={() => {
                                          setAssigningProjectId(project.id);
                                          setArtistSelectionOpen(true);
                                        }}
                                      >
                                        {buttonLoading[`assign-${project.id}`] ? (
                                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                        ) : (
                                          project.status === 'Draft' ? 'Assign Artist' : 'Reassign'
                                        )}
                                      </Button>

                                      {project.status === 'Pending Confirm' && (
                                        <>
                                          <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-9 sm:h-10 min-w-[44px] text-xs text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1"
                                            disabled={!!buttonLoading[`unassign-${project.id}`]}
                                            onClick={() => handleUnassignArtist(project.id)}
                                          >
                                            {buttonLoading[`unassign-${project.id}`] ? (
                                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                                            ) : 'Unassign'}
                                          </Button>
                                          <Button 
                                            size="sm" 
                                            className="h-9 sm:h-10 min-w-[44px] text-xs bg-primary text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                                            disabled={!!buttonLoading[`confirm-${project.id}`]}
                                            onClick={() => handleConfirmProject(project.id, project.artistId)}
                                          >
                                            {buttonLoading[`confirm-${project.id}`] ? (
                                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            ) : 'Confirm'}
                                          </Button>
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>
                          </div>
                        </div>)}

                      {/* Load More — Active */}
                      {visibleActive < searchedActiveProjects.length && (
                        <div className="flex justify-center pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 px-8 rounded-xl font-medium text-sm border-border/40 hover:bg-primary/5 text-muted-foreground hover:text-primary"
                            onClick={() => setVisibleActive(v => v + PROJECTS_PER_PAGE)}
                          >
                            Load More · {Math.min(PROJECTS_PER_PAGE, searchedActiveProjects.length - visibleActive)} of {searchedActiveProjects.length - visibleActive} remaining
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              <div className="bg-white/60 dark:bg-card/60 backdrop-blur-sm p-4 sm:p-6 rounded-lg sm:rounded-xl shadow-sm border border-blue-100 dark:border-border">
                <h3 className="font-heading text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600" />
                  Completed
                  {projectSearch && <span className="ml-2 text-xs font-normal text-muted-foreground">({searchedCompletedProjects.length} result{searchedCompletedProjects.length !== 1 ? 's' : ''})</span>}
                </h3>
                <div className="space-y-3 sm:space-y-4">
                  {searchedCompletedProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 rounded-[2rem] border-2 border-dashed border-border/30 bg-muted/10">
                      <div className="rounded-2xl bg-muted/40 p-4 mb-4">
                        <CheckCircle className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                      <p className="text-sm font-black text-foreground mb-1">{projectSearch ? 'No matches' : 'No completed projects'}</p>
                      <p className="text-xs text-muted-foreground text-center">{projectSearch ? 'Try a different search term.' : 'Completed projects will appear here.'}</p>
                    </div>
                  ) : (
                    <>
                      {searchedCompletedProjects.slice(0, visibleCompleted).map((project, index) => <div key={project.id} className="p-3 sm:p-4 border border-gray-100 dark:border-border rounded-lg bg-white/70 dark:bg-card/70 transition-all duration-300 hover:shadow-md animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <img loading="lazy" decoding="async" src={project.artistAvatar} alt={project.artist} className="h-8 w-8 rounded-full object-cover shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm sm:text-base truncate">{project.title}</h4>
                                  <Link to={`/artist/${project.artistId}`} className="text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors">
                                    {project.artist}
                                  </Link>
                                </div>
                              </div>
                              <div className="flex shrink-0">
                                {[...Array(project.rating || 0)].map((_, i) => <span key={i} className="text-yellow-400 text-xs sm:text-sm">★</span>)}
                                {project.rating === 0 && <span className="text-xs text-muted-foreground">No rating</span>}
                              </div>
                            </div>
                            {project.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{project.description}</p>}
                            <div className="mt-2 sm:mt-3 flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] sm:text-xs text-gray-500">Completed: {project.completedDate}</span>
                                {project.budget > 0 && <span className="text-[10px] sm:text-xs text-green-600 font-medium">
                                    {format(project.budget, 'USD', project.exchangeRate)}
                                  </span>}
                              </div>
                              <Button size="sm" variant="outline" className="h-7 sm:h-8 text-xs" onClick={() => {
                        setSelectedProjectId(project.id);
                        setProjectModalOpen(true);
                      }}>
                                View
                              </Button>
                            </div>
                          </div>)}

                      {/* Load More — Completed */}
                      {visibleCompleted < searchedCompletedProjects.length && (
                        <div className="flex justify-center pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 px-8 rounded-xl font-medium text-sm border-border/40 hover:bg-primary/5 text-muted-foreground hover:text-primary"
                            onClick={() => setVisibleCompleted(v => v + PROJECTS_PER_PAGE)}
                          >
                            Load More · {Math.min(PROJECTS_PER_PAGE, searchedCompletedProjects.length - visibleCompleted)} of {searchedCompletedProjects.length - visibleCompleted} remaining
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                </div>
              </div>
            </>
                </TabErrorBoundary>
              )}
        </div>
      </TabsContent>

          {/* My Works (Collection) Tab */}
          <TabsContent value="collection" className="animate-fade-in outline-none focus-visible:ring-0" forceMount>
            <div className={cn(selectedTab !== 'collection' && "hidden")}>
              {visitedTabs.has('collection') && (
                <TabErrorBoundary tabLabel="My Works">
                <Tabs defaultValue="purchased" className="w-full">
                  <TabsList className="bg-muted/50 p-1 rounded-xl mb-4 inline-flex w-auto">
                    <TabsTrigger value="purchased" className="rounded-lg text-xs px-4 py-2">Purchased</TabsTrigger>
                    <TabsTrigger value="saved" className="rounded-lg text-xs px-4 py-2">Wishlist</TabsTrigger>
                  </TabsList>
                  <TabsContent value="purchased" className="mt-0">
                    <PurchasedArtworks />
                  </TabsContent>
                  <TabsContent value="saved" className="mt-0">
                    <SavedArtworks />
                  </TabsContent>
                </Tabs>
                </TabErrorBoundary>
              )}
            </div>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="animate-fade-in outline-none focus-visible:ring-0" forceMount>
            <div className={cn(selectedTab !== 'messages' && "hidden")}>
              {visitedTabs.has('messages') && <TabErrorBoundary tabLabel="Messages"><MessagingModule onChatActiveChange={setIsChatActive} /></TabErrorBoundary>}
            </div>
          </TabsContent>

          {/* Artists Tab */}
          <TabsContent value="artists" className="animate-fade-in outline-none focus-visible:ring-0" forceMount>
            <div className={cn(selectedTab !== 'artists' && "hidden")}>
              {visitedTabs.has('artists') && <TabErrorBoundary tabLabel="Artists"><SavedArtists /></TabErrorBoundary>}
            </div>
          </TabsContent>
          
          {/* Account Tab - Consolidated */}
          <TabsContent value="account" className="animate-fade-in outline-none focus-visible:ring-0" forceMount>
            <div className={cn(selectedTab !== 'account' && "hidden")}>
              {visitedTabs.has('account') && (
                <TabErrorBoundary tabLabel="Account">
                <Tabs defaultValue="profile" className="w-full">
                  <div className="flex overflow-x-auto pb-2 mb-6 -mx-1 px-1 scrollbar-hide">
                    <TabsList className="bg-muted/30 p-1 rounded-xl flex sm:grid sm:grid-cols-3 h-auto overflow-x-auto">
                      <TabsTrigger value="profile" className="rounded-lg text-xs px-4 py-2 shrink-0">Profile</TabsTrigger>
                      <TabsTrigger value="payments" className="rounded-lg text-xs px-4 py-2 shrink-0">Payments</TabsTrigger>
                      <TabsTrigger value="settings" className="rounded-lg text-xs px-4 py-2 shrink-0">Settings</TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="profile" className="mt-0">
                    <ClientProfile />
                  </TabsContent>
                  
                  <TabsContent value="payments" className="mt-0">
                    <ClientPayments />
                  </TabsContent>
                  
                  <TabsContent value="ratings" className="mt-0">
                    <ProjectRating />
                  </TabsContent>


                  
                  <TabsContent value="settings" className="mt-0">
                    <ClientSettings />
                  </TabsContent>
                </Tabs>
                </TabErrorBoundary>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      <ProjectDetailModal 
        projectId={selectedProjectId} 
        open={projectModalOpen} 
        onOpenChange={(open) => {
          setProjectModalOpen(open);
          if (!open) setProjectModalInitialTab(undefined);
        }} 
        initialTab={projectModalInitialTab}
      />
      
      {/* Create Project Dialog */}
      <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
        <DialogContent className="max-w-none w-screen h-screen max-h-none overflow-hidden flex flex-col p-0 pt-[var(--safe-top)] pb-[var(--safe-bottom)] pl-[var(--safe-left)] pr-[var(--safe-right)] gap-0 border-none shadow-none bg-background backdrop-blur-2xl rounded-none">
          <DialogHeader className="px-5 sm:px-8 py-4 border-b bg-background/95 backdrop-blur-xl shrink-0">
            <DialogTitle className="text-lg sm:text-xl">Create New Project</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Fill in the details to create a new project.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <CreateProjectForm 
              onSuccess={() => {
                setCreateProjectOpen(false);
                fetchProjects();
                toast.success("Project created successfully!");
              }}
              onCancel={() => setCreateProjectOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
      <ArtistSelectionModal 
        isOpen={artistSelectionOpen}
        onClose={() => {
          setArtistSelectionOpen(false);
          setAssigningProjectId(null);
        }}
        onSelectArtist={handleArtistSelected}
      />
      <AlertDialog open={!!isDeletingProject} onOpenChange={(open) => !open && setIsDeletingProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the draft project
              and all its associated data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingProject ? !!buttonLoading[`delete-${isDeletingProject}`] : false}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                if (isDeletingProject) handleDeleteProject(isDeletingProject);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingProject ? !!buttonLoading[`delete-${isDeletingProject}`] : false}
            >
              {isDeletingProject && buttonLoading[`delete-${isDeletingProject}`] ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {!(selectedTab === 'messages' && isChatActive) && (
        <DashboardMobileNav 
          activeTab={selectedTab} 
          onTabChange={handleTabChange} 
          role="client"
          isLocked={profileIncomplete}
        />
      )}
    </div>
  );
};
export default ClientDashboard;
