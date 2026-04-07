import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Clock, DollarSign, FileText, Lock, Upload, AlertCircle, CreditCard, RotateCcw } from 'lucide-react';
import { MilestoneCard } from './MilestoneCard';
import { MilestoneSubmissionDialog } from './MilestoneSubmissionDialog';
import { MilestoneReviewDialog } from './MilestoneReviewDialog';
import { DisputeDialog } from './DisputeDialog';
import { ProjectActivityLog } from './ProjectActivityLog';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import { EnablePaymentsDialog } from '@/components/payments/EnablePaymentsDialog';
import { useArtistPaymentAccount } from '@/hooks/useArtistPaymentAccount';
import LogoLoader from '@/components/ui/LogoLoader';
import { broadcastRefresh, useRealtimeSync } from '@/lib/realtime-sync';

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  deliverables: string | null;
  amount: number;
  due_date: string | null;
  status: string;
  sort_order: number;
  revision_count: number;
  max_revisions: number;
  submitted_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  auto_approve_at: string | null;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  budget: number | null;
  deadline: string | null;
  status: string | null;
  is_locked: boolean;
  client_id: string | null;
  artist_id: string | null;
  auto_approve_days: number;
  currency?: string | null;
  exchange_rate?: number | null;
  amount_usd?: number | null;
}

interface MilestoneWorkflowProps {
  projectId: string;
}

