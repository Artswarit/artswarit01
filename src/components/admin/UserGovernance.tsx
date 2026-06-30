import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Search, Users, ShieldAlert, Ban, Clock,
  CheckCircle, AlertTriangle, RotateCcw, CreditCard,
  Mail, Shield, Filter, CheckSquare, X, Gavel
} from 'lucide-react';
import { writeAuditLog } from './auditHelpers';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import LogoLoader from '@/components/ui/LogoLoader';
import { RetryableError } from '@/components/shared/RetryableError';

/* ── Types ── */
interface ManagedUser {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  is_admin: boolean;
  account_status: string | null;
  avatar_url: string | null;
  created_at: string;
  active_warning?: string | null;
  warning_reason?: string;
  warning_expires?: string | null;
  payout_kyc?: string | null;
  payout_enabled?: boolean;
}

export default function UserGovernance() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<string>('');
  const [reason, setReason] = useState('');
  const [suspendDays, setSuspendDays] = useState('7');
  const [customNotifyText, setCustomNotifyText] = useState('');
  const [processing, setProcessing] = useState(false);

  // Fetch logic connects to live Supabase DB
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [profilesRes, adminRolesRes, warningsRes, payoutRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role, account_status, avatar_url, created_at').order('created_at', { ascending: false }),
        supabase.from('user_roles').select('user_id').eq('role', 'admin'),
        supabase.from('user_warnings').select('user_id, type, reason, expires_at, is_active').eq('is_active', true),
        supabase.from('razorpay_accounts').select('user_id, kyc_status, payouts_enabled')
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const adminUserIds = new Set((adminRolesRes.data || []).map(r => r.user_id));
      
      const warningMap: Record<string, { type: string; reason: string; expires_at: string | null }> = {};
      const severity: Record<string, number> = { warning: 1, suspension: 2, ban: 3 };
      (warningsRes.data || []).forEach((w: any) => {
        if (!warningMap[w.user_id] || (severity[w.type] || 0) > (severity[warningMap[w.user_id].type] || 0)) {
          warningMap[w.user_id] = { type: w.type, reason: w.reason, expires_at: w.expires_at };
        }
      });

      const payoutMap: Record<string, { kyc: string; enabled: boolean }> = {};
      (payoutRes.data || []).forEach((a: any) => {
        payoutMap[a.user_id] = { kyc: a.kyc_status, enabled: a.payouts_enabled };
      });

      const mapped: ManagedUser[] = (profilesRes.data || []).map((p: any) => ({
        ...p,
        is_admin: adminUserIds.has(p.id),
        active_warning: warningMap[p.id]?.type || null,
        warning_reason: warningMap[p.id]?.reason,
        warning_expires: warningMap[p.id]?.expires_at,
        payout_kyc: payoutMap[p.id]?.kyc || null,
        payout_enabled: payoutMap[p.id]?.enabled || false,
      }));

      setUsers(mapped);
    } catch (err) {
      console.error('Failed to load users:', err);
      setLoadError(err);
      toast.error('Failed to load users');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchUsers();
    // Realtime listeners
    const ch1 = supabase.channel('gov-profiles').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { fetchUsers(); }).subscribe();
    const ch2 = supabase.channel('gov-warnings').on('postgres_changes', { event: '*', schema: 'public', table: 'user_warnings' }, () => { fetchUsers(); }).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [fetchUsers]);

  const getStatus = (u: ManagedUser) => {
    if (u.active_warning === 'ban') return 'banned';
    if (u.active_warning === 'suspension') return 'suspended';
    if (u.active_warning === 'warning') return 'warned';
    return 'active';
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredUsers.length && filteredUsers.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredUsers.map(u => u.id)));
  };

  const filteredUsers = useMemo(() => {
    let result = users;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(u => (u.full_name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q) );
    }
    if (filterStatus !== 'all') result = result.filter(u => getStatus(u) === filterStatus);
    if (filterRole !== 'all') {
      if (filterRole === 'admin') result = result.filter(u => u.is_admin);
      else result = result.filter(u => u.role === filterRole && !u.is_admin);
    }
    return result;
  }, [users, search, filterStatus, filterRole]);

  const openAction = (u: ManagedUser) => {
    setSelectedUser(u);
    setActionType('');
    setReason('');
    setCustomNotifyText('');
    setDialogOpen(true);
  };

  const handleAction = async () => {
    const targetIds = selectedUser ? [selectedUser.id] : Array.from(selectedIds);
    if (targetIds.length === 0 || !actionType || !reason.trim()) return;
    
    setProcessing(true);
    try {
      for (const tid of targetIds) {
        switch (actionType) {
          case 'notify':
            await supabase.from('notifications').insert({ user_id: tid, title: 'System Notice', message: customNotifyText || reason, type: 'info' });
            await writeAuditLog(user?.id || 'system', 'ADMIN_MESSAGE_SENT', tid, reason, { message: customNotifyText });
            break;
          case 'warn':
            await supabase.from('user_warnings').insert({ user_id: tid, type: 'warning', reason, issued_by: user?.id, is_active: true });
            await writeAuditLog(user?.id || 'system', 'USER_WARNING', tid, reason);
            await supabase.from('notifications').insert({ user_id: tid, title: 'Compliance Warning', message: reason, type: 'warning' });
            break;
          case 'suspend':
            const exp = new Date(Date.now() + parseInt(suspendDays) * 86400000).toISOString();
            await supabase.from('user_warnings').update({ is_active: false }).eq('user_id', tid).eq('is_active', true);
            await supabase.from('user_warnings').insert({ user_id: tid, type: 'suspension', reason, issued_by: user?.id, is_active: true, expires_at: exp });
            await writeAuditLog(user?.id || 'system', 'USER_SUSPEND', tid, reason, { exp });
            await supabase.from('notifications').insert({ user_id: tid, title: 'Account Suspended', message: `Your account is suspended: ${reason}`, type: 'error' });
            break;
          case 'ban':
            await supabase.from('user_warnings').update({ is_active: false }).eq('user_id', tid).eq('is_active', true);
            await supabase.from('user_warnings').insert({ user_id: tid, type: 'ban', reason, issued_by: user?.id, is_active: true });
            await writeAuditLog(user?.id || 'system', 'USER_PERMANENT_BAN', tid, reason);
            break;
          case 'lift':
            await supabase.from('user_warnings').update({ is_active: false }).eq('user_id', tid).eq('is_active', true);
            await writeAuditLog(user?.id || 'system', 'USER_RESTRICTION_LIFTED', tid, reason);
            break;
        }
      }
      toast.success(selectedUser ? 'Action complete' : `Action applied to ${targetIds.length} users`);
      fetchUsers();
      setDialogOpen(false);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err.message || 'Governance update failed');
    } finally { setProcessing(false); }
  };

  const getStatusBadge = (s: string) => {
    if (s === 'banned') return <Badge variant="destructive" className="font-semibold text-[10px] uppercase tracking-wide">Banned</Badge>;
    if (s === 'suspended') return <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 font-semibold text-[10px] uppercase tracking-wide">Suspended</Badge>;
    if (s === 'warned') return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 font-semibold text-[10px] uppercase tracking-wide">Warned</Badge>;
    return <Badge variant="secondary" className="bg-green-500/10 text-green-600 hover:bg-green-500/20 font-semibold text-[10px] uppercase tracking-wide">Active</Badge>;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <LogoLoader text="Aggregating platform data…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <RetryableError
        title="Couldn't load users"
        error={loadError}
        onRetry={fetchUsers}
        loading={loading}
      />
    );
  }


  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
      {/* UI Refresh Verification Badge - Mobile Only */}
      <div className="sm:hidden flex justify-center py-2">
         <Badge variant="outline" className="bg-primary/5 text-primary/60 border-primary/10 text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full">
            Governance Core v2.2.0-Synced
         </Badge>
      </div>

      {/* Ultra-Dense Registry Header */}
      <div className="flex flex-col gap-3 px-1">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                 <Users className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                 <h2 className="text-sm font-black tracking-tight text-foreground/90 uppercase pr-2">Registry Control</h2>
                 <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest -mt-0.5 opacity-60">System Protocol Active</p>
              </div>
           </div>
           <div className="bg-foreground text-background px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm">
              <span className="text-xs font-black leading-none">{users.length}</span>
              <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-80">Users</span>
           </div>
        </div>

        <div className="grid grid-cols-1 gap-2 mt-1">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 transition-colors group-focus-within:text-primary" />
            <Input 
              placeholder="Filter identity or ID..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-9 h-11 bg-card rounded-2xl border-muted/30 focus-visible:ring-primary/20 text-xs font-bold shadow-none" 
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="h-10 bg-card text-[10px] font-black uppercase tracking-widest rounded-2xl border-muted/30 hover:bg-muted/10 transition-all">
                <Filter className="h-3.5 w-3.5 mr-2 text-primary/50" />
                <SelectValue placeholder="Access" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-muted/20">
                <SelectItem value="all">Role: All</SelectItem>
                <SelectItem value="artist">Artists</SelectItem>
                <SelectItem value="client">Clients</SelectItem>
                <SelectItem value="admin">System Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-10 bg-card text-[10px] font-black uppercase tracking-widest rounded-2xl border-muted/30 hover:bg-muted/10 transition-all">
                <ShieldAlert className="h-3.5 w-3.5 mr-2 text-primary/50" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-muted/20">
                <SelectItem value="all">State: All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="warned">Warned</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Modern Responsive Table/Card Layout */}
      <div className="space-y-3">
        {/* Desktop View: High Density Table */}
        <Card className="hidden sm:block border shadow-sm overflow-hidden bg-card rounded-[2rem]">
          <div className="overflow-x-auto w-full pb-4">
            <div className="min-w-[800px]">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[50px] pl-6">
                      <Checkbox checked={selectedIds.size === filteredUsers.length && filteredUsers.length > 0} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">User / Identity</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Role</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">KYC Status</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">HealthStatus</TableHead>
                    <TableHead className="text-right pr-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Governance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground font-medium">
                      No users found matching this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map(u => (
                    <TableRow key={u.id} className={cn("transition-colors", selectedIds.has(u.id) ? "bg-primary/5" : "hover:bg-muted/5")}>
                      <TableCell className="pl-6">
                        <Checkbox checked={selectedIds.has(u.id)} onCheckedChange={() => toggleSelect(u.id)} aria-label={`Select ${u.email}`} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full overflow-hidden bg-primary/10 border-2 border-background flex items-center justify-center shrink-0 shadow-sm">
                            {u.avatar_url ? <img loading="lazy" decoding="async" src={u.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] font-black text-primary">{(u.full_name || u.email).substring(0,2).toUpperCase()}</span>}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-sm text-foreground truncate">{u.full_name || 'Anonymous User'}</span>
                            <span className="text-[10px] text-muted-foreground truncate font-medium">{u.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.is_admin ? (
                           <Badge variant="default" className="font-black text-[9px] tracking-widest uppercase shadow-sm px-2 py-0.5">Admin</Badge>
                        ) : (
                           <Badge variant="outline" className="font-bold text-[9px] tracking-widest uppercase px-2 py-0.5 lowercase capitalize">{u.role}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.payout_kyc === 'activated' ? (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 uppercase tracking-tight"><CheckCircle className="h-3 w-3" /> Verified</div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tight"><Clock className="h-3 w-3" /> Pending</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(getStatus(u))}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="secondary" size="sm" onClick={() => openAction(u)} className="h-8 shadow-sm font-bold text-[11px] uppercase tracking-wider transition-all hover:bg-primary/10 hover:text-primary rounded-lg px-4">
                          Protocol
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              </Table>
            </div>
          </div>
        </Card>

        {/* Mobile View: High Density Responsive Cards */}
        <div className="block sm:hidden space-y-3">
           {filteredUsers.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground font-medium rounded-3xl border-dashed">
                 No platform users found.
              </Card>
           ) : (
              filteredUsers.map(u => (
                <Card key={u.id} className={cn(
                  "p-4 rounded-3xl border shadow-sm transition-all duration-300", 
                  selectedIds.has(u.id) ? "bg-primary/5 border-primary/20 ring-1 ring-primary/20" : "bg-card border-muted/40"
                )}>
                   <div className="flex items-start gap-3">
                      <div className="pt-1">
                        <Checkbox checked={selectedIds.has(u.id)} onCheckedChange={() => toggleSelect(u.id)} className="rounded-md h-5 w-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0 space-y-4">
                         <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                               <div className="h-10 w-10 rounded-xl overflow-hidden bg-primary/5 border border-muted/20 flex items-center justify-center shrink-0">
                                  {u.avatar_url ? <img loading="lazy" decoding="async" src={u.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-black text-primary">{(u.full_name || u.email).substring(0,2).toUpperCase()}</span>}
                               </div>
                               <div className="flex flex-col min-w-0">
                                 <span className="font-black text-sm text-foreground truncate tracking-tight">{u.full_name || 'Anonymous User'}</span>
                                 <span className="text-[10px] text-muted-foreground truncate font-medium">{u.email}</span>
                               </div>
                            </div>
                            <div className="shrink-0 pt-0.5">
                               {getStatusBadge(getStatus(u))}
                            </div>
                         </div>
                         
                         <div className="flex items-center gap-2 w-full">
                            <div className="flex-1 bg-muted/30 p-2.5 rounded-xl border border-muted/40 space-y-0.5">
                               <p className="text-[8px] font-black uppercase tracking-[0.1em] text-muted-foreground/60">Access Role</p>
                               {u.is_admin ? (
                                  <span className="text-[10px] font-black text-primary uppercase">Admin</span>
                               ) : (
                                  <span className="text-[10px] font-black text-foreground/80 uppercase">{u.role}</span>
                               )}
                            </div>
                            <div className="flex-1 bg-muted/30 p-2.5 rounded-xl border border-muted/40 space-y-0.5">
                               <p className="text-[8px] font-black uppercase tracking-[0.1em] text-muted-foreground/60">KYC Status</p>
                               <span className={cn("text-[10px] font-black uppercase", u.payout_kyc === 'activated' ? "text-green-600" : "text-amber-600")}>
                                  {u.payout_kyc === 'activated' ? "Verified" : "Pending"}
                               </span>
                            </div>
                         </div>

                         <Button 
                            variant="secondary" 
                            className="w-full h-10 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary/10 hover:text-primary transition-all border border-muted/40" 
                            onClick={() => openAction(u)}
                         >
                            Governance Action
                         </Button>
                      </div>
                   </div>
                </Card>
              ))
           )}
        </div>
      </div>

      {/* Floating Base Action Intelligence Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-lg z-50 animate-in slide-in-from-bottom-5">
          <div className="bg-foreground text-background shadow-2xl rounded-2xl p-2 flex items-center justify-between border border-border">
            <div className="flex items-center gap-3 ml-3">
              <CheckSquare className="h-5 w-5 text-primary-foreground opacity-80" />
              <div className="flex flex-col leading-none space-y-1">
                <span className="text-sm font-bold tracking-tight">{selectedIds.size} Selected</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" onClick={() => { setActionType('notify'); setDialogOpen(true); setSelectedUser(null); }} className="h-9 px-4 rounded-xl bg-background text-foreground hover:bg-muted font-bold tracking-tight border shadow-sm">
                <Gavel className="h-4 w-4 mr-2" /> Action
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="h-9 w-9 p-0 rounded-xl text-muted hover:text-background hover:bg-background/20" title="Deselect All">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Intervention Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Governance Protocol
            </DialogTitle>
            <DialogDescription>
              {selectedUser ? `Acting upon user: ${selectedUser.full_name || selectedUser.email}` : `Bulk intervention on ${selectedIds.size} users.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Administrative Action</Label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="notify"><div className="flex items-center gap-2 font-medium"><Mail className="h-4 w-4 text-primary" /> Direct System Message</div></SelectItem>
                  <SelectItem value="warn"><div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-amber-500" /> Formal Warning</div></SelectItem>
                  <SelectItem value="suspend"><div className="flex items-center gap-2 font-medium"><Clock className="h-4 w-4 text-orange-500" /> Temporary Suspension</div></SelectItem>
                  <SelectItem value="ban"><div className="flex items-center gap-2 font-medium"><Ban className="h-4 w-4 text-destructive" /> Permanent Ban</div></SelectItem>
                  <SelectItem value="lift"><div className="flex items-center gap-2 font-medium"><RotateCcw className="h-4 w-4 text-green-500" /> Restore Account</div></SelectItem>
                </SelectContent>
              </Select>
            </div>

            {actionType === 'notify' && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <Label>Notification Content</Label>
                <Textarea placeholder="Type the exact message users will see..." value={customNotifyText} onChange={e => setCustomNotifyText(e.target.value)} />
              </div>
            )}

            {actionType === 'suspend' && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <Label>Duration (Days)</Label>
                <Input type="number" min="1" value={suspendDays} onChange={e => setSuspendDays(e.target.value)} />
              </div>
            )}

            <div className="space-y-2">
              <Label>Internal Reason (Audit Log)</Label>
              <Textarea placeholder="Reasoning for audit compliance... (Mandatory)" value={reason} onChange={e => setReason(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAction} disabled={processing || !actionType || !reason.trim()} variant={actionType === 'ban' ? 'destructive' : 'default'}>
              {processing ? 'Processing...' : 'Execute Protocol'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
