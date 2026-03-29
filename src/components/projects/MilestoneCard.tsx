import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Play,
  Upload,
  Eye,
  AlertTriangle,
  FileText,
  RotateCcw,
  Lock,
  CreditCard,
  CheckCircle,
  Clock,
  DollarSign,
  Send,
} from "lucide-react";
import { format } from "date-fns";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { PayMilestoneButton } from "@/components/payments/PayMilestoneButton";
import { ArtistEarningsBanner } from "@/components/payments/ArtistEarningsBanner";

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
  startBlockedReason?: "project_not_accepted" | "payment_not_enabled" | null;
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
  onClaimPayout: (milestoneId: string) => void;
  onNudge?: () => void;
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
  projectStatus = "pending",
  onStart,
  onSubmit,
  onReview,
  onDispute,
  onPaymentSuccess,
  getStatusBadge,
  onEnablePayments,
  onClaimPayout,
  onNudge,
  exchangeRate,
}: MilestoneCardProps) {
  const { format: formatCurrency } = useCurrencyFormat();

  // Status flags (separate from the isLocked prop, which refers to project-level lock)
  // Ensure that if a milestone has been paid, it absolutely cannot be in a waiting state
  const isLockedStatus = milestone.status === "LOCKED";
  const hasBeenPaid = !!milestone.paid_at;
  const isWaitingFunds = milestone.status === "WAITING_FUNDS" && !hasBeenPaid;
  const isActive = milestone.status === "ACTIVE" || (milestone.status === "WAITING_FUNDS" && hasBeenPaid);
  const isReviewPending = milestone.status === "REVIEW_PENDING";
  const isRevisionRequested = milestone.status === "REVISION_REQUESTED";
  const isCompleted = milestone.status === "COMPLETED";
  const isDisputed = milestone.status === "DISPUTED";
  const isAutoApprovePassed = milestone.auto_approve_at && 
    isReviewPending && 
    new Date() > new Date(milestone.auto_approve_at);
  const isRevisionLimitReached = milestone.revision_count >= milestone.max_revisions;

  // Clients can fund milestones when waiting for funds (escrow)
  // They can fund the first milestone even if project is pending (to show commitment)
  const canFund = isClient && isWaitingFunds && !isDisputed && (projectStatus !== "pending" || index === 0);

  return (
    <Card
      className={`transition-all ${isCompleted ? "border-emerald-500/50 bg-emerald-500/5" : ""} ${isDisputed ? "border-red-500/50 bg-red-500/5" : ""}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isCompleted ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}
            >
              {index + 1}
            </div>
            <CardTitle className="text-lg">{milestone.title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(milestone.status)}
            <Badge variant="outline" className="gap-1">
              {formatCurrency(milestone.amount, "USD", exchangeRate)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {milestone.description && (
          <p className="text-sm text-muted-foreground">
            {milestone.description}
          </p>
        )}

        {milestone.deliverables && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Deliverables
            </p>
            <p className="text-sm">{milestone.deliverables}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {milestone.due_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>
                Due: {format(new Date(milestone.due_date), "MMM d, yyyy")}
              </span>
            </div>
          )}
          {milestone.revision_count > 0 && (
            <div className="flex items-center gap-1">
              <RotateCcw className="h-4 w-4" />
              <span>
                Revisions: {milestone.revision_count}/{milestone.max_revisions}
              </span>
            </div>
          )}
          {milestone.auto_approve_at && isReviewPending && (
            <div className="flex items-center gap-1 text-yellow-600">
              <Calendar className="h-4 w-4" />
              <span>
                Auto-approves:{" "}
                {format(new Date(milestone.auto_approve_at), "MMM d, yyyy")}
              </span>
            </div>
          )}
          {milestone.paid_at && (
            <div className="flex items-center gap-1 text-emerald-600">
              <Calendar className="h-4 w-4" />
              <span>
                Paid: {format(new Date(milestone.paid_at), "MMM d, yyyy")}
              </span>
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
          <div className="flex items-center gap-2 p-3 bg-violet-500/10 rounded-lg border border-violet-500/20">
            <Eye className="h-4 w-4 text-violet-600" />
            <p className="text-sm text-violet-600">
              The artist has submitted work for your review. Please review and approve or request revisions.
            </p>
          </div>
        )}

        {/* Artist blocked from starting - Project not accepted */}
        {isArtist &&
          startBlockedReason === "project_not_accepted" &&
          isWaitingFunds && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <CheckCircle className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-600">
                You must accept this project before starting milestones.
              </p>
            </div>
          )}

        {/* Artist blocked from starting - Payment not enabled */}
        {isArtist &&
          startBlockedReason === "payment_not_enabled" &&
          projectStatus === "accepted" &&
          isWaitingFunds && (
            <div className="flex items-center justify-between gap-2 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-yellow-600" />
                <p className="text-sm text-yellow-600">
                  Enable payment details to start milestones and receive
                  payouts.
                </p>
              </div>
              {onEnablePayments && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onEnablePayments}
                  className="shrink-0"
                >
                  Enable Payments
                </Button>
              )}
            </div>
          )}

        {/* Case: Client funded but Artist hasn't accepted the project yet */}
        {isClient && isActive && projectStatus === "pending" && (
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 p-3 sm:p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20 animate-fade-in">
            <div className="p-1 rounded-full bg-indigo-500/20 shrink-0 mt-0.5 sm:mt-0">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600" />
            </div>
            <p className="text-xs sm:text-sm text-indigo-700 dark:text-indigo-400 font-medium leading-relaxed">
              Awaiting artist confirmation. Your funds are secured in escrow and will only be accessible to the artist once they formally accept the project and commence work.
            </p>
          </div>
        )}

        {/* Workflow Status Message */}
        {isArtist && isActive && (
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 p-3 sm:p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 animate-fade-in">
            <div className="p-1 rounded-full bg-emerald-500/20 shrink-0 mt-0.5 sm:mt-0">
              <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />
            </div>
            <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 font-medium leading-relaxed">
              Funds have been secured in escrow. You are authorized to commence work on this milestone.
            </p>
          </div>
        )}

        {isClient && isActive && projectStatus !== "pending" && (
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 p-3 sm:p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 animate-fade-in">
            <div className="p-1 rounded-full bg-blue-500/20 shrink-0 mt-0.5 sm:mt-0">
              <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
            </div>
            <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-400 font-medium leading-relaxed">
              Funds secured in escrow. The artist is currently working on this milestone.
            </p>
          </div>
        )}

        {/* REVIEW PENDING STATE — Artist view */}
        {isArtist && isReviewPending && (
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 p-3 sm:p-4 bg-violet-500/10 rounded-xl border border-violet-500/20 animate-fade-in">
            <div className="p-1 rounded-full bg-violet-500/20 shrink-0 mt-0.5 sm:mt-0">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-600" />
            </div>
            <p className="text-xs sm:text-sm text-violet-700 dark:text-violet-400 font-medium leading-relaxed">
              Submission is currently pending client review and approval.
            </p>
          </div>
        )}

        {isRevisionRequested && (
          <div className={`flex items-start sm:items-center gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-xl border animate-fade-in ${
            isRevisionLimitReached 
              ? "bg-red-500/10 border-red-500/20" 
              : "bg-amber-500/10 border-amber-500/20"
          }`}>
            <div className={`p-1 rounded-full shrink-0 mt-0.5 sm:mt-0 ${
              isRevisionLimitReached ? "bg-red-500/20" : "bg-amber-500/20"
            }`}>
              <AlertTriangle className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
                isRevisionLimitReached ? "text-red-600" : "text-amber-600"
              }`} />
            </div>
            <p className={`text-xs sm:text-sm font-medium leading-relaxed ${
              isRevisionLimitReached ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
            }`}>
              {isRevisionLimitReached ? (
                isArtist 
                  ? "Revision limit reached (no more free revisions). Please discuss scope adjustments with the client or raise a dispute if you believe the work meets original requirements."
                  : "The maximum number of revisions has been reached. Please review the work carefully or raise a dispute if the quality remains unsatisfactory."
              ) : (
                isArtist
                  ? "The client has requested revisions. Please review the feedback and resubmit."
                  : "Revision request has been successfully forwarded to the artist."
              )}
            </p>
          </div>
        )}

        {/* COMPLETED STATE */}
        {isCompleted && (
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 p-3 sm:p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 animate-fade-in shadow-sm">
            <div className="p-1.5 rounded-full bg-emerald-500 shrink-0 mt-0.5 sm:mt-0">
              <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
            </div>
            <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 font-bold tracking-tight">
              {isArtist
                ? "Milestone approved. Escrow funds have been successfully released to your account."
                : "Milestone formally approved. Escrow funds have been successfully released."}
            </p>
          </div>
        )}

        {/* DISPUTED STATE EXPLANATION */}
        {isDisputed && (
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 p-3 sm:p-4 bg-red-500/10 rounded-xl border border-red-500/20 animate-fade-in shadow-sm">
            <div className="p-1 rounded-full bg-red-500/20 shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600" />
            </div>
            <p className="text-xs sm:text-sm text-red-700 dark:text-red-400 font-medium leading-relaxed">
              An Artswarit moderator is reviewing this milestone. Both parties will be contacted via email within 24-48 hours. Funds remain safely secured.
            </p>
          </div>
        )}

        {/* Artist Stalled/Paused Alert */}
        {isArtist && isWaitingFunds && index > 0 && (
          <div className="flex items-start sm:items-center justify-between gap-3 p-3 sm:p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 animate-fade-in">
            <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
              <div className="p-1 rounded-full bg-amber-500/20 shrink-0 mt-0.5 sm:mt-0">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600" />
              </div>
              <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                Work paused. Waiting for this milestone to be funded.
              </p>
            </div>
            {onNudge && (
              <Button size="sm" variant="outline" className="h-8 border-amber-500/50 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-3" onClick={onNudge}>
                <Send className="h-3.5 w-3.5 mr-1" />
                Remind Client
              </Button>
            )}
          </div>
        )}

        {isClient && isWaitingFunds && index === 0 && (
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 p-3 sm:p-4 bg-muted/50 rounded-xl border border-border/50 animate-fade-in">
            <div className="p-1 rounded-full bg-muted-foreground/10 shrink-0 mt-0.5 sm:mt-0">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed">
              Waiting for initial escrow deposit. Please fund this milestone to begin the project.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {/* Artist Actions */}
          {isArtist && (
            <>
              {canStart &&
                !startBlockedReason &&
                (isActive || isRevisionRequested) && (
                  <Button
                    size="sm"
                    onClick={onStart}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Start Milestone
                  </Button>
                )}
              {(isActive || isRevisionRequested) && (
                <Button
                  size="sm"
                  onClick={onSubmit}
                  disabled={isRevisionRequested && isRevisionLimitReached}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {isRevisionRequested && isRevisionLimitReached ? "Revision Limit Hit" : "Submit for Review"}
                </Button>
              )}
              {isCompleted && (
                <Button size="sm" variant="outline" onClick={onSubmit}>
                  <Upload className="h-4 w-4 mr-1" />
                  Upload Final Files
                </Button>
              )}
              {isAutoApprovePassed && (
                <Button
                  size="sm"
                  onClick={() => onClaimPayout(milestone.id)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md animate-pulse"
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  Claim Payout
                </Button>
              )}
            </>
          )}

          {/* Client Actions */}
          {isClient && (
            <>
              {isReviewPending && (
                <Button
                  size="sm"
                  onClick={onReview}
                  className="bg-primary hover:bg-primary/90"
                >
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
                <Button size="sm" variant="outline">
                  <FileText className="h-4 w-4 mr-1" />
                  Download Files
                </Button>
              )}
            </>
          )}

          {/* Dispute Button - only after submission (review/revision states) */}
          {!isCompleted &&
            !isDisputed &&
            (isClient || isArtist) &&
            (isReviewPending || isRevisionRequested) && (
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