export function MilestoneWorkflow({ projectId }: MilestoneWorkflowProps) {
  const { user } = useAuth();
  const { format: formatCurrency } = useCurrencyFormat();
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [enablePaymentsOpen, setEnablePaymentsOpen] = useState(false);
  const [artistKycEnabled, setArtistKycEnabled] = useState(false);

  const { account: myPaymentAccount, isPayoutsEnabled } = useArtistPaymentAccount();

  const isClient = user?.id === project?.client_id;
  const isArtist = user?.id === project?.artist_id;

  // Fetch artist KYC status for client view
  useEffect(() => {
    const fetchArtistKyc = async () => {
      if (!project?.artist_id || isArtist) return;
      
      const { data } = await supabase
        .from('razorpay_accounts')
        .select('payouts_enabled')
        .eq('user_id', project.artist_id)
        .single();

      setArtistKycEnabled(data?.payouts_enabled ?? false);
    };

    fetchArtistKyc();

    // Subscribe to artist KYC updates
    if (project?.artist_id) {
      const channel = supabase
        .channel(`artist-kyc-${project.artist_id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'razorpay_accounts',
          filter: `user_id=eq.${project.artist_id}`,
        }, (payload) => {
          if (payload.new) {
            setArtistKycEnabled((payload.new as any).payouts_enabled ?? false);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [project?.artist_id, isArtist]);

  useEffect(() => {
    fetchProjectData();
    
    // Subscribe to milestone updates
    const milestoneChannel = supabase
      .channel(`project-milestones-v2-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_milestones',
        filter: `project_id=eq.${projectId}`
      }, (payload) => {
        console.log('Milestone update:', payload);
        fetchMilestones();
      })
      .subscribe();

    // Subscribe to payment updates (Razorpay/Internal)
    const paymentChannel = supabase
      .channel(`project-payments-v2-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payments',
        filter: `project_id=eq.${projectId}`
      }, (payload) => {
        console.log('Payment update:', payload);
        if ((payload.new as any)?.status === 'success') {
          toast.success('Payment confirmed!');
          fetchMilestones();
        }
      })
      .subscribe();

    // Subscribe to transaction updates (Stripe)
    const transactionChannel = supabase
      .channel(`project-transactions-v2-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'transactions',
        filter: `seller_id=eq.${project?.artist_id}` // Use artist_id as filter
      }, (payload) => {
        console.log('Transaction update:', payload);
        const newTx = payload.new as any;
        // If this transaction is a successful milestone payment for this project
        if (newTx?.status === 'success' && newTx?.milestone_id) {
          // Verify if the milestone belongs to this project
          const isOurMilestone = milestones.some(m => m.id === newTx.milestone_id);
          if (isOurMilestone) {
            toast.success('Stripe payment confirmed!');
            fetchMilestones();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(milestoneChannel);
      supabase.removeChannel(paymentChannel);
      supabase.removeChannel(transactionChannel);
    };
  }, [projectId, project?.artist_id, milestones.length]);

  const fetchProjectData = async () => {
    try {
      const [projectRes, milestonesRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('project_milestones').select('*').eq('project_id', projectId).order('sort_order')
      ]);

      if (projectRes.error) throw projectRes.error;
      if (milestonesRes.error) throw milestonesRes.error;

      setProject(projectRes.data as unknown as Project);
      setMilestones(milestonesRes.data as unknown as Milestone[]);
    } catch (error: any) {
      toast.error('Failed to load project data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMilestones = async () => {
    const { data, error } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order');

    if (!error && data) {
      setMilestones(data as unknown as Milestone[]);
    }
  };

  // Realtime Sync for project/milestones
  useRealtimeSync('projects', fetchProjectData);
  useRealtimeSync('milestones', fetchMilestones);

  const getStatusBadge = (status: string) => {
    const s = (status || 'LOCKED').toUpperCase();
    const statusConfig: Record<string, { color: string; icon: React.ReactNode; label?: string }> = {
      // Database Enum Values
      PENDING: { color: 'bg-slate-100 text-slate-600 border-slate-200', icon: <Clock className="h-3 w-3" />, label: 'Pending' },
      IN_PROGRESS: { color: 'bg-blue-50 text-blue-600 border-blue-100', icon: <FileText className="h-3 w-3" />, label: 'In Progress' },
      SUBMITTED: { color: 'bg-indigo-50 text-indigo-600 border-indigo-100', icon: <Upload className="h-3 w-3" />, label: 'Review Pending' },
      REVISION_REQUESTED: { color: 'bg-orange-50 text-orange-600 border-orange-100', icon: <RotateCcw className="h-3 w-3" />, label: 'Revision Requested' },
      APPROVED: { color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: <CheckCircle className="h-3 w-3" />, label: 'Approved' },
      PAID: { color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: <CheckCircle className="h-3 w-3" />, label: 'Completed' },
      DISPUTED: { color: 'bg-red-50 text-red-600 border-red-100', icon: <AlertTriangle className="h-3 w-3" />, label: 'Disputed' },
      
      // UI Legacy Values (Mapped for compatibility)
      LOCKED: { color: 'bg-slate-100 text-slate-600 border-slate-200', icon: <Lock className="h-3 w-3" />, label: 'Locked' },
      WAITING_FUNDS: { color: 'bg-amber-50 text-amber-600 border-amber-100', icon: <Clock className="h-3 w-3" />, label: 'Waiting Funds' },
      ACTIVE: { color: 'bg-blue-50 text-blue-600 border-blue-100', icon: <FileText className="h-3 w-3" />, label: 'Active' },
      REVIEW_PENDING: { color: 'bg-indigo-50 text-indigo-600 border-indigo-100', icon: <Upload className="h-3 w-3" />, label: 'Review Pending' },
      COMPLETED: { color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: <CheckCircle className="h-3 w-3" />, label: 'Completed' }
    };

    const config = statusConfig[s] || statusConfig.LOCKED;
    const label = config.label || s.toLowerCase().split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    return (
      <Badge variant="outline" className={`${config.color} border gap-1.5 px-2.5 py-0.5 font-bold text-[10px] uppercase tracking-wider rounded-full shadow-sm`}>
        {config.icon}
        {label}
      </Badge>
    );
  };

  const calculateProgress = () => {
    if (milestones.length === 0) return 0;
    const completedMilestones = milestones.filter(m => 
      ['PAID', 'COMPLETED', 'APPROVED'].includes((m.status || '').toUpperCase())
    ).length;
    return (completedMilestones / milestones.length) * 100;
  };

  const getTotalBudget = () => {
    return milestones.reduce((sum, m) => sum + (m.amount || 0), 0);
  };

  const getPaidAmount = () => {
    return milestones.filter(m => 
      ['PAID', 'COMPLETED', 'APPROVED'].includes((m.status || '').toUpperCase())
    ).reduce((sum, m) => sum + (m.amount || 0), 0);
  };

  const canStartMilestone = (milestone: Milestone, index: number) => {
    // Artists must have payment enabled AND project must be accepted
    if (isArtist && (!isPayoutsEnabled || project?.status !== 'accepted')) {
      return false;
    }
    
    const normalizedStatus = (milestone.status || '').toUpperCase();
    
    // In escrow model, artist can only start when the milestone is ACTIVE (funded)
    // and previous milestone (if any) has been COMPLETED.
    if (index === 0) return ['ACTIVE', 'IN_PROGRESS', 'REVISION_REQUESTED', 'PAID'].includes(normalizedStatus);
    const prevStatus = (milestones[index - 1].status || '').toUpperCase();
    const currentReady = ['ACTIVE', 'IN_PROGRESS', 'REVISION_REQUESTED', 'PAID'].includes(normalizedStatus);
    const prevCompleted = ['PAID', 'COMPLETED', 'APPROVED'].includes(prevStatus);
    return prevCompleted && currentReady;
  };

  const getStartBlockedReason = () => {
    if (isArtist) {
      if (project?.status !== 'accepted') {
        return 'project_not_accepted';
      }
      if (!isPayoutsEnabled) {
        return 'payment_not_enabled';
      }
    }
    return null;
  };

  const handleStartMilestone = async (milestoneId: string) => {
    try {
      const { error } = await supabase
        .from('project_milestones')
        .update({ status: 'in_progress' }) // Map to DB enum
        .eq('id', milestoneId);

      if (error) throw error;

      await logActivity(milestoneId, 'milestone_started', { milestoneId });
      toast.success('Milestone started');
      broadcastRefresh('milestones');
      fetchMilestones();
    } catch (error: any) {
      toast.error('Failed to start milestone');
    }
  };

  const logActivity = async (milestoneId: string | null, action: string, details: any) => {
    try {
      await supabase.from('project_activity_logs').insert({
        project_id: projectId,
        milestone_id: milestoneId,
        user_id: user?.id,
        action,
        details
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LogoLoader text="Loading milestones…" />
      </div>
    );
  }

  if (!project) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Project not found</p>
        </CardContent>
      </Card>
    );
  }

  const budgetMatch = Math.abs(getTotalBudget() - (project.amount_usd || project.budget || 0)) < 0.05;
  const hasApprovedMilestones = milestones.some(m => ['APPROVED', 'PAID', 'COMPLETED'].includes((m.status || '').toUpperCase()));

  return (
    <div className="space-y-6">
      {/* Artist Payment Setup Banner */}
      {isArtist && !isPayoutsEnabled && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-600">Enable Payments to Receive Payouts</p>
                  <p className="text-sm text-muted-foreground">
                    Complete your payment setup to receive payouts when milestones are paid.
                  </p>
                </div>
              </div>
              <Button onClick={() => setEnablePaymentsOpen(true)}>
                Enable Payments
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {project.title}
                {project.is_locked && <Lock className="h-4 w-4 text-muted-foreground" />}
              </CardTitle>
              <CardDescription>{project.description}</CardDescription>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{formatCurrency(project.amount_usd || project.budget || 0, 'USD', project.exchange_rate || undefined)}</p>
              <p className="text-sm text-muted-foreground">Total Budget</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Budget Validation Warning */}
            {!budgetMatch && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="text-sm text-destructive">
                  Milestone total ({formatCurrency(getTotalBudget(), 'USD', project.exchange_rate || undefined)}) doesn't match project budget ({formatCurrency(project.amount_usd || project.budget || 0, 'USD', project.exchange_rate || undefined)}). 
                  Please adjust milestones before proceeding.
                </p>
              </div>
            )}

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Project Progress</span>
                <span>{Math.round(calculateProgress())}%</span>
              </div>
              <Progress value={calculateProgress()} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatCurrency(getPaidAmount(), 'USD', project.exchange_rate || undefined)} paid</span>
                <span>{formatCurrency(getTotalBudget() - getPaidAmount(), 'USD', project.exchange_rate || undefined)} remaining</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Tabs defaultValue="milestones">
        <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-full h-auto min-h-[48px] sm:min-h-0 p-1 bg-muted/50 rounded-lg flex items-stretch gap-1">
            <TabsTrigger value="milestones" className="flex-1 min-w-[140px] py-2 sm:py-2.5 px-3 rounded-md transition-all">Milestones ({milestones.length})</TabsTrigger>
            <TabsTrigger value="activity" className="flex-1 min-w-[140px] py-2 sm:py-2.5 px-3 rounded-md transition-all">Activity Log</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="milestones" className="space-y-4 mt-4">
          {milestones.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No milestones defined yet</p>
              </CardContent>
            </Card>
          ) : (
            milestones.map((milestone, index) => (
              <MilestoneCard
                key={milestone.id}
                milestone={milestone}
                index={index}
                isClient={isClient}
                isArtist={isArtist}
                isLocked={project.is_locked}
                canStart={canStartMilestone(milestone, index)}
                startBlockedReason={getStartBlockedReason()}
                artistKycEnabled={isArtist ? isPayoutsEnabled : artistKycEnabled}
                artistId={project.artist_id || undefined}
                projectStatus={project.status || 'pending'}
                onStart={() => handleStartMilestone(milestone.id)}
                onSubmit={() => {
                  setSelectedMilestone(milestone);
                  setSubmissionDialogOpen(true);
                }}
                onReview={() => {
                  setSelectedMilestone(milestone);
                  setReviewDialogOpen(true);
                }}
                onDispute={() => {
                  setSelectedMilestone(milestone);
                  setDisputeDialogOpen(true);
                }}
                onPaymentSuccess={() => {
                  broadcastRefresh('milestones');
                  fetchMilestones();
                  logActivity(milestone.id, 'payment_initiated', { milestoneId: milestone.id });
                }}
                getStatusBadge={getStatusBadge}
                onEnablePayments={() => setEnablePaymentsOpen(true)}
                exchangeRate={project.exchange_rate || undefined}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ProjectActivityLog projectId={projectId} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {selectedMilestone && (
        <>
          <MilestoneSubmissionDialog
            open={submissionDialogOpen}
            onOpenChange={setSubmissionDialogOpen}
            milestone={selectedMilestone}
            projectId={projectId}
            autoApproveDays={project.auto_approve_days}
            onSuccess={() => {
              broadcastRefresh('milestones');
              fetchMilestones();
              logActivity(selectedMilestone.id, 'submission_created', { milestoneId: selectedMilestone.id });
            }}
          />

          <MilestoneReviewDialog
            open={reviewDialogOpen}
            onOpenChange={setReviewDialogOpen}
            milestone={selectedMilestone}
            projectId={projectId}
            autoApproveDays={project.auto_approve_days}
            onSuccess={() => {
              broadcastRefresh('milestones');
              fetchMilestones();
            }}
          />

          <DisputeDialog
            open={disputeDialogOpen}
            onOpenChange={setDisputeDialogOpen}
            milestone={selectedMilestone}
            projectId={projectId}
            onSuccess={() => {
              broadcastRefresh('milestones');
              fetchMilestones();
              logActivity(selectedMilestone.id, 'dispute_raised', { milestoneId: selectedMilestone.id });
            }}
          />
        </>
      )}

      <EnablePaymentsDialog
        open={enablePaymentsOpen}
        onOpenChange={setEnablePaymentsOpen}
      />
    </div>
  );
}
