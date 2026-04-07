import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  metadata: Record<string, any> | null;
}

const NotificationBell = () => {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch notifications
  useEffect(() => {
    async function fetchNotifications() {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setNotifications(data as Notification[]);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    }

    fetchNotifications();

    // Subscribe to real-time notifications
    const channel = supabase
      .channel(`user-notifications-${user?.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev.slice(0, 49)]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          // Refetch on updates
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!user?.id) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const getNotificationLink = (notification: Notification) => {
    if (notification.type === 'like' && notification.metadata?.artwork_id) {
      return `/artwork/${notification.metadata.artwork_id}`;
    }
    if (notification.type === 'follow' && notification.metadata?.follower_id) {
      return `/artist/${notification.metadata.follower_id}`;
    }

    // Review notifications
    if (
      (notification.type === 'review_response' || notification.type === 'new_review') &&
      notification.metadata?.artist_id
    ) {
      const reviewId = notification.metadata?.review_id;
      return `/artist/${notification.metadata.artist_id}?tab=about${
        reviewId ? `&review=${reviewId}` : ''
      }`;
    }

    // Fallback for older review notifications that only have review_id
    if (
      (notification.type === 'review_response' || notification.type === 'new_review') &&
      notification.metadata?.review_id
    ) {
      return `/review/${notification.metadata.review_id}`;
    }

    // Project-related notifications
    const targetDashboard = profile?.role === 'artist' ? '/artist-dashboard' : '/client-dashboard';
    if (
      (notification.type === 'project_accepted' ||
        notification.type === 'project_rejected' ||
        notification.type === 'project_progress' ||
        notification.type === 'project_completed' ||
        notification.type === 'milestone_submitted' ||
        notification.type === 'milestone_approved' ||
        notification.type === 'milestone_revision') &&
      notification.metadata?.project_id
    ) {
      return `${targetDashboard}?tab=projects&project=${notification.metadata.project_id}`;
    }
    return '#';
  };

  if (!user) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0 hover:bg-primary/5 rounded-xl transition-all">
          <Bell className="h-5 w-5 text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-white animate-in zoom-in duration-300">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-80 max-h-96 overflow-y-auto z-50 bg-white/95 backdrop-blur-xl border border-muted/20 shadow-2xl rounded-2xl p-0 overflow-hidden"
        align="end"
        forceMount
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-muted/10 bg-muted/5">
          <span className="font-black text-xs uppercase tracking-widest text-muted-foreground/60">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                markAllAsRead();
              }}
              className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-12 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p className="text-xs font-bold">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const isAlert = notification.type === 'error' || notification.type === 'warning' || notification.type === 'ADMIN_DISPUTE_MESSAGE_SENT';
              
              return (
                <DropdownMenuItem
                  key={notification.id}
                  asChild
                  className={cn(
                    "px-4 py-3.5 cursor-pointer focus:bg-primary/5 border-l-4 transition-all",
                    !notification.is_read 
                      ? (isAlert ? 'bg-red-500/5 border-red-500' : 'bg-primary/5 border-primary') 
                      : 'border-transparent'
                  )}
                >
                  <Link
                    to={getNotificationLink(notification)}
                    onClick={() => {
                      if (!notification.is_read) {
                        markAsRead(notification.id);
                      }
                      setIsOpen(false);
                    }}
                    className="block outline-none"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-bold text-sm leading-tight mb-1",
                          isAlert ? 'text-red-700' : 'text-foreground'
                        )}>
                          {notification.title}
                        </p>
                        <p className={cn(
                          "text-xs line-clamp-2 leading-relaxed opacity-80",
                          isAlert ? 'text-red-600 font-medium' : 'text-muted-foreground'
                        )}>
                          {notification.message}
                        </p>
                        <p className="text-[10px] mt-2 font-bold text-muted-foreground/40">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </Link>
                </DropdownMenuItem>
              );
            })
          )}
        </div>

        <div className="p-2 border-t border-muted/10 bg-muted/5">
          <Button asChild variant="ghost" className="w-full h-8 text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 hover:text-primary rounded-xl" onClick={() => setIsOpen(false)}>
            <Link to="/notifications">See All Notification History</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
