import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { FileText, MessageSquare, CheckCircle, Upload, Calendar, User, Clock, Plus, Trash2, Loader2, Download, GitBranch, DollarSign, SendHorizontal, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format as formatDate } from "date-fns";
import { Link } from "react-router-dom";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { useCurrency } from "@/contexts/CurrencyContext";
import { MilestoneWorkflow } from "@/components/projects";
import { broadcastRefresh, useRealtimeSync } from "@/lib/realtime-sync";
import { RefreshCw } from "lucide-react";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
interface ProjectDetailModalProps {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: string;
}
interface Milestone {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  sort_order: number;
}
interface ProjectFile {
  id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  storage_bucket: string;
  created_at: string;
  uploader_id: string;
}
interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
  read: boolean;
  status?: string;
  sender_name?: string;
  sender_avatar?: string;
}
interface ProjectData {
  id: string;
  title: string;
  description: string | null;
  budget: number | null;
  deadline: string | null;
  status: string | null;
  progress: number | null;
  created_at: string;
  updated_at: string;
  artist_id: string | null;
  client_id: string | null;
  artist_name?: string;
  artist_avatar?: string;
  client_name?: string;
  client_avatar?: string;
  currency?: string;
  exchange_rate?: number;
  amount_usd?: number | null;
}
const ProjectDetailModal = ({
  projectId,
  open,
  onOpenChange,
  initialTab
}: ProjectDetailModalProps) => {
  const {
    user
  } = useAuth();
  const {
    format: formatCurrency
  } = useCurrencyFormat();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  
  const { 
    messages: rtMessages, 
    sendMessage: rtSendMessage, 
    setActiveConversationId,
    activeConversationId 
  } = useRealtimeMessages();
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [newMilestone, setNewMilestone] = useState({
    title: "",
    description: "",
    due_date: "",
    amount: ""
  });
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("workflow");

  const scrollToTab = (tabId: string) => {
    setActiveTab(tabId);
    const element = document.getElementById(`project-tab-content-${tabId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (conversationId && conversationId !== activeConversationId) {
      setActiveConversationId(conversationId);
    }
  }, [conversationId, activeConversationId, setActiveConversationId]);

  useEffect(() => {
    if (initialTab && open) {
      setActiveTab(initialTab);
    }
  }, [initialTab, open]);

  const fetchProjectData = useCallback(async (signal?: AbortSignal, silent = false) => {
    if (!projectId) return;
    if (!silent && !project) setLoading(true);
    try {
      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      if (projectError) {
        if (projectError.name === 'AbortError' || (projectError as any).code === 'ABORT') return;
        throw projectError;
      }
      if (!projectData) {
        toast.error("Project not found");
        onOpenChange(false);
        return;
      }

      // Fetch profiles separately for maximum reliability
      let artistName = 'Unassigned';
      let artistAvatar = undefined;
      let clientName = 'Client';
      let clientAvatar = undefined;

      if (projectData.artist_id) {
        const { data: artistProfile } = await supabase
          .from('public_profiles')
          .select('full_name, avatar_url')
          .eq('id', projectData.artist_id)
          .maybeSingle();
        if (artistProfile) {
          artistName = artistProfile.full_name || 'Artist';
          artistAvatar = artistProfile.avatar_url || undefined;
        } else {
          artistName = 'Artist';
        }
      }

      if (projectData.client_id) {
        const { data: clientProfile } = await supabase
          .from('public_profiles')
          .select('full_name, avatar_url')
          .eq('id', projectData.client_id)
          .maybeSingle();
        if (clientProfile) {
          clientName = clientProfile.full_name || 'Client';
          clientAvatar = clientProfile.avatar_url || undefined;
        }
      }

      setProject({
        ...projectData,
        artist_name: artistName,
        artist_avatar: artistAvatar,
        client_name: clientName,
        client_avatar: clientAvatar
      });

      // Use Promise.all for independent fetches to speed up loading
      const [milestonesRes, filesRes] = await Promise.all([
        supabase.from('project_milestones').select('*').eq('project_id', projectId).order('sort_order', {
          ascending: true
        }),
        supabase.from('project_files').select('*').eq('project_id', projectId).order('created_at', {
          ascending: false
        })
      ]);

      if (milestonesRes.error) throw milestonesRes.error;
      if (filesRes.error) throw filesRes.error;

      setMilestones(milestonesRes.data || []);
      setFiles(filesRes.data || []);

      // Fetch or create conversation for messages
      if (projectData.artist_id && projectData.client_id) {
        const {
          data: existingConv
        } = await supabase.from('conversations').select('id').eq('artist_id', projectData.artist_id).eq('client_id', projectData.client_id).maybeSingle();
        if (existingConv) {
          setConversationId(existingConv.id);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.code === 'ABORT') return;
      console.error('Error fetching project data:', err);
      toast.error("Failed to load project details");
    } finally {
      setLoading(false);
    }
  }, [projectId, onOpenChange]);

  useEffect(() => {
    const controller = new AbortController();
    if (open && projectId) {
      fetchProjectData(controller.signal);
    }
    return () => controller.abort();
  }, [open, projectId, fetchProjectData]);

  // Real-time subscriptions
  useEffect(() => {
    if (!open || !projectId) return;
    const milestonesChannel = supabase.channel(`project-milestones-${projectId}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'project_milestones',
      filter: `project_id=eq.${projectId}`
    }, () => {
      fetchProjectData(undefined, false);
    }).subscribe();
    const filesChannel = supabase.channel(`project-files-${projectId}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'project_files',
      filter: `project_id=eq.${projectId}`
    }, () => {
      fetchProjectData(undefined, false);
    }).subscribe();

    // Subscribe to project updates (for progress changes)
    const projectChannel = supabase.channel(`project-detail-${projectId}`).on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'projects',
      filter: `id=eq.${projectId}`
    }, () => {
      fetchProjectData(undefined, false);
    }).subscribe();

    // Subscribe to payments
    const paymentsChannel = supabase.channel(`project-payments-${projectId}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'payments',
      filter: `project_id=eq.${projectId}`
    }, (payload) => {
      console.log('Payment update in modal:', payload);
      if ((payload.new as any)?.status === 'success') {
        toast.success('Payment confirmed! Your project is being updated...');
        fetchProjectData(undefined, false);
      } else {
        fetchProjectData(undefined, false);
      }
    }).subscribe();

    return () => {
      supabase.removeChannel(milestonesChannel);
      supabase.removeChannel(filesChannel);
      supabase.removeChannel(projectChannel);
      supabase.removeChannel(paymentsChannel);
    };
  }, [open, projectId, fetchProjectData]);

  useEffect(() => {
    if (initialTab && open) {
      scrollToTab(initialTab);
    }
  }, [initialTab, open]);

  // Handle chat auto-scroll
  useEffect(() => {
    if (activeTab === 'communication' && rtMessages.length > 0) {
      setTimeout(() => {
        const scrollArea = document.getElementById('chat-scroll-area');
        if (scrollArea) {
          const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]');
          if (viewport) {
            viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
          }
        }
      }, 50);
    }
  }, [rtMessages, activeTab]);

  const { userCurrency, userCurrencySymbol, exchangeRates } = useCurrency();

  // Cross-tab and visibility sync
  useRealtimeSync('projects', () => fetchProjectData(undefined, true));
  useRealtimeSync('milestones', () => fetchProjectData(undefined, true));
  useRealtimeSync('payments', () => fetchProjectData(undefined, true));

  const handleAddMilestone = async () => {
    if (!projectId || !user?.id || !newMilestone.title.trim()) return;
    setAddingMilestone(true);
    try {
      const amountLocal = newMilestone.amount ? parseFloat(newMilestone.amount) : 0;
      const rate = exchangeRates[userCurrency] || 1;
      const amountUSD = userCurrency === 'USD' ? amountLocal : parseFloat((amountLocal / rate).toFixed(8));

      // Check which columns exist in the project_milestones table
      const { data: milestoneCheck } = await supabase.from('project_milestones').select('*').limit(1);
      const existingMilestoneCols = milestoneCheck && milestoneCheck.length > 0 ? Object.keys(milestoneCheck[0]) : [];

      // Determine initial status: First milestone should be 'WAITING_FUNDS' (ready for payment)
      // while subsequent milestones should be 'LOCKED'.
      const initialStatus = milestones.length === 0 ? 'WAITING_FUNDS' : 'LOCKED';

      const milestoneInsert: any = {
        project_id: projectId,
        title: newMilestone.title,
        description: newMilestone.description || null,
        due_date: newMilestone.due_date || null,
        amount: amountUSD, // Store USD as primary truth
        created_by: user.id,
        sort_order: milestones.length,
        status: initialStatus
      };

      // Add extra currency columns only if they exist in DB
      if (existingMilestoneCols.includes('amount_usd')) milestoneInsert.amount_usd = amountUSD;
      if (existingMilestoneCols.includes('currency')) milestoneInsert.currency = userCurrency;
      if (existingMilestoneCols.includes('exchange_rate')) milestoneInsert.exchange_rate = rate;

      const {
        error
      } = await supabase.from('project_milestones').insert(milestoneInsert);
      if (error) throw error;
      toast.success("Milestone added!");
      setNewMilestone({
        title: "",
        description: "",
        due_date: "",
        amount: ""
      });
      broadcastRefresh('milestones');
      fetchProjectData(undefined, true);
    } catch (err: any) {
      toast.error(err.message || "Failed to add milestone");
    } finally {
      setAddingMilestone(false);
    }
  };
  const handleToggleMilestoneStatus = async (milestone: Milestone) => {
    // P1 Fix: Only clients should be able to mark a milestone as COMPLETED manually,
    // and only if it was already ACTIVE. Artists should use the submission workflow.
    if (!isClient) {
      toast.error("Only the client can manually approve milestones.");
      return;
    }

    if (milestone.status === 'LOCKED' || milestone.status === 'WAITING_FUNDS') {
      toast.error("Milestone must be funded and active before it can be completed.");
      return;
    }

    const nextStatus = milestone.status === 'COMPLETED' ? 'ACTIVE' : 'COMPLETED';
    const confirmed = window.confirm(`Are you sure you want to mark this milestone as ${nextStatus}? This bypasses the normal review workflow.`);
    if (!confirmed) return;

    try {
      const {
        error
      } = await supabase.from('project_milestones').update({
        status: nextStatus as any,
        approved_at: nextStatus === 'COMPLETED' ? new Date().toISOString() : null
      }).eq('id', milestone.id);
      
      if (error) throw error;
      
      // Log activity
      await supabase.from('project_activity_logs').insert({
        project_id: project!.id,
        milestone_id: milestone.id,
        user_id: user?.id,
        action: nextStatus === 'COMPLETED' ? 'milestone_approved' : 'milestone_started',
        details: { note: "Manually toggled status in detail modal" }
      });

      broadcastRefresh('milestones');
      fetchProjectData(undefined, true);
      toast.success(`Milestone marked as ${nextStatus}`);
    } catch (err: any) {
      toast.error("Failed to update milestone");
    }
  };
  const handleDeleteMilestone = async (milestone: Milestone) => {
    // P2 Fix: Add confirmation and state checks
    if (milestone.status !== 'LOCKED' && milestone.status !== 'WAITING_FUNDS') {
      toast.error("Cannot delete a milestone that is active, in review, or completed.");
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete the milestone "${milestone.title}"?`);
    if (!confirmed) return;

    try {
      const {
        error
      } = await supabase.from('project_milestones').delete().eq('id', milestone.id);
      if (error) throw error;
      toast.success("Milestone deleted");
      fetchProjectData(undefined, true);
    } catch (err: any) {
      toast.error("Failed to delete milestone");
    }
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId || !user?.id) return;
    setUploading(true);
    try {
      const fileName = `${user.id}/${projectId}/${Date.now()}-${file.name}`;
      const {
        error: uploadError
      } = await supabase.storage.from('project-files').upload(fileName, file);
      if (uploadError) throw uploadError;
      const {
        error: insertError
      } = await supabase.from('project_files').insert({
        project_id: projectId,
        uploader_id: user.id,
        storage_path: fileName,
        original_name: file.name,
        mime_type: file.type,
        size_bytes: file.size
      });
      if (insertError) throw insertError;
      toast.success("File uploaded!");
      fetchProjectData(undefined, true);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };
  const handleDownloadFile = async (file: ProjectFile) => {
    try {
      const {
        data,
        error
      } = await supabase.storage.from(file.storage_bucket).download(file.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error("Download failed");
    }
  };
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?.id || !project) return;
    setSendingMessage(true);
    try {
      let convId = conversationId;

      // Create conversation if it doesn't exist
      if (!convId && project.artist_id && project.client_id) {
        const {
          data: newConv,
          error: convError
        } = await supabase.from('conversations').insert({
          artist_id: project.artist_id,
          client_id: project.client_id,
          project_title: project.title
        }).select('id').single();
        if (convError) throw convError;
        convId = newConv.id;
        setConversationId(convId);
      }
      if (!convId) throw new Error("Could not create conversation");
      
      await rtSendMessage(convId, newMessage.trim());
      setNewMessage("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  // Use real progress from database, fallback to milestone-based calculation
  const completedMilestones = milestones.filter(m => m.status === 'COMPLETED').length;
  const milestoneProgress = milestones.length > 0 ? Math.round(completedMilestones / milestones.length * 100) : 0;
  const progress = project?.progress ?? milestoneProgress;
  
  const isArtist = user?.id === project?.artist_id;
  const isClient = user?.id === project?.client_id;

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-none w-screen h-screen max-h-none bg-background/95 backdrop-blur-xl border-none shadow-none flex flex-col items-center justify-center p-0 pt-[var(--safe-top)] pb-[var(--safe-bottom)] pl-[var(--safe-left)] pr-[var(--safe-right)]">
          <DialogHeader className="sr-only">
            <DialogTitle>Loading Project Details</DialogTitle>
            <DialogDescription>Please wait while we fetch the project details.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-primary animate-pulse" />
              </div>
            </div>
            <div className="space-y-2 text-center">
              <h3 className="text-lg font-bold tracking-tight">Loading Project...</h3>
              <p className="text-sm text-muted-foreground animate-pulse">Syncing latest updates from the cloud</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!project ? (
        <DialogContent className="pt-[var(--safe-top)] pb-[var(--safe-bottom)] pl-[var(--safe-left)] pr-[var(--safe-right)]">
          <DialogHeader className="sr-only">
            <DialogTitle>Project Not Found</DialogTitle>
            <DialogDescription>The requested project could not be located.</DialogDescription>
          </DialogHeader>
          <div className="p-8 text-center text-muted-foreground font-medium">
            <div className="mb-4 flex justify-center">
              <div className="p-4 rounded-full bg-muted">
                <FileText className="h-8 w-8 opacity-20" />
              </div>
            </div>
            Project not found
          </div>
        </DialogContent>
      ) : (
        <DialogContent className="max-w-none w-screen h-screen max-h-none overflow-hidden flex flex-col p-0 pt-[var(--safe-top)] pb-[var(--safe-bottom)] pl-[var(--safe-left)] pr-[var(--safe-right)] gap-0 border-none shadow-none bg-background backdrop-blur-2xl rounded-none">
          <DialogHeader className="sr-only">
            <DialogTitle>{project.title}</DialogTitle>
            <DialogDescription>Project details and collaboration workspace</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 h-full">
            <div className="flex flex-col min-h-full max-w-7xl mx-auto w-full relative border-x border-border/5">
            {/* Ultra Modern Header Section */}
            <div className="relative overflow-hidden pt-16 pb-10 px-6 sm:px-12 border-b bg-gradient-to-br from-primary/[0.07] via-background to-primary/[0.03]">
              {/* Abstract Background Shapes */}
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
              
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-8">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                      <GitBranch className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="px-3 py-1 rounded-full bg-background/50 backdrop-blur-md border-primary/20 text-primary font-bold tracking-wide uppercase text-[10px]">
                      Project ID: #{project.id.slice(0, 8)}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-full hover:bg-primary/10 text-primary/60 hover:text-primary transition-all ml-auto"
                      onClick={() => {
                        toast.info('Syncing latest updates...');
                        fetchProjectData(undefined, false);
                      }}
                    >
                      <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                  </div>
                  
                    <div className="space-y-1 sm:space-y-2">
                      <DialogTitle className="text-3xl sm:text-5xl font-black tracking-tight leading-tight sm:leading-[1.1] pb-2 bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground to-foreground/60">
                        {project.title}
                      </DialogTitle>
                    <div className="flex items-center gap-4 flex-wrap">
                      <Badge 
                        className={cn(
                          "px-4 py-1.5 rounded-full font-bold text-[11px] uppercase tracking-wider shadow-lg shadow-primary/5 transition-all duration-500",
                          project.status === 'accepted' ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 
                          project.status === 'pending' ? 'bg-amber-500 text-white hover:bg-amber-600' : 
                          'bg-primary text-white hover:bg-primary/90'
                        )}
                      >
                        {project.status}
                      </Badge>
                      <Separator orientation="vertical" className="h-4 bg-border/40" />
                      <Link 
                        to={user?.id === project.artist_id ? `/profile/${project.client_id}` : `/artist/${project.artist_id}`} 
                        className="flex items-center gap-2 group cursor-pointer"
                      >
                        <Avatar className="h-8 w-8 ring-2 ring-background ring-offset-2 ring-offset-primary/10 transition-transform group-hover:scale-110">
                          <AvatarImage src={user?.id === project.artist_id ? project.client_avatar : project.artist_avatar} />
                          <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                            {(user?.id === project.artist_id ? project.client_name : project.artist_name)?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-bold text-primary group-hover:text-foreground transition-colors">
                          {user?.id === project.artist_id ? project.client_name : project.artist_name}
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-start sm:items-end gap-3">
                  <div className="flex -space-x-3">
                    <Link to={`/artist/${project.artist_id}`}>
                      <Avatar className="h-10 w-10 ring-4 ring-background hover:scale-105 transition-transform">
                        <AvatarImage src={project.artist_avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">A</AvatarFallback>
                      </Avatar>
                    </Link>
                    <Link to={`/profile/${project.client_id}`}>
                      <Avatar className="h-10 w-10 ring-4 ring-background hover:scale-105 transition-transform">
                        <AvatarImage src={project.client_avatar} />
                        <AvatarFallback className="bg-amber-500/10 text-amber-600 font-bold">C</AvatarFallback>
                      </Avatar>
                    </Link>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 bg-muted/20 px-3 py-1 rounded-full">
                    Collaborative Workspace
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 sm:px-12 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="group relative p-8 rounded-[2.5rem] bg-white dark:bg-card/40 border border-border/50 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
                <div className="relative z-10 flex flex-col gap-6">
                  <div className="p-3 rounded-2xl bg-primary/10 text-primary w-fit group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60">Total Budget</p>
                    <h3 className="text-3xl font-black tracking-tighter text-foreground">
                      {project.amount_usd || project.budget ? 
                        formatCurrency(project.amount_usd || project.budget || 0, project.amount_usd ? 'USD' : (project.currency || 'USD'), project.exchange_rate) : 
                        'Not set'
                      }
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Escrow Protected</span>
                  </div>
                </div>
              </div>

              <div className="group relative p-8 rounded-[2.5rem] bg-white dark:bg-card/40 border border-border/50 hover:border-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/5 transition-all duration-500 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-amber-500/10 transition-colors" />
                <div className="relative z-10 flex flex-col gap-6">
                  <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 w-fit group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60">Target Deadline</p>
                    <h3 className="text-3xl font-black tracking-tighter text-foreground">
                      {project.deadline ? formatDate(new Date(project.deadline), 'MMM dd, yyyy') : 'Flex Timeline'}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {project.deadline ? `${Math.ceil((new Date(project.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} Days Remaining` : 'No set deadline'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="group relative p-8 rounded-[2.5rem] bg-white dark:bg-card/40 border border-border/50 hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/5 transition-all duration-500 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-colors" />
                <div className="relative z-10 flex flex-col gap-6">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 w-fit group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-end">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60">Project Progress</p>
                      <span className="text-lg font-black text-emerald-600">{progress}%</span>
                    </div>
                    <div className="h-3 bg-emerald-500/10 rounded-full overflow-hidden mt-2">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)]" 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{completedMilestones} of {milestones.length} Milestones Done</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 sm:px-12 pb-12 space-y-12">
              {/* Description Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-1 bg-primary/20 rounded-full" />
                  <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Project Overview</h4>
                </div>
                <div className="group relative p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] bg-muted/10 border border-border/30 hover:bg-muted/20 transition-all duration-500">
                  <div className="absolute top-8 left-0 w-1.5 h-12 bg-primary/40 rounded-r-full group-hover:h-24 transition-all duration-500" />
                  <p className="text-base sm:text-lg leading-relaxed text-foreground/80 whitespace-pre-wrap font-medium pl-4">
                    {project.description || 'No description provided for this project. Use the communication tab to discuss requirements with your collaborator.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Enhanced Sticky Navigation */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="relative z-10 -mx-6 sm:-mx-12 px-6 sm:px-12 pt-6 pb-8 bg-background border-b border-border/40 mb-8">
                  <div className="relative group/tabs">
                    {/* Scroll Gradient Indicators */}
                    <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 opacity-0 group-hover/tabs:opacity-100 transition-opacity pointer-events-none" />
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 opacity-0 group-hover/tabs:opacity-100 transition-opacity pointer-events-none" />
                    
                    <TabsList className="w-full h-auto min-h-[52px] sm:min-h-0 p-1.5 sm:p-2 bg-muted/50 rounded-[2rem] border border-border/40 flex items-stretch gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth shadow-inner">
                    <TabsTrigger 
                      value="workflow" 
                      onClick={() => scrollToTab('workflow')}
                      className="flex-1 min-w-[90px] sm:min-w-[140px] py-2.5 sm:py-4 px-3 sm:px-6 rounded-[1.2rem] sm:rounded-[1.5rem] data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xl data-[state=active]:shadow-primary/10 transition-all duration-500 min-h-[44px] sm:min-h-[56px] gap-1.5 sm:gap-3 group"
                    >
                      <GitBranch className="h-4 w-4 sm:h-5 sm:w-5 group-data-[state=active]:scale-110 sm:group-data-[state=active]:scale-125 transition-transform duration-500" />
                      <span className="font-black tracking-tight uppercase text-[9px] sm:text-[11px]">Workflow</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="milestones" 
                      onClick={() => scrollToTab('milestones')}
                      className="flex-1 min-w-[90px] sm:min-w-[140px] py-2.5 sm:py-4 px-3 sm:px-6 rounded-[1.2rem] sm:rounded-[1.5rem] data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xl data-[state=active]:shadow-primary/10 transition-all duration-500 min-h-[44px] sm:min-h-[56px] gap-1.5 sm:gap-3 group"
                    >
                      <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 group-data-[state=active]:scale-110 sm:group-data-[state=active]:scale-125 transition-transform duration-500" />
                      <span className="font-black tracking-tight uppercase text-[9px] sm:text-[11px]">Timeline</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="files" 
                      onClick={() => scrollToTab('files')}
                      className="flex-1 min-w-[90px] sm:min-w-[140px] py-2.5 sm:py-4 px-3 sm:px-6 rounded-[1.2rem] sm:rounded-[1.5rem] data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xl data-[state=active]:shadow-primary/10 transition-all duration-500 min-h-[44px] sm:min-h-[56px] gap-1.5 sm:gap-3 group"
                    >
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 group-data-[state=active]:scale-110 sm:group-data-[state=active]:scale-125 transition-transform duration-500" />
                      <span className="font-black tracking-tight uppercase text-[9px] sm:text-[11px]">Vault</span>
                      <Badge variant="secondary" className="px-1 sm:px-2 py-0 h-3.5 sm:h-5 min-w-[14px] sm:min-w-[20px] text-[7px] sm:text-[10px] rounded-full bg-primary/10 text-primary border-none font-black">
                        {files.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="communication" 
                      onClick={() => scrollToTab('communication')}
                      className="flex-1 min-w-[90px] sm:min-w-[140px] py-2.5 sm:py-4 px-3 sm:px-6 rounded-[1.2rem] sm:rounded-[1.5rem] data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xl data-[state=active]:shadow-primary/10 transition-all duration-500 min-h-[44px] sm:min-h-[56px] gap-1.5 sm:gap-3 group"
                    >
                      <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 group-data-[state=active]:scale-110 sm:group-data-[state=active]:scale-125 transition-transform duration-500" />
                      <span className="font-black tracking-tight uppercase text-[9px] sm:text-[11px] whitespace-nowrap">Chat</span>
                      {rtMessages.length > 0 && (
                        <div className="h-1 w-1 sm:h-2 sm:w-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                      )}
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>

              <div className="space-y-12 pb-12">
                <TabsContent id="project-tab-content-workflow" value="workflow" className="mt-0 outline-none focus-visible:ring-0">
                  <div className="rounded-[2.5rem] border border-border/40 bg-white/40 dark:bg-card/20 p-4 sm:p-8 shadow-sm transition-all duration-500 hover:shadow-md">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-3 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                        <GitBranch className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold tracking-tight">Project Workflow</h3>
                        <p className="text-sm text-muted-foreground">Track real-time progress and phase completion.</p>
                      </div>
                    </div>
                    <MilestoneWorkflow projectId={projectId!} />
                  </div>
                </TabsContent>

                <TabsContent id="project-tab-content-milestones" value="milestones" className="mt-0 outline-none focus-visible:ring-0">
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600">
                          <CheckCircle className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold tracking-tight">Project Milestones</h3>
                          <p className="text-sm text-muted-foreground">Manage deliverables and payment phases.</p>
                        </div>
                      </div>
                    </div>

                    {milestones.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 rounded-[2.5rem] border-2 border-dashed border-border/40 bg-muted/5 transition-all hover:bg-muted/10">
                        <div className="p-6 rounded-full bg-muted/20 animate-pulse">
                          <CheckCircle className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                        <div className="space-y-2 max-w-xs">
                          <p className="text-xl font-bold tracking-tight">Ready to start?</p>
                          <p className="text-sm text-muted-foreground">Add your first milestone to begin tracking the project progress.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:gap-6">
                        {milestones.map((milestone, idx) => (
                          <div 
                            key={milestone.id} 
                            className="group p-6 rounded-[2rem] border transition-all duration-500 relative overflow-hidden bg-white dark:bg-card/40 border-border/50 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                              <div className="flex gap-5">
                                <div className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 bg-primary/5 text-primary border border-primary/10">
                                  {String(idx + 1).padStart(2, '0')}
                                </div>
                                <div className="space-y-2 pt-1">
                                  <h5 className="font-bold text-xl leading-tight tracking-tight group-hover:text-primary transition-colors">{milestone.title}</h5>
                                  {milestone.description && (
                                    <p className="text-sm text-muted-foreground/90 leading-relaxed max-w-2xl">{milestone.description}</p>
                                  )}
                                  
                                  <div className="flex items-center gap-2">
                                    {milestone.status === 'COMPLETED' ? (
                                      <div className="flex items-center gap-2 py-1.5 px-4 rounded-full bg-emerald-500/10 text-emerald-600 text-[11px] font-bold uppercase tracking-wider">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        <span>Completed</span>
                                      </div>
                                    ) : milestone.status === 'ACTIVE' ? (
                                      <div className="flex items-center gap-2 py-1.5 px-4 rounded-full bg-blue-500/10 text-blue-600 text-[11px] font-bold uppercase tracking-wider">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        <span>In Progress</span>
                                      </div>
                                    ) : milestone.status === 'WAITING_FUNDS' ? (
                                      <div className="flex items-center gap-2 py-1.5 px-4 rounded-full bg-amber-500/10 text-amber-600 text-[11px] font-bold uppercase tracking-wider border border-amber-500/20">
                                        <Clock className="h-3.5 w-3.5" />
                                        <span>Awaiting Funds</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 py-1.5 px-4 rounded-full bg-muted text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
                                        <Lock className="h-3.5 w-3.5" />
                                        <span>{milestone.status || 'Locked'}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {isClient && (milestone.status === 'ACTIVE' || milestone.status === 'COMPLETED') && (
                                  <Button 
                                    onClick={() => handleToggleMilestoneStatus(milestone)}
                                    size="sm"
                                    variant="outline"
                                    className="rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-primary/5 h-10 px-4"
                                  >
                                    {milestone.status === 'COMPLETED' ? 'Mark Active' : 'Mark Done'}
                                  </Button>
                                )}
                                {isClient && milestone.status === 'WAITING_FUNDS' && (
                                  <Button 
                                    variant="link" 
                                    onClick={() => setActiveTab('workflow')} 
                                    className="h-auto p-0 text-[10px] font-black uppercase text-primary hover:underline px-4"
                                  >
                                    Pay in Workflow
                                  </Button>
                                )}
                                {isClient && (milestone.status === 'LOCKED' || milestone.status === 'WAITING_FUNDS') && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteMilestone(milestone)}
                                    className="text-muted-foreground hover:text-destructive transition-colors h-10 w-10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="p-8 rounded-[2.5rem] bg-muted/5 border-2 border-dashed border-border/30 mt-8">
                      <div className="flex flex-col gap-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Plus className="h-4 w-4" />
                          </div>
                          <h4 className="font-bold text-lg tracking-tight">Add New Milestone</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <Input 
                            placeholder="Milestone Title" 
                            value={newMilestone.title} 
                            onChange={e => setNewMilestone(prev => ({ ...prev, title: e.target.value }))} 
                            className="h-12 rounded-xl bg-background border-border/40"
                          />
                          <Input 
                            type="number" 
                            placeholder={`Amount (${userCurrencySymbol})`} 
                            value={newMilestone.amount} 
                            onChange={e => setNewMilestone(prev => ({ ...prev, amount: e.target.value }))} 
                            className="h-12 rounded-xl bg-background border-border/40"
                          />
                          <Input 
                            type="date" 
                            value={newMilestone.due_date} 
                            onChange={e => setNewMilestone(prev => ({ ...prev, due_date: e.target.value }))} 
                            className="h-12 rounded-xl bg-background border-border/40"
                          />
                          <Button 
                            onClick={handleAddMilestone} 
                            disabled={addingMilestone || !newMilestone.title.trim()}
                            className="h-12 rounded-xl bg-primary hover:bg-primary/90 font-bold uppercase tracking-wider shadow-lg shadow-primary/20"
                          >
                            {addingMilestone ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Milestone'}
                          </Button>
                        </div>
                        <Textarea 
                          placeholder="Description (Optional)" 
                          value={newMilestone.description} 
                          onChange={e => setNewMilestone(prev => ({ ...prev, description: e.target.value }))} 
                          className="min-h-[80px] rounded-xl bg-background border-border/40"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent id="project-tab-content-files" value="files" className="mt-0 outline-none focus-visible:ring-0">
                  <div className="space-y-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600">
                          <FileText className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold tracking-tight">Shared Assets</h3>
                          <p className="text-sm text-muted-foreground">Deliverables, references, and project files.</p>
                        </div>
                      </div>
                      
                      <label className="cursor-pointer group">
                        <div className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all duration-300 font-bold shadow-sm active:scale-95">
                          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Upload className="h-5 w-5" /> <span>Upload</span></>}
                        </div>
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {files.length === 0 ? (
                        <div className="col-span-full py-16 text-center rounded-[2.5rem] border-2 border-dashed border-border/40 bg-muted/5 transition-all hover:bg-muted/10">
                          <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                          <p className="text-muted-foreground font-medium">No files have been shared yet.</p>
                        </div>
                      ) : (
                        files.map(file => (
                          <div key={file.id} className="group p-5 rounded-[2rem] border bg-white dark:bg-card/40 border-border/50 hover:border-primary/30 hover:shadow-xl transition-all duration-500 flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                              <FileText className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <div className="flex-1 min-w-0 pt-1">
                              <p className="font-bold text-sm truncate mb-1">{file.original_name}</p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                {file.size_bytes ? `${(file.size_bytes / 1024).toFixed(1)} KB` : '?? KB'} • {formatDate(new Date(file.created_at), 'MMM d')}
                              </p>
                              <div className="flex gap-2 mt-4">
                                <Button variant="secondary" size="sm" className="h-10 rounded-xl px-4 font-bold text-[10px] uppercase tracking-wider hover:bg-primary hover:text-white transition-all" onClick={() => handleDownloadFile(file)}>
                                  Download
                                </Button>
                                {file.uploader_id === user?.id && (
                                  <></>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent id="project-tab-content-communication" value="communication" className="mt-0 outline-none focus-visible:ring-0">
                  <div className="rounded-[2.5rem] border border-border/40 bg-white/40 dark:bg-card/20 overflow-hidden flex flex-col shadow-sm transition-all duration-500 hover:shadow-md h-[650px]">
                    <div className="p-4 sm:p-5 border-b border-border/40 bg-muted/5 flex items-center gap-3 shrink-0">
                      <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold tracking-tight">Project Discussion</h3>
                        <p className="text-[11px] text-muted-foreground">Direct communication for this project.</p>
                      </div>
                    </div>

                    <ScrollArea className="flex-1 p-4 sm:p-5 h-full" id="chat-scroll-area">
                      <div className="space-y-6 pb-4">
                        {rtMessages.length === 0 ? (
                          <div className="py-20 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mx-auto">
                              <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                            <p className="text-muted-foreground font-medium max-w-[200px] mx-auto">No messages yet. Send a quick update to get started!</p>
                          </div>
                        ) : (
                          rtMessages.map(msg => {
                            const isMe = msg.senderId === user?.id;
                            const isArtistMsg = msg.senderId === project?.artist_id;
                            
                            const senderName = isArtistMsg ? project?.artist_name : project?.client_name;
                            const senderAvatar = isArtistMsg ? project?.artist_avatar : project?.client_avatar;
                            
                            return (
                              <div key={msg.id} className={`flex gap-4 group ${isMe ? 'flex-row-reverse' : ''}`}>
                                <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm flex-shrink-0 group-hover:scale-110 transition-transform">
                                  <AvatarImage src={senderAvatar || ''} />
                                  <AvatarFallback className="bg-primary/10 text-primary font-bold">{senderName?.charAt(0) || 'U'}</AvatarFallback>
                                </Avatar>
                                
                                <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                                  <div className="flex items-baseline gap-2 mb-1.5 px-1">
                                    <span className="text-[11px] font-bold tracking-tight text-foreground/80">{senderName}</span>
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                                      {formatDate(msg.timestamp, 'MMM d, h:mm a')}
                                    </span>
                                  </div>
                                  <div className={`px-5 py-3 rounded-[1.5rem] text-sm shadow-sm font-medium ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none shadow-primary/20' : 'bg-white dark:bg-card border border-border/50 rounded-tl-none'} transition-all group-hover:shadow-md`}>
                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div className="h-2" />
                      </div>
                    </ScrollArea>

                    <div className="p-4 sm:p-5 bg-muted/5 border-t border-border/40 shrink-0">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1 group">
                          <Textarea 
                            placeholder="Type your update or question here..." 
                            value={newMessage} 
                            onChange={e => setNewMessage(e.target.value)} 
                            className="min-h-[44px] sm:min-h-[50px] resize-none rounded-2xl bg-white dark:bg-card border-border/40 focus:ring-primary/10 focus:border-primary/30 p-3.5 text-sm transition-all shadow-inner hover:border-primary/30" 
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }} 
                          />
                        </div>
                        <div className="flex sm:flex-col justify-end gap-3">
                          <Button 
                            onClick={handleSendMessage} 
                            disabled={sendingMessage || !newMessage.trim()}
                            className="flex-1 sm:flex-none h-12 sm:w-12 rounded-xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all active:scale-95 group"
                            size="icon"
                          >
                            {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-5 w-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
      )}
    </Dialog>
  );
};
export default ProjectDetailModal;
