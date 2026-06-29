import { useState, useRef } from 'react';
import { track } from '@/lib/analytics';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Upload, X, FileText, AlertCircle, Sparkles } from 'lucide-react';

interface Milestone {
  id: string;
  title: string;
  status?: string;
}

interface DisputeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone: Milestone;
  projectId: string;
  onSuccess: () => void;
}

const DISPUTE_REASONS = [
  { value: 'quality_issues', label: 'Quality Issues' },
  { value: 'incomplete_work', label: 'Incomplete Work' },
  { value: 'scope_disagreement', label: 'Scope Disagreement' },
  { value: 'communication_issues', label: 'Communication Issues' },
  { value: 'deadline_missed', label: 'Deadline Missed' },
  { value: 'payment_dispute', label: 'Payment Dispute' },
  { value: 'other', label: 'Other' }
];

export function DisputeDialog({
  open,
  onOpenChange,
  milestone,
  projectId,
  onSuccess
}: DisputeDialogProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEvidenceFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!reason) {
      toast.error('Please select a reason for the dispute');
      return;
    }

    if (!description.trim()) {
      toast.error('Please provide a detailed description');
      return;
    }

    setSubmitting(true);

    try {
      // Create dispute
      const { data: dispute, error: disputeError } = await supabase
        .from('disputes')
        .insert({
          project_id: projectId,
          milestone_id: milestone.id,
          raised_by: user?.id,
          reason,
          description,
          status: 'open'
        })
        .select()
        .single();

      if (disputeError) throw disputeError;

      // Upload evidence file if provided
      if (evidenceFile) {
        const filePath = `${user?.id}/${dispute.id}/${Date.now()}-${evidenceFile.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('milestone-submissions')
          .upload(filePath, evidenceFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('milestone-submissions')
          .getPublicUrl(filePath);

        // Save evidence record
        await supabase.from('dispute_evidence').insert({
          dispute_id: dispute.id,
          submitted_by: user?.id,
          description: 'Initial evidence',
          file_url: publicUrl,
          file_name: evidenceFile.name
        });

        track('evidence_submitted', {
          dispute_id: dispute.id,
          project_id: projectId,
          milestone_id: milestone.id,
          file_name: evidenceFile.name,
          file_size: evidenceFile.size,
        });
      }

      // Update milestone status to DISPUTED
      await supabase
        .from('project_milestones')
        .update({ status: 'DISPUTED' })
        .eq('id', milestone.id);

      // Log activity
      await supabase.from('project_activity_logs').insert({
        project_id: projectId,
        milestone_id: milestone.id,
        user_id: user?.id,
        action: 'dispute_raised',
        details: { reason, disputeId: dispute.id }
      });

      track('dispute_raised', {
        dispute_id: dispute.id,
        project_id: projectId,
        milestone_id: milestone.id,
        reason,
        has_evidence: !!evidenceFile,
      });

      toast.success('Dispute raised successfully. Our team will review it shortly.');
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to raise dispute');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    const confirmed = window.confirm('Are you sure you want to withdraw this dispute? The milestone will return to Review Pending status.');
    if (!confirmed) return;

    setSubmitting(true);
    try {
      // Find the open dispute
      const { data: activeDispute } = await supabase
        .from('disputes')
        .select('id')
        .eq('milestone_id', milestone.id)
        .eq('status', 'open')
        .maybeSingle();

      if (activeDispute) {
        // Resolve the dispute record
        await supabase
          .from('disputes')
          .update({ status: 'resolved', resolution_notes: 'Withdrawn by user' })
          .eq('id', activeDispute.id);
      }

      // Revert milestone status to REVIEW_PENDING (assuming that's where it came from)
      // or at least out of DISPUTED
      await supabase
        .from('project_milestones')
        .update({ status: 'REVIEW_PENDING' })
        .eq('id', milestone.id);

      // Log activity
      await supabase.from('project_activity_logs').insert({
        project_id: projectId,
        milestone_id: milestone.id,
        user_id: user?.id,
        action: 'dispute_resolved',
        details: { note: 'Dispute withdrawn by user' }
      });

      toast.success('Dispute withdrawn successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to withdraw dispute');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setReason('');
    setDescription('');
    setEvidenceFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0 bg-white dark:bg-card">
        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 p-8 pb-6 border-b border-border/40">
          <DialogHeader className="sm:text-left">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 rounded-2xl bg-red-500/20 text-red-600 animate-pulse">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight text-foreground leading-none">
                  {milestone.status === 'DISPUTED' ? 'Active Dispute' : 'Dispute Milestone'}
                </DialogTitle>
                <DialogDescription className="text-sm font-medium text-muted-foreground/80 mt-1.5">
                  Phase: <span className="font-bold text-foreground">{milestone.title}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-8 space-y-8">
          {milestone.status === 'DISPUTED' ? (
            <div className="space-y-6">
              <Alert variant="destructive" className="bg-red-500/5 border-red-500/20 rounded-3xl p-5">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <AlertTitle className="font-bold text-red-700 dark:text-red-400">Dispute in Progress</AlertTitle>
                <AlertDescription className="text-sm text-red-600/80 dark:text-red-400/80 leading-relaxed">
                  While a milestone is disputed, funds are held in escrow and work is paused. Our support team is notified.
                </AlertDescription>
              </Alert>

              <div className="p-8 rounded-[2rem] bg-slate-50 dark:bg-muted/20 border border-border/50 text-center space-y-4">
                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                  Have you reached an agreement with your collaborator? You can withdraw this dispute at any time to resume the project tracking and standard payment workflow.
                </p>
                <div className="flex justify-center">
                  <div className="w-12 h-1.5 bg-border/40 rounded-full" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">What is the issue?</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="h-14 rounded-2xl bg-muted/20 border-border/30 focus:border-primary/50 focus-visible:ring-primary/10 transition-all px-6 text-sm font-medium">
                    <SelectValue placeholder="Select primary reason" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/40 shadow-2xl p-2">
                    {DISPUTE_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="rounded-xl py-3 font-medium transition-colors focus:bg-primary/5">{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Provide Detailed Evidence</Label>
                <Textarea
                  placeholder="Explain exactly what went wrong... provide as much detail as possible for our review team."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[160px] rounded-3xl bg-muted/20 border-border/30 focus:border-primary/50 focus-visible:ring-primary/10 resize-none px-6 py-5 font-medium leading-relaxed transition-all"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Supporting Visual Evidence</Label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="group cursor-pointer border-3 border-dashed border-border/40 rounded-[2rem] p-8 flex flex-col items-center justify-center gap-4 hover:border-primary/40 hover:bg-primary/5 transition-all duration-500 shadow-inner bg-muted/5"
                >
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                  />
                  
                  {evidenceFile ? (
                    <div className="flex items-center gap-4 bg-white dark:bg-card p-4 rounded-2xl shadow-xl border border-primary/10 animate-in zoom-in-95 duration-300">
                      <div className="p-3 rounded-xl bg-primary/10 text-primary">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black truncate max-w-[180px]">{evidenceFile.name}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{(evidenceFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEvidenceFile(null);
                        }}
                        className="p-2 hover:bg-muted rounded-full transition-colors group/delete"
                      >
                        <X className="h-5 w-5 text-muted-foreground group-hover/delete:text-destructive" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 rounded-2xl bg-white dark:bg-card shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 border border-border/40">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-black text-foreground">Click to upload assets</p>
                        <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">PNG, JPG, PDF (Max 10MB)</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 pt-0 flex gap-4">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="rounded-2xl h-14 font-black uppercase tracking-widest text-[11px] px-8 flex-1 sm:flex-none hover:bg-muted"
          >
            Cancel
          </Button>
          
          {milestone.status === 'DISPUTED' ? (
            <Button
              onClick={handleWithdraw}
              disabled={submitting}
              className="rounded-2xl h-14 font-black uppercase tracking-widest text-[11px] px-10 flex-1 shadow-2xl shadow-emerald-500/20 transition-all active:scale-95 bg-emerald-600 hover:bg-emerald-700 text-white border-none group"
            >
              {submitting ? 'Unlocking...' : (
                <span className="flex items-center gap-2">
                  Withdraw Dispute <Sparkles className="h-4 w-4 group-hover:scale-125 transition-transform" />
                </span>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-2xl h-14 font-black uppercase tracking-widest text-[11px] px-10 flex-1 shadow-2xl shadow-red-500/20 transition-all active:scale-95 bg-red-600 hover:bg-red-700 text-white border-none group"
            >
              {submitting ? 'Reporting...' : (
                <span className="flex items-center gap-2">
                  Open Case <AlertTriangle className="h-4 w-4 group-hover:scale-125 transition-transform" />
                </span>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
