import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LogoLoader from '@/components/ui/LogoLoader';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
}

const ITEMS_PER_PAGE = 10;

const NotificationCenter = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('notifications').select('*').eq('user_id', user?.id).order('created_at', {
        ascending: false
      }).limit(200);
      if (error) {
        console.error('Error fetching notifications:', error);
        setNotifications([]);
        return;
      }
      setNotifications(data as Notification[] || []);
    } catch (error) {
      console.error('Error:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  // Real-time subscription for notifications
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`notification-center-${user.id}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${user.id}`
    }, () => {
      fetchNotifications();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotifications]);

  const getNotificationLink = (notification: any) => {
    if (notification.type === 'like' && notification.metadata?.artwork_id) {
      return `/artwork/${notification.metadata.artwork_id}`;
    }
    if (notification.type === 'follow' && notification.metadata?.follower_id) {
      return `/artist/${notification.metadata.follower_id}`;
    }
    const targetDashboard = user?.user_metadata?.role === 'artist' ? '/artist-dashboard' : '/client-dashboard';
    if (notification.metadata?.project_id) {
      return `${targetDashboard}?tab=projects&project=${notification.metadata.project_id}`;
    }
    return '#';
  };

  const displayedNotifications = notifications.slice(0, displayCount);
  const hasMore = notifications.length > displayCount;

  const handleLoadMore = () => {
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayCount(prev => prev + ITEMS_PER_PAGE);
      setLoadingMore(false);
    }, 300);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }

      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return;
      }

      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: true }))
      );

      toast({
        title: "Success",
        description: "All notifications marked as read"
      });
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Info className="h-5 w-5 text-primary" />;
    }
  };

  const getNotificationBadgeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'warning':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'error':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-primary/10 text-primary';
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LogoLoader text="Loading notifications…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6" />
          <h2 className="text-2xl font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadCount} unread
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline" size="sm">
            <Check className="h-4 w-4 mr-1" />
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Bell className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No notifications yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {displayedNotifications.map((notification) => (
            <Card
              key={notification.id}
              className={`transition-all hover:shadow-md ${
                !notification.is_read
                  ? 'border-l-4 border-l-primary bg-primary/5'
                  : 'border-l-4 border-l-muted'
              }`}
            >
              <div 
                className="cursor-pointer"
                onClick={() => {
                  if (!notification.is_read) markAsRead(notification.id);
                  const link = getNotificationLink(notification);
                  if (link !== '#') window.location.href = link;
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getNotificationIcon(notification.type)}
                      <div>
                        <CardTitle className="text-base">{notification.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {notification.message}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Badge
                        variant="outline"
                        className={getNotificationBadgeColor(notification.type)}
                      >
                        {notification.type}
                      </Badge>
                      {!notification.is_read && (
                        <Button
                          onClick={() => markAsRead(notification.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                    {new Date(notification.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </CardContent>
              </div>
            </Card>
          ))}
          
          {hasMore && (
            <div className="flex flex-col items-center gap-3 pt-8 pb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                Showing {displayedNotifications.length} of {notifications.length} notifications
              </p>
              <Button 
                variant="ghost" 
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="group relative h-12 px-10 rounded-2xl bg-primary/5 hover:bg-primary/10 text-primary transition-all duration-300"
              >
                {loadingMore ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <span className="text-xs font-black uppercase tracking-widest">Loading...</span>
                  </div>
                ) : (
                  <span className="text-xs font-black uppercase tracking-widest group-hover:tracking-[0.2em] transition-all duration-500">
                    Load More History
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
