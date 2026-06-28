import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, DollarSign, Image as ImageIcon, ShieldCheck, TrendingUp, AlertCircle, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import LogoLoader from '@/components/ui/LogoLoader';

export default function AdminOverview() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [
          { count: userCount },
          { count: artistCount },
          { count: artworkCount },
          { count: projectCount },
          { data: disputeData },
          { data: recentUsers }
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'artist'),
          supabase.from('artworks').select('*', { count: 'exact', head: true }),
          supabase.from('projects').select('*', { count: 'exact', head: true }),
          supabase.from('disputes').select('status'),
          supabase.from('profiles').select('created_at').order('created_at', { ascending: false }).limit(10)
        ]);

        const openDisputes = disputeData?.filter(d => d.status === 'open').length || 0;

        setStats({
          users: userCount || 0,
          artists: artistCount || 0,
          artworks: artworkCount || 0,
          projects: projectCount || 0,
          openDisputes,
          recentUsers: recentUsers || []
        });
      } catch (err) {
        console.error('Failed to fetch admin stats:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();

    // Multi-Channel Realtime Subscriptions
    const channels = [
      supabase.channel('overview-profiles').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchStats),
      supabase.channel('overview-artworks').on('postgres_changes', { event: '*', schema: 'public', table: 'artworks' }, fetchStats),
      supabase.channel('overview-projects').on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, fetchStats),
      supabase.channel('overview-disputes').on('postgres_changes', { event: '*', schema: 'public', table: 'disputes' }, fetchStats)
    ];

    channels.forEach(channel => channel.subscribe());

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, []);

  if (loading) return <div className="h-64 flex items-center justify-center"><LogoLoader text="Loading metrics..." /></div>;

  const cards = [
    { label: 'Total Users', value: stats.users, icon: Users, color: 'text-blue-600', bg: 'bg-blue-500/10' },
    { label: 'Active Artists', value: stats.artists, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    { label: 'Live Artworks', value: stats.artworks, icon: ImageIcon, color: 'text-purple-600', bg: 'bg-purple-500/10' },
    { label: 'Open Disputes', value: stats.openDisputes, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-500/10' },
  ];

  return (
    <div className="space-y-4 sm:space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="border shadow-none sm:shadow-sm hover:shadow-md transition-shadow rounded-2xl sm:rounded-3xl overflow-hidden bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 space-y-0 p-3 sm:p-6">
              <CardTitle className="text-[9px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground">{c.label}</CardTitle>
              <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl ${c.bg}`}>
                <c.icon className={`h-3 w-3 sm:h-4 sm:w-4 ${c.color}`} />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <div className="text-lg sm:text-2xl font-black">{c.value}</div>
              <p className="text-[8px] sm:text-[10px] text-muted-foreground mt-0.5 sm:mt-1 flex items-center gap-1">
                <Activity className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-emerald-500" />
                Live system data
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="rounded-3xl sm:rounded-[2rem] border shadow-sm overflow-hidden">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Growth Trajectory
            </CardTitle>
            <CardDescription className="text-[10px] sm:text-sm">New user registrations over time</CardDescription>
          </CardHeader>
          <CardContent className="h-[200px] sm:h-[300px] p-2 sm:p-6 pt-0 sm:pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{ name: 'J', val: 40 }, { name: 'F', val: 30 }, { name: 'M', val: 20 }, { name: 'A', val: 27 }]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} />
                <YAxis axisLine={false} tickLine={false} fontSize={10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                  cursor={{ fill: 'currentColor', opacity: 0.05 }}
                />
                <Bar dataKey="val" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-3xl sm:rounded-[2rem] border shadow-sm">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Platform Stability
            </CardTitle>
            <CardDescription className="text-[10px] sm:text-sm">Escrow and dispute status distribution</CardDescription>
          </CardHeader>
          <CardContent className="h-[200px] sm:h-[300px] flex items-center justify-center p-4 sm:p-6">
             <div className="text-center space-y-3 sm:space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-emerald-500/10 text-emerald-600 border-2 sm:border-4 border-emerald-500/20">
                   <ShieldCheck className="h-6 w-6 sm:h-10 sm:w-10" />
                </div>
                <div>
                   <p className="text-lg sm:text-xl font-black">{stats.projects}</p>
                   <p className="text-[9px] sm:text-xs text-muted-foreground uppercase tracking-widest font-bold">Total Projects Under Escrow</p>
                </div>
                <div className="flex gap-4 justify-center">
                   <div className="text-center">
                      <p className="text-xs sm:text-sm font-bold text-red-600">{stats.openDisputes}</p>
                      <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase">Active Disputes</p>
                   </div>
                   <div className="text-center">
                      <p className="text-xs sm:text-sm font-bold text-emerald-600">{stats.projects - stats.openDisputes}</p>
                      <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase">Healthy Projects</p>
                   </div>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl sm:rounded-[2rem] border shadow-sm overflow-hidden bg-card">
         <CardHeader className="bg-muted/30 p-4">
            <CardTitle className="text-[10px] sm:text-sm font-black uppercase tracking-[0.2em]">Live Audit Feed</CardTitle>
         </CardHeader>
         <CardContent className="p-0">
            <div className="divide-y border-t">
               {stats.recentUsers.slice(0, 5).map((u: any, i: number) => (
                  <div key={i} className="px-4 sm:px-6 py-3 flex items-center justify-between hover:bg-muted/10 transition-colors">
                     <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-[8px] font-black text-primary">CORE</div>
                        <p className="text-[11px] font-bold text-foreground/80">New platform secure access established</p>
                     </div>
                     <p className="text-[9px] text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded">{new Date(u.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
               ))}
            </div>
         </CardContent>
      </Card>
    </div>
  );
}
