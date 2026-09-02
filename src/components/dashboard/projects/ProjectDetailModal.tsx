import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { FileText, MessageSquare, CheckCircle, Upload, Calendar, User, Clock, Plus, Trash2, Loader2, Download, GitBranch, DollarSign, SendHorizontal, Lock, RotateCcw, AlertTriangle, Image as ImageIcon, Film, Music, FileArchive } from "lucide-react";
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
import { uploadFileWithProgress } from "@/lib/uploadWithProgress";
import MessageBubble from "@/components/shared/MessageBubble";
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
  amount?: number | null;
  amount_usd?: number | null;
  exchange_rate?: number | null;
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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
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

  const handleOpenChange = (open: boolean) => {
    if (!open) setActiveTab('workflow');
    onOpenChange(open);
  };
  const [confirmAction, setConfirmAction] = useState<{
    type: 'delete_milestone';
    milestone: Milestone;
  } | null>(null);
  const modalViewportRef = useRef<HTMLDivElement | null>(null);

  const scrollToTab = (tabId: string) => {
    setActiveTab(tabId);
    requestAnimationFrame(() => {
      // 'instant' overrides the viewport's CSS scroll-smooth so switching
      // tabs doesn't trigger a long animated scroll through the page.
      modalViewportRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    });
  };

  useEffect(() => {
    if (conversationId && conversationId !== activeConversationId) {
      setActiveConversationId(conversationId);
    }
  }, [conversationId, activeConversationId, setActiveConversationId]);

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
      if (
        err?.name === 'AbortError' ||
        err?.code === 'ABORT' ||
        err?.message?.includes('AbortError') ||
        err?.message?.includes('signal is aborted') ||
        err?.message?.includes('Failed to fetch')
      ) return;
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

  useEffect(() => {
    if (!open || activeTab !== 'communication') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, activeTab]);

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
  const handleDeleteMilestone = async (milestone: Milestone) => {
    // P2 Fix: Add confirmation and state checks
    if (milestone.status !== 'LOCKED' && milestone.status !== 'WAITING_FUNDS') {
      toast.error("Cannot delete a milestone that is active, in review, or completed.");
      return;
    }

    setConfirmAction({ type: 'delete_milestone', milestone });
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    const { milestone } = confirmAction;
    setConfirmAction(null);

    try {
      const { error } = await supabase.from('project_milestones').delete().eq('id', milestone.id);
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
    setUploadProgress(0);
    setUploadFileName(file.name);
    try {
      const fileName = `${user.id}/${projectId}/${Date.now()}-${file.name}`;
      await uploadFileWithProgress({
        bucket: 'project-files',
        path: fileName,
        file,
        onProgress: ({ percent }) => setUploadProgress(percent),
      });
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
      setUploadProgress(null);
      setUploadFileName(null);
      // Reset the input so re-uploading the same file fires onChange.
      e.target.value = '';
    }
  };
  const getFileTypeIcon = (mimeType: string | null) => {
    if (!mimeType) return FileText;
    if (mimeType.startsWith('image/')) return ImageIcon;
    if (mimeType.startsWith('video/')) return Film;
    if (mimeType.startsWith('audio/')) return Music;
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return FileArchive;
    return FileText;
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
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-none w-screen h-[100dvh] max-h-none bg-background/95 backdrop-blur-xl border-none shadow-none flex flex-col items-center justify-center p-0 pt-[var(--safe-top)] pb-[var(--safe-bottom)] pl-[var(--safe-left)] pr-[var(--safe-right)]">
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
        <DialogContent className="max-w-none w-screen h-[100dvh] max-h-none overflow-hidden overflow-y-hidden flex flex-col p-0 pt-[var(--safe-top)] pb-[var(--safe-bottom)] pl-[var(--safe-left)] pr-[var(--safe-right)] gap-0 border-none shadow-none bg-background backdrop-blur-2xl rounded-none z-[200]">
          <DialogHeader className="sr-only">
            <DialogTitle>{project.title}</DialogTitle>
            <DialogDescription>Project details and collaboration workspace</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 h-full" viewportRef={modalViewportRef}>
            {/* One continuous stacked card on a page ground, per the design:
                header → stat strip → overview → tabs. Sections share edges, so
                each declares its own borders rather than sitting in a grid of
                separate rounded cards. */}
            {/* No `w-full` here: index.css carries a global
                `.w-full { max-width: 100% !important }` that would override
                max-w-2xl and stretch this to the viewport. A block div is
                full-width by default anyway. */}
            <div className="mx-auto flex min-h-full max-w-2xl flex-col px-3 py-4 sm:px-4 sm:py-8">
            {/* Header */}
            <div className="rounded-t-2xl sm:rounded-t-3xl border border-b-0 border-border/60 bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-background px-5 pt-5 pb-5 sm:px-7 sm:pt-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <GitBranch className="h-[15px] w-[15px]" />
                  </div>
                  <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Project ID: #{project.id.slice(0, 8)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  <div className="hidden -space-x-2 sm:flex">
                    <Link to={`/artist/${project.artist_id}`} aria-label="View artist profile">
                      <Avatar className="h-[30px] w-[30px] ring-2 ring-background transition-transform hover:scale-105">
                        <AvatarImage src={project.artist_avatar} />
                        <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">A</AvatarFallback>
                      </Avatar>
                    </Link>
                    <Link to={`/profile/${project.client_id}`} aria-label="View client profile">
                      <Avatar className="h-[30px] w-[30px] ring-2 ring-background transition-transform hover:scale-105">
                        <AvatarImage src={project.client_avatar} />
                        <AvatarFallback className="bg-warning-muted text-[11px] font-semibold text-warning">C</AvatarFallback>
                      </Avatar>
                    </Link>
                  </div>
                  <span className="hidden text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 lg:inline">
                    Collaborative Workspace
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Refresh project"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    onClick={() => {
                      toast.info('Syncing latest updates...');
                      fetchProjectData(undefined, false);
                    }}
                  >
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <DialogTitle className="text-xl font-bold leading-tight tracking-tight text-foreground sm:text-[26px]">
                  {project.title}
                </DialogTitle>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                    project.status === 'accepted' ? 'bg-success-muted text-success' :
                    project.status === 'pending' ? 'bg-warning-muted text-warning' :
                    'bg-primary/10 text-primary'
                  )}
                >
                  {project.status}
                </span>
              </div>
              <Link
                to={user?.id === project.artist_id ? `/profile/${project.client_id}` : `/artist/${project.artist_id}`}
                className="group inline-flex items-center gap-2"
              >
                <Avatar className="h-5 w-5">
                  <AvatarImage src={user?.id === project.artist_id ? project.client_avatar : project.artist_avatar} />
                  <AvatarFallback className="bg-primary/5 text-[9px] font-semibold text-primary">
                    {(user?.id === project.artist_id ? project.client_name : project.artist_name)?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[13px] font-medium text-primary group-hover:underline">
                  {user?.id === project.artist_id ? project.client_name : project.artist_name}
                </span>
              </Link>
            </div>

            {/* Stat strip. Three panes sharing hairline dividers rather than
                separate floating cards — `gap-px` over a border-coloured
                background paints the dividers. Stacks on the narrowest
                screens so the values never truncate. */}
            <div className="grid grid-cols-1 gap-px border-x border-border/60 bg-border/60 md:grid-cols-3">
              <div className="bg-card px-5 py-4 sm:px-6 sm:py-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="grid h-6 w-6 place-items-center rounded-lg bg-primary/10 text-primary">
                    <DollarSign className="h-3 w-3" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Budget</span>
                </div>
                <div className="truncate text-lg font-bold tracking-tight text-foreground sm:text-[22px]">
                  {project.amount_usd || project.budget
                    ? formatCurrency(project.amount_usd || project.budget || 0, project.amount_usd ? 'USD' : (project.currency || 'USD'), project.exchange_rate)
                    : 'Not set'}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-success" />
                  <span className="text-[11px] font-medium text-muted-foreground/70">Escrow Protected</span>
                </div>
              </div>

              <div className="bg-card px-5 py-4 sm:px-6 sm:py-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="grid h-6 w-6 place-items-center rounded-lg bg-warning-muted text-warning">
                    <Calendar className="h-3 w-3" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Deadline</span>
                </div>
                <div className="truncate text-lg font-bold tracking-tight text-foreground sm:text-[22px]">
                  {project.deadline ? formatDate(new Date(project.deadline), 'MMM dd') : 'Flexible'}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Clock className="h-[11px] w-[11px] shrink-0 text-warning" aria-hidden="true" />
                  <span className="truncate text-[11px] font-medium text-muted-foreground/70">
                    {project.deadline ? (() => {
                      const daysLeft = Math.ceil((new Date(project.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                      if (daysLeft < 0) return `${Math.abs(daysLeft)}d overdue`;
                      if (daysLeft === 0) return 'Due today';
                      return `${daysLeft}d left`;
                    })() : 'No deadline set'}
                  </span>
                </div>
              </div>

              <div className="bg-card px-5 py-4 sm:px-6 sm:py-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-success-muted text-success">
                      <CheckCircle className="h-3 w-3" />
                    </div>
                    <span className="truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Progress</span>
                  </div>
                  <span className="shrink-0 text-[15px] font-bold text-success tabular-nums">{progress}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-foreground/[0.07]">
                  <div
                    className="h-full rounded-full bg-success transition-all duration-700 ease-apple"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-2 text-[11px] font-medium text-muted-foreground/70">
                  {completedMilestones} of {milestones.length} milestones done
                </div>
              </div>
            </div>

            {/* Project overview — centred rule label, then a thin accent bar
                beside the copy, per the design. */}
            <div className="border-x border-t border-border/60 bg-card px-5 py-5 sm:px-7 sm:py-6">
              <div className="mb-4 flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                <div className="h-px flex-1 bg-border/60" />
                Project Overview
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <div className="flex gap-3">
                <div className="w-0.5 shrink-0 self-stretch rounded-full bg-primary/45" />
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {project.description || 'No description provided for this project. Use the chat tab to discuss requirements with your collaborator.'}
                </p>
              </div>
            </div>

            {/* Tabs — compact segmented control closing the stacked card. */}
              <Tabs value={activeTab} onValueChange={scrollToTab} className="w-full rounded-b-2xl border border-border/60 bg-card px-4 pb-6 pt-5 shadow-token-xs sm:rounded-b-3xl sm:px-6">
                <TabsList className="flex h-auto w-full items-stretch gap-0.5 rounded-2xl border border-border/60 bg-card p-1.5 shadow-token-xs">
                  {([
                    { value: 'workflow', label: 'Workflow', Icon: GitBranch },
                    { value: 'milestones', label: 'Timeline', Icon: CheckCircle },
                    { value: 'files', label: 'Vault', Icon: FileText },
                    { value: 'communication', label: 'Chat', Icon: MessageSquare },
                  ] as const).map(({ value, label, Icon }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      onClick={() => scrollToTab(value)}
                      aria-label={label}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[12.5px] font-medium tracking-[0.02em] text-muted-foreground transition-colors data-[state=active]:bg-primary/10 data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {/* Labels drop below sm so four tabs never truncate to
                          single letters; the icon plus aria-label carries it. */}
                      <span className="hidden truncate sm:inline">{label}</span>
                      {value === 'files' && (
                        <span className="ml-0.5 shrink-0 rounded-full bg-foreground/[0.07] px-1.5 py-px text-[10px] font-bold tabular-nums text-muted-foreground">
                          {files.length}
                        </span>
                      )}
                      {value === 'communication' && rtMessages.length > 0 && (
                        <span className="ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>

              <div className="mt-6 pb-2">
                <TabsContent id="project-tab-content-workflow" value="workflow" className="mt-0 outline-none focus-visible:ring-0">
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <GitBranch className="h-[17px] w-[17px]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-semibold tracking-tight">Project Workflow</h3>
                        <p className="text-[13px] text-muted-foreground">Track real-time progress and phase completion.</p>
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
                      <div className="flex flex-col items-center justify-center py-10 sm:py-20 text-center space-y-4 sm:space-y-6 rounded-2xl sm:rounded-[2.5rem] border-2 border-dashed border-border/40 bg-muted/5 transition-all hover:bg-muted/10">
                        <div className="p-4 sm:p-6 rounded-full bg-muted/20 animate-pulse">
                          <CheckCircle className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground/30" />
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
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6">
                              <div className="flex gap-3 sm:gap-5">
                                <div className="flex-shrink-0 w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center font-bold text-sm sm:text-lg shadow-inner bg-primary/5 text-primary border border-primary/10">
                                  {idx + 1}
                                </div>
                                <div className="space-y-1.5 sm:space-y-2 pt-0.5">
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <h5 className="font-bold text-base sm:text-xl leading-tight tracking-tight group-hover:text-primary transition-colors">{milestone.title}</h5>
                                    {(milestone.amount_usd || milestone.amount) != null && (
                                      <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary font-bold text-[11px] px-3 py-0.5">
                                        {formatCurrency(milestone.amount_usd ?? milestone.amount ?? 0, milestone.amount_usd ? 'USD' : (project.currency || 'USD'), milestone.exchange_rate ?? project.exchange_rate)}
                                      </Badge>
                                    )}
                                  </div>
                                  {milestone.description && (
                                    <p className="text-sm text-muted-foreground/90 leading-relaxed max-w-2xl">{milestone.description}</p>
                                  )}
                                  {milestone.due_date && (
                                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground/70">
                                      <Calendar className="h-3 w-3" />
                                      <span>Due {formatDate(new Date(milestone.due_date), 'MMM d, yyyy')}</span>
                                    </div>
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
                                    ) : milestone.status === 'REVIEW_PENDING' ? (
                                      <div className="flex items-center gap-2 py-1.5 px-4 rounded-full bg-indigo-500/10 text-indigo-600 text-[11px] font-bold uppercase tracking-wider border border-indigo-500/20">
                                        <Upload className="h-3.5 w-3.5" />
                                        <span>Review Pending</span>
                                      </div>
                                    ) : milestone.status === 'REVISION_REQUESTED' ? (
                                      <div className="flex items-center gap-2 py-1.5 px-4 rounded-full bg-orange-500/10 text-orange-600 text-[11px] font-bold uppercase tracking-wider border border-orange-500/20">
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        <span>Revision Requested</span>
                                      </div>
                                    ) : milestone.status === 'DISPUTED' ? (
                                      <div className="flex items-center gap-2 py-1.5 px-4 rounded-full bg-red-500/10 text-red-600 text-[11px] font-bold uppercase tracking-wider border border-red-500/20">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        <span>Disputed</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 py-1.5 px-4 rounded-full bg-muted text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
                                        <Lock className="h-3.5 w-3.5" />
                                        <span>Locked</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {isClient && milestone.status === 'WAITING_FUNDS' && (
                                  <Button
                                    variant="link"
                                    onClick={() => setActiveTab('workflow')}
                                    className="h-auto p-0 text-[10px] font-bold uppercase text-primary hover:underline px-4"
                                  >
                                    Pay in Workflow
                                  </Button>
                                )}
                                {(isClient || isArtist) && (
                                  milestone.status === 'REVIEW_PENDING' ||
                                  milestone.status === 'REVISION_REQUESTED' ||
                                  milestone.status === 'DISPUTED'
                                ) && (
                                  <Button
                                    variant="link"
                                    onClick={() => setActiveTab('workflow')}
                                    className="h-auto p-0 text-[10px] font-bold uppercase text-primary hover:underline px-4"
                                  >
                                    {milestone.status === 'REVIEW_PENDING' && isClient ? 'Review in Workflow' : 'View in Workflow'}
                                  </Button>
                                )}
                                {isClient && (milestone.status === 'LOCKED' || milestone.status === 'WAITING_FUNDS') && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Delete milestone" onClick={() => handleDeleteMilestone(milestone)}
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

                    <div className="p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] bg-muted/5 border-2 border-dashed border-border/30 mt-6 sm:mt-8">
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
                            disabled={!newMilestone.title.trim()}
                            loading={addingMilestone}
                            className="h-12 rounded-xl bg-primary hover:bg-primary/90 font-bold uppercase tracking-wider shadow-lg shadow-primary/20"
                          >
                            {!addingMilestone && 'Create Milestone'}
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
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600">
                          <FileText className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xl font-bold tracking-tight">Shared Assets</h3>
                          <p className="text-sm text-muted-foreground">Deliverables, references, and project files.</p>
                        </div>
                      </div>
                      
                      <label className="cursor-pointer group w-full sm:w-auto">
                        <div className="flex h-11 w-full sm:w-auto items-center justify-center gap-2.5 px-5 rounded-2xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 font-bold shadow-sm active:scale-95">
                          {uploading ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span className="tabular-nums">
                                {uploadProgress !== null ? `${uploadProgress}%` : 'Uploading…'}
                              </span>
                            </>
                          ) : (
                            <><Upload className="h-5 w-5" /> <span>Upload</span></>
                          )}
                        </div>
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                      </label>
                    </div>

                    {uploading && uploadProgress !== null && (
                      <div className="space-y-1.5 px-1">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="truncate max-w-[70%] font-medium">{uploadFileName}</span>
                          <span className="font-mono tabular-nums">{uploadProgress}%</span>
                        </div>
                        <Progress value={uploadProgress} className="h-1" aria-label="File upload progress" />
                      </div>
                    )}



                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {files.length === 0 ? (
                        <div className="col-span-full py-16 text-center rounded-[2.5rem] border-2 border-dashed border-border/40 bg-muted/5 transition-all hover:bg-muted/10">
                          <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                          <p className="text-muted-foreground font-medium">No files have been shared yet.</p>
                        </div>
                      ) : (
                        files.map(file => {
                          const FileIcon = getFileTypeIcon(file.mime_type);
                          const sizeLabel = file.size_bytes
                            ? file.size_bytes >= 1024 * 1024
                              ? `${(file.size_bytes / 1024 / 1024).toFixed(1)} MB`
                              : `${(file.size_bytes / 1024).toFixed(1)} KB`
                            : '?? KB';
                          return (
                            <div key={file.id} className="group p-5 rounded-[2rem] border bg-white dark:bg-card/40 border-border/50 hover:border-primary/30 hover:shadow-xl transition-all duration-500 flex items-start gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center group-hover:bg-primary/5 transition-colors shrink-0">
                                <FileIcon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                              </div>
                              <div className="flex-1 min-w-0 pt-1">
                                <p className="font-bold text-sm truncate mb-1">{file.original_name}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">
                                  {sizeLabel} • {formatDate(new Date(file.created_at), 'MMM d')}
                                </p>
                                <div className="flex gap-2 mt-4">
                                  <Button variant="secondary" size="sm" className="h-10 rounded-xl px-4 font-bold text-[10px] uppercase tracking-wider hover:bg-primary hover:text-primary-foreground transition-all" onClick={() => handleDownloadFile(file)}>
                                    <Download className="h-3.5 w-3.5 mr-1.5" />
                                    Download
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent id="project-tab-content-communication" value="communication" className="mt-0 outline-none focus-visible:ring-0">
                  <div className="absolute inset-0 h-full z-[10] bg-background flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 ease-apple overscroll-contain">
                    <div className="px-3 sm:px-6 py-2.5 border-b border-border/40 bg-white/90 dark:bg-card/80 backdrop-blur-xl flex items-center gap-3 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setActiveTab('workflow')}
                        className="h-9 w-9 rounded-full -ml-2 shrink-0"
                        aria-label="Back to project"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                      </Button>
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={isArtist ? project?.client_avatar : project?.artist_avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {(isArtist ? project?.client_name : project?.artist_name)?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[15px] font-semibold tracking-tight leading-none truncate">
                          {isArtist ? project?.client_name : project?.artist_name}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-1 truncate">{project?.title}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenChange(false)}
                        className="h-9 w-9 rounded-full shrink-0"
                        aria-label="Close"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </Button>
                    </div>

                    <ScrollArea className="flex-1 min-h-0 px-4 sm:px-6 py-4" id="chat-scroll-area">
                      <div className="space-y-1 pb-2 max-w-3xl mx-auto w-full">
                        {rtMessages.length === 0 ? (
                          <div className="py-20 text-center space-y-3">
                            <div className="w-14 h-14 rounded-full bg-muted/30 flex items-center justify-center mx-auto">
                              <MessageSquare className="h-7 w-7 text-muted-foreground/40" />
                            </div>
                            <p className="text-sm text-muted-foreground max-w-[220px] mx-auto">No messages yet. Send a quick update to get started.</p>
                          </div>
                        ) : (
                          rtMessages.map((msg, idx) => {
                            const isMe = msg.senderId === user?.id;
                            const isArtistMsg = msg.senderId === project?.artist_id;
                            const senderName = isArtistMsg ? project?.artist_name : project?.client_name;
                            const senderAvatar = isArtistMsg ? project?.artist_avatar : project?.client_avatar;

                            const prev = rtMessages[idx - 1];
                            const next = rtMessages[idx + 1];
                            const prevSame = prev && prev.senderId === msg.senderId &&
                              (msg.timestamp.getTime() - prev.timestamp.getTime() < 5 * 60 * 1000);
                            const nextSame = next && next.senderId === msg.senderId &&
                              (next.timestamp.getTime() - msg.timestamp.getTime() < 5 * 60 * 1000);
                            const showDay = !prev || prev.timestamp.toDateString() !== msg.timestamp.toDateString();

                            return (
                              <div key={msg.id}>
                                {showDay && (
                                  <div className="flex justify-center py-3">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 bg-muted/40 px-3 py-1 rounded-full">
                                      {formatDate(msg.timestamp, 'EEEE, MMM d')}
                                    </span>
                                  </div>
                                )}
                                <div className={`flex gap-2 items-end ${isMe ? 'flex-row-reverse' : ''} ${prevSame ? 'mt-0.5' : 'mt-3'}`}>
                                  <div className={`flex flex-col max-w-[78%] ${isMe ? 'items-end' : 'items-start'}`}>
                                    <MessageBubble
                                      message={{
                                        id: msg.id,
                                        content: msg.text || ""
                                      }}
                                      isOwn={isMe}
                                      nextSame={nextSame}
                                      prevSame={prevSame}
                                      avatarUrl={senderAvatar}
                                      senderName={senderName}
                                    />
                                    {!nextSame && (
                                      <span className="text-[10px] text-muted-foreground/60 mt-1 px-1">
                                        {formatDate(msg.timestamp, 'h:mm a')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>

                    <div className="p-3 sm:p-4 bg-white/90 dark:bg-card/80 backdrop-blur-xl border-t border-border/40 shrink-0 pb-[calc(0.75rem+var(--safe-bottom))]">
                      <div className="flex items-end gap-2 max-w-3xl mx-auto w-full">
                        <Textarea
                          placeholder="Message"
                          value={newMessage}
                          onChange={e => setNewMessage(e.target.value)}
                          className="min-h-[40px] max-h-[104px] resize-none rounded-[20px] bg-muted/40 dark:bg-background/40 border border-border/40 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40 px-4 py-2.5 text-[15px] leading-snug transition-all ease-apple"
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                        />
                        <Button
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim()}
                          loading={sendingMessage}
                          className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 transition-all ease-apple active:scale-90 disabled:opacity-40 disabled:scale-90 shrink-0"
                          size="icon"
                         aria-label="Send message">
                          {!sendingMessage && <SendHorizontal className="h-4 w-4" />}
                        </Button>
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
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Milestone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the milestone "{confirmAction?.milestone?.title}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeConfirmAction}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
export default ProjectDetailModal;
