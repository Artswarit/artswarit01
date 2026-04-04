import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Play, Upload, Eye, AlertTriangle, FileText, RotateCcw, Lock, CreditCard, CheckCircle, Clock, Download } from 'lucide-react';
import { format } from 'date-fns';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import { PayMilestoneButton } from '@/components/payments/PayMilestoneButton';
import { ArtistEarningsBanner } from '@/components/payments/ArtistEarningsBanner';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

interface MilestoneCardProps {
  milestone: Milestone;
  index: number;
  isClient: boolean;
  isArtist: boolean;
  isLocked: boolean;
  canStart: boolean;
  startBlockedReason?: 'project_not_accepted' | 'payment_not_enabled' | null;
  artistKycEnabled?: boolean;
  artistId?: string;
  projectStatus?: string;
  onStart: () => void;
  onSubmit: () => void;
  onReview: () => void;
  onDispute: () => void;
  onPaymentSuccess?: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
  onEnablePayments?: () => void;
  exchangeRate?: number;
}

export function MilestoneCard({
  milestone,
  index,
  isClient,
  isArtist,
  isLocked,
  canStart,
  startBlockedReason,
  artistKycEnabled = false,
  artistId,
  projectStatus = 'pending',
  onStart,
  onSubmit,
  onReview,
  onDispute,
  onPaymentSuccess,
  getStatusBadge,
  onEnablePayments,
  exchangeRate
}: MilestoneCardProps) {
  const { format: formatCurrency } = useCurrencyFormat();
  
  // Status flags (separate from the isLocked prop, which refers to project-level lock)
  const isLockedStatus = milestone.status === 'LOCKED';
  const isWaitingFunds = milestone.status === 'WAITING_FUNDS';
  const isActive = milestone.status === 'ACTIVE';
  const isReviewPending = milestone.status === 'REVIEW_PENDING';
  const isRevisionRequested = milestone.status === 'REVISION_REQUESTED';
  const isCompleted = milestone.status === 'COMPLETED';
  const isDisputed = milestone.status === 'DISPUTED';

  // Clients can fund milestones only when waiting for funds (escrow)
  const canFund = isClient && isWaitingFunds && !isDisputed;

  return (
    <Card className={cn(
      "transition-all duration-300 border-muted/20 shadow-sm hover:shadow-md rounded-2xl overflow-hidden",
      isCompleted ? 'border-emerald-500/20 bg-emerald-500/5' : '',
      isDisputed ? 'border-red-500/20 bg-red-500/5' : ''
    )}>
      <CardHeader className="pb-4 pt-5 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className={cn(
              "shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-xs sm:text-sm font-black transition-colors",
              isCompleted ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-muted/80 text-muted-foreground'
            )}>
              {index + 1}
            </div>
            <CardTitle className="text-base sm:text-lg font-bold tracking-tight leading-tight">{milestone.title}</CardTitle>
          </div>
          <div className="flex items-center gap-2 sm:self-center ml-11 sm:ml-0">
            {getStatusBadge(milestone.status)}
            <Badge variant="outline" className="bg-background/50 backdrop-blur-sm border-muted/20 font-black text-[11px] px-3 py-1 rounded-lg">
              {formatCurrency(milestone.amount, 'USD', exchangeRate)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {milestone.description && (
          <p className="text-sm text-muted-foreground">{milestone.description}</p>
        )}

        {milestone.deliverables && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase">Deliverables</p>
            <p className="text-sm">{milestone.deliverables}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs sm:text-sm font-medium text-muted-foreground/70">
          {milestone.due_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-primary/60" />
              <span>Due {format(new Date(milestone.due_date), 'MMM d, yyyy')}</span>
            </div>
          )}
          {milestone.revision_count > 0 && (
            <div className="flex items-center gap-2">
              <RotateCcw className="h-3.5 w-3.5 text-primary/60" />
              <span>Revisions: {milestone.revision_count}/{milestone.max_revisions}</span>
            </div>
          )}
          {milestone.auto_approve_at && isReviewPending && (
            <div className="flex items-center gap-2 text-yellow-600/90 pr-2 bg-yellow-500/5 rounded-full">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse ml-1.5" />
              <span>Auto-approves {format(new Date(milestone.auto_approve_at), 'MMM d, yyyy')}</span>
            </div>
          )}
          {milestone.paid_at && (
            <div className="flex items-center gap-2 text-emerald-600 px-2.5 py-1 bg-emerald-500/5 rounded-full border border-emerald-500/10">
              <CheckCircle className="h-3.5 w-3.5" />
              <span className="font-bold uppercase tracking-tight text-[10px]">Paid Mar 17, 2026</span>
            </div>
          )}
        </div>

        {/* Artist Earnings Banner - Shows upgrade prompt for Starter artists */}
        {isArtist && artistId && (
          <ArtistEarningsBanner
            milestoneAmount={milestone.amount}
            milestoneStatus={milestone.status}
            artistId={artistId}
          />
        )}

        {/* Client info when milestone is ready to review */}
        {isClient && isReviewPending && (
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <Eye className="h-4 w-4 text-yellow-600" />
            <p className="text-sm text-yellow-600">
              Artist has submitted work. Please review and approve or request revisions.
            </p>
          </div>
        )}

        {/* Artist blocked from starting - Project not accepted */}
        {isArtist && startBlockedReason === 'project_not_accepted' && isWaitingFunds && (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <CheckCircle className="h-4 w-4 text-amber-600" />
            <p className="text-sm text-amber-600">
              You must accept this project before starting milestones.
            </p>
          </div>
        )}

        {/* Artist blocked from starting - Payment not enabled */}
        {isArtist && startBlockedReason === 'payment_not_enabled' && projectStatus === 'accepted' && isWaitingFunds && (
          <div className="flex items-center justify-between gap-2 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-yellow-600" />
              <p className="text-sm text-yellow-600">
                Enable payment details to start milestones and receive payouts.
              </p>
            </div>
            {onEnablePayments && (
              <Button size="sm" variant="outline" onClick={onEnablePayments} className="shrink-0">
                Enable Payments
              </Button>
            )}
          </div>
        )}

        {/* Workflow Status Message */}
        {isArtist && isActive && (
          <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <Play className="h-4 w-4 text-blue-600" />
            <p className="text-sm text-blue-600">
              This milestone is funded and active. Submit your work when ready.
            </p>
          </div>
        )}

        {isClient && isActive && (
          <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <Play className="h-4 w-4 text-blue-600" />
            <p className="text-sm text-blue-600">
              Artist is working on this milestone.
            </p>
          </div>
        )}

        {isClient && isWaitingFunds && index === 0 && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Waiting for you to fund this milestone so the artist can start.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-6 border-t border-muted/10">
          {/* Artist Actions */}
          {isArtist && (
            <>
              {canStart && !startBlockedReason && (isActive || isRevisionRequested) && (
                <Button size="sm" onClick={onStart} className="bg-primary hover:bg-primary/90">
                  <Play className="h-4 w-4 mr-1" />
                  Start Milestone
                </Button>
              )}
              {(isActive || isRevisionRequested) && (
                <Button size="sm" onClick={onSubmit} className="bg-primary hover:bg-primary/90">
                  <Upload className="h-4 w-4 mr-1" />
                  Submit for Review
                </Button>
              )}
              {isCompleted && (
                <Button size="sm" variant="outline" onClick={onSubmit}>
                  <Upload className="h-4 w-4 mr-1" />
                  Upload Final Files
                </Button>
              )}
            </>
          )}

          {/* Client Actions */}
          {isClient && (
            <>
              {isReviewPending && (
                <Button size="sm" onClick={onReview} className="bg-primary hover:bg-primary/90">
                  <Eye className="h-4 w-4 mr-1" />
                  Review Submission
                </Button>
              )}
              {canFund && (
                <PayMilestoneButton
                  milestoneId={milestone.id}
                  amount={milestone.amount}
                  milestoneTitle={milestone.title}
                  onSuccess={onPaymentSuccess}
                  exchangeRate={exchangeRate}
                />
              )}
              {isCompleted && (
                <Button size="sm" variant="outline" onClick={async () => {
                  try {
                    const { data: submissions } = await supabase
                      .from('milestone_submissions')
                      .select('id')
                      .eq('milestone_id', milestone.id)
                      .order('created_at', { ascending: false })
                      .limit(1);
                    if (!submissions || submissions.length === 0) {
                      toast.info('No files available for download yet.');
                      return;
                    }
                    const { data: files } = await supabase
                      .from('submission_files')
                      .select('file_url, file_name')
                      .eq('submission_id', submissions[0].id);
                    if (!files || files.length === 0) {
                      toast.info('No files found in this submission.');
                      return;
                    }
                    // Open each file in a new tab for download
                    for (const file of files) {
                      window.open(file.file_url, '_blank');
                    }
                  } catch (err) {
                    toast.error('Failed to fetch files');
                  }
                }}>
                  <Download className="h-4 w-4 mr-1" />
                  Download Files
                </Button>
              )}
            </>
          )}

          {/* Dispute Button - only after submission (review/revision states) */}
          {!isCompleted && !isDisputed && (isClient || isArtist) && (isReviewPending || isRevisionRequested) && (
            <Button size="sm" variant="destructive" onClick={onDispute}>
              <AlertTriangle className="h-4 w-4 mr-1" />
              Raise Dispute
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
