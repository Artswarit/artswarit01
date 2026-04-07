import { useEffect, useState, useMemo } from "react";
import { AlertCircle, MessageSquare, Clock, CreditCard, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { computeProfileCompletion } from "@/hooks/useProfileCompletion";

interface AttentionItem {
  id: string;
  type: 'message' | 'project' | 'payment' | 'profile';
  title: string;
  description: string;
  actionLabel: string;
  actionTab: string;
  severity: 'high' | 'medium' | 'low';
}

interface DashboardAttentionRequiredProps {
  role: 'artist' | 'client';
  profile: any;
  onAction: (tab: string) => void;
}

const DashboardAttentionRequired = ({ role, profile, onAction }: DashboardAttentionRequiredProps) => {
  const { user } = useAuth();
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const completion = useMemo(() => computeProfileCompletion(profile), [profile]);

  useEffect(() => {
    const fetchAttentionItems = async () => {
      if (!user?.id) return;
      
      const attentionItems: AttentionItem[] = [];

      // 1. Profile Completion (Low/Medium severity)
      if (!completion.isComplete) {
        attentionItems.push({
          id: 'profile-completion',
          type: 'profile',
          title: 'Complete Your Profile',
          description: `You're ${completion.completionPercentage}% there! Verified profiles get 3x more views.`,
          actionLabel: 'Finish Setup',
          actionTab: role === 'artist' ? 'account' : 'account', // Account tab for both now
          severity: 'medium'
        });
      }

      // 2. Unread Messages (High severity)
      // First get conversations where user is a participant
      const { data: convos } = await supabase
        .from('conversations')
        .select('id')
        .or(`client_id.eq.${user.id},artist_id.eq.${user.id}`);
      
      let unreadCount = 0;
      if (convos && convos.length > 0) {
        const convoIds = convos.map(c => c.id);
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', convoIds)
          .neq('sender_id', user.id)
          .eq('is_read', false);
        unreadCount = count || 0;
      }

      if (unreadCount && unreadCount > 0) {
        attentionItems.push({
          id: 'unread-messages',
          type: 'message',
          title: `${unreadCount} Unread Message${unreadCount > 1 ? 's' : ''}`,
          description: 'Respond to project enquiries and keep your response rate high.',
          actionLabel: 'View Messages',
          actionTab: 'messages',
          severity: 'high'
        });
      }

      // 3. Projects/Deadlines
      if (role === 'artist') {
        const { data: nearingDeadlines } = await supabase
          .from('projects')
          .select('title, deadline')
          .eq('artist_id', user.id)
          .eq('status', 'accepted')
          .not('deadline', 'is', null)
          .order('deadline', { ascending: true })
          .limit(1);

        if (nearingDeadlines && nearingDeadlines.length > 0) {
          const deadline = new Date(nearingDeadlines[0].deadline);
          const now = new Date();
          const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysLeft <= 3) {
            attentionItems.push({
              id: 'deadline-approaching',
              type: 'project',
              title: 'Project Deadline Approaching',
              description: `"${nearingDeadlines[0].title}" is due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`,
              actionLabel: 'Manage Project',
              actionTab: 'projects',
              severity: daysLeft <= 1 ? 'high' : 'medium'
            });
          }
        }
      } else {
        // Client: Check for milestones needing funding
        // Logic: Milestones in 'PENDING_FUNDING' or similar status
        // For now, let's look for active projects where the next milestone isn't funded
        // Simplification: Check if they have any projects without an active milestone
        const { count: pendingFunding } = await supabase
          .from('project_milestones')
          .select('id, projects!inner(client_id)', { count: 'exact', head: true })
          .eq('status', 'pending')
          .eq('projects.client_id', user.id);

        if (pendingFunding && pendingFunding > 0) {
            attentionItems.push({
              id: 'pending-funding',
              type: 'payment',
              title: 'Funding Required',
              description: `You have ${pendingFunding} milestone${pendingFunding > 1 ? 's' : ''} waiting to be funded.`,
              actionLabel: 'View Projects',
              actionTab: 'projects',
              severity: 'high'
            });
        }
      }

      setItems(attentionItems);
      setLoading(false);
    };

    fetchAttentionItems();
  }, [user?.id, role, completion, profile]);

  if (loading || items.length === 0) return null;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/70 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Attention Required
        </h2>
        {items.length > 1 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
            {items.length} Actions
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => (
          <div 
            key={item.id}
            className={cn(
              "group relative overflow-hidden p-5 rounded-[1.5rem] border transition-all duration-300 hover:shadow-xl",
              item.severity === 'high' 
                ? "bg-red-50/50 border-red-100 dark:bg-red-950/10 dark:border-red-900/20 shadow-red-500/5" 
                : "bg-white border-border/50 dark:bg-card/50 shadow-lg shadow-black/5"
            )}
          >
            <div className="flex items-start gap-4 h-full">
              <div className={cn(
                "p-3 rounded-2xl shrink-0 transition-colors",
                item.severity === 'high' ? "bg-red-100/50 text-red-600" : "bg-primary/5 text-primary"
              )}>
                {item.type === 'message' && <MessageSquare className="h-5 w-5" />}
                {item.type === 'project' && <Clock className="h-5 w-5" />}
                {item.type === 'payment' && <CreditCard className="h-5 w-5" />}
                {item.type === 'profile' && <Sparkles className="h-5 w-5" />}
              </div>

              <div className="flex-1 min-w-0 pr-8">
                <h3 className="font-bold text-sm mb-1 group-hover:text-primary transition-colors">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{item.description}</p>
              </div>

              <Button 
                onClick={() => onAction(item.actionTab)}
                variant="ghost" 
                size="icon" 
                className="absolute top-4 right-4 rounded-full hover:bg-primary hover:text-white transition-all shadow-sm"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <div className={cn(
              "absolute bottom-0 left-0 h-1 transition-all duration-500",
              item.severity === 'high' ? "bg-red-500" : "bg-primary"
            )} style={{ width: '4px' }} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardAttentionRequired;
