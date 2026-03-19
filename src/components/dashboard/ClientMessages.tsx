import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send, Search, MoreVertical, Loader2, MessageSquare,
  ArrowLeft, Check, CheckCheck, Clock, Trash2, BellOff, User, Ban, X, Smile,
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  AttachmentInput, AttachmentPreview, AttachmentDisplay, Attachment,
} from "@/components/messages/MessageAttachments";

const parseAttachments = (data: unknown): Attachment[] => {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is Attachment =>
      typeof item === "object" && item !== null &&
      "name" in item && "url" in item && "type" in item && "size" in item,
  );
};

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  attachments?: Attachment[];
}

interface Conversation {
  id: string;
  artist_id: string;
  client_id: string;
  project_title: string | null;
  status: string | null;
  updated_at: string;
  client_last_cleared_at?: string | null;
  artist_last_cleared_at?: string | null;
  artistName?: string;
  artistAvatar?: string;
  lastMessage?: string;
  unreadCount?: number;
  isOnline?: boolean;
}

/* ── Format Time Helper ── */
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const hours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  if (hours < 24) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  if (hours < 48) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/* ── Conversation Item ── */
const ConversationItem = ({ conversation, isSelected, onClick }: { conversation: Conversation; isSelected: boolean; onClick: () => void }) => (
  <div
    role="button"
    tabIndex={0}
    className={cn("group relative p-3 sm:p-4 rounded-2xl cursor-pointer transition-all duration-300 animate-fade-in min-h-[72px]",
      isSelected ? "bg-white dark:bg-background shadow-md border border-primary/10" : "hover:bg-white/60 dark:hover:bg-background/40")}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    }}
  >
    <div className="flex gap-3 sm:gap-4 items-center">
      <div className="relative shrink-0">
        <Avatar className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl shadow-sm border-2 border-white dark:border-muted/20">
          <AvatarImage src={conversation.artistAvatar} />
          <AvatarFallback className="bg-primary/5 text-primary font-bold">{conversation.artistName?.charAt(0) || "A"}</AvatarFallback>
        </Avatar>
        {conversation.isOnline && <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-card rounded-full shadow-sm" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <h3 className={cn("text-sm font-bold truncate transition-colors", isSelected ? "text-primary" : "group-hover:text-primary")}>{conversation.artistName}</h3>
          <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap ml-2">{formatTime(conversation.updated_at)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground truncate leading-relaxed">{conversation.lastMessage}</p>
          {(conversation.unreadCount || 0) > 0 && (
            <Badge className="bg-primary text-primary-foreground text-[10px] h-4.5 min-w-[18px] px-1 rounded-full border-none shadow-sm flex items-center justify-center animate-pulse font-bold">
              {conversation.unreadCount}
            </Badge>
          )}
        </div>
        {conversation.project_title && (
          <div className="mt-1.5 flex items-center gap-1">
            <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4 font-semibold border-muted/40 text-muted-foreground rounded-lg">{conversation.project_title}</Badge>
          </div>
        )}
      </div>
    </div>
  </div>
);

/* ── Message Bubble ── */
/* ── Message Bubble ── */
const MessageBubble = ({ message, isOwn, isLastInGroup, artistAvatar, artistName, userAvatar, onProfileClick }: {
  message: Message; isOwn: boolean; isLastInGroup: boolean; artistAvatar?: string; artistName?: string; userAvatar?: string; onProfileClick?: () => void;
}) => (
  <div className={cn("flex gap-2.5 sm:gap-3 animate-fade-in group", isOwn ? "flex-row-reverse" : "flex-row")}>
    <div className="w-8 shrink-0 self-end mb-1">
      {isLastInGroup && (
        <Avatar 
          className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg shadow-sm border border-muted/10 overflow-hidden cursor-pointer hover:scale-110 transition-transform duration-200 active:scale-95"
          onClick={(e) => {
            e.stopPropagation();
            onProfileClick?.();
          }}
        >
          <AvatarImage src={isOwn ? userAvatar : artistAvatar} className="object-cover" />
          <AvatarFallback className="text-[10px] bg-primary/5 text-primary">
            {isOwn ? user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) : artistName?.charAt(0)}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
    
    <div className={cn("flex flex-col max-w-[80%] sm:max-w-[70%]", isOwn ? "items-end" : "items-start")}>
      <div className={cn("relative p-3 shadow-sm transition-all duration-300",
        isOwn ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-none"
          : "bg-white dark:bg-background text-foreground border border-muted/20 rounded-2xl rounded-tl-none group-hover:shadow-md")}>
        {message.content && message.content !== "📎 Attachment" && (
          <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
        )}
        {message.attachments && message.attachments.length > 0 && (
          <div className={cn("mt-2", isOwn ? "opacity-90" : "")}>
            <AttachmentDisplay attachments={message.attachments} isOwnMessage={isOwn} />
          </div>
        )}
      </div>
      <div className={cn("flex items-center gap-1.5 mt-1.5 px-1", isOwn ? "flex-row-reverse" : "flex-row")}>
        <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
          {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        {isOwn && (
          <span className="flex items-center">
            {message.is_read ? <CheckCheck className="h-3 w-3 text-emerald-500" /> : <Check className="h-3 w-3 text-muted-foreground/60" />}
          </span>
        )}
      </div>
    </div>
  </div>
);

/* ── Empty Chat State ── */
const EmptyChatState = ({ query, artistName }: { query: string; artistName?: string }) => (
  <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
    <div className="p-4 rounded-full bg-primary/5 text-primary"><MessageSquare className="h-8 w-8" /></div>
    <div className="space-y-1">
      <p className="font-bold text-lg">{query ? "No matches found" : "No messages yet"}</p>
      <p className="text-sm text-muted-foreground">{query ? "Try searching for something else" : `Start the conversation with ${artistName}`}</p>
    </div>
  </div>
);

/* ── Main Component ── */
const ClientMessages = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showConversationList, setShowConversationList] = useState(true);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [isSearchingGlobally, setIsSearchingGlobally] = useState(false);
  const [globalSearchResults, setGlobalSearchResults] = useState<{convId: string, artistName: string, content: string}[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (viewportRef.current) viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "instant" });
  };

  /* ── Fetch Conversations ── */
  const fetchConversations = useCallback(async (signal?: AbortSignal) => {
    if (!user?.id) return;
    try {
      const { data: convData, error } = await supabase.from("conversations").select("*").eq("client_id", user.id).order("updated_at", { ascending: false });
      if (error) { if (error.name === "AbortError") return; throw error; }
      const enriched = await Promise.all((convData || []).map(async (conv) => {
        const { data: profile } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", conv.artist_id).maybeSingle();
        const clearedAt = conv.client_last_cleared_at;
        let msgQuery = supabase.from("messages").select("content, created_at, sender_id, is_read").eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(1);
        if (clearedAt) msgQuery = msgQuery.gt("created_at", clearedAt);
        const { data: lastMsgData } = await msgQuery;
        const { count: unreadCount } = await supabase.from("messages").select("*", { count: "exact", head: true }).eq("conversation_id", conv.id).eq("is_read", false).neq("sender_id", user.id);
        return { ...conv, artistName: profile?.full_name || "Artist", artistAvatar: profile?.avatar_url || "", lastMessage: lastMsgData?.[0]?.content || "No messages yet", unreadCount: unreadCount || 0, isOnline: false };
      }));
      if (!signal?.aborted) setConversations(enriched);
    } catch (err: any) {
      if (err.name === "AbortError") return;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  /* ── Fetch Messages ── */
  const fetchMessages = useCallback(async (convId: string, signal?: AbortSignal) => {
    if (!user?.id) return;
    try {
      const conv = conversations.find((c) => c.id === convId);
      const clearedAt = conv?.client_id === user.id ? conv?.client_last_cleared_at : conv?.artist_last_cleared_at;
      let query = supabase.from("messages").select("*").eq("conversation_id", convId).order("created_at", { ascending: true });
      if (clearedAt) query = query.gt("created_at", clearedAt);
      const { data, error } = await query;
      if (error) { if (error.name === "AbortError") return; throw error; }
      if (!signal?.aborted) {
        setMessages((data || []).map((m) => ({ ...m, attachments: parseAttachments(m.attachments) })));
        await supabase.from("messages").update({ is_read: true }).eq("conversation_id", convId).neq("sender_id", user.id);
      }
    } catch (err: any) { if (err.name === "AbortError") return; }
  }, [user?.id, conversations]);

  useEffect(() => { controllerRef.current = new AbortController(); return () => controllerRef.current?.abort(); }, []);
  useEffect(() => { const c = new AbortController(); fetchConversations(c.signal); return () => c.abort(); }, [fetchConversations]);
  useEffect(() => { if (messages.length === 0) return; const id = setTimeout(scrollToBottom, 100); return () => clearTimeout(id); }, [messages.length, selectedConversation]);
  useEffect(() => { if (selectedConversation) { const c = new AbortController(); fetchMessages(selectedConversation.id, c.signal); return () => c.abort(); } }, [selectedConversation, fetchMessages]);

  /* ── Realtime ── */
  useEffect(() => {
    if (!user?.id) return;
    const controller = new AbortController();
    const messagesChannel = supabase.channel(`client-messages-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newMsg = payload.new as any;
          if (selectedConversation && newMsg.conversation_id === selectedConversation.id) {
            const conv = conversations.find((c) => c.id === selectedConversation.id);
            const clearedAt = conv?.client_id === user.id ? conv?.client_last_cleared_at : conv?.artist_last_cleared_at;
            if (clearedAt && new Date(newMsg.created_at) <= new Date(clearedAt)) return;
            if (!controller.signal.aborted) {
              setMessages((prev) => { if (prev.some((m) => m.id === newMsg.id)) return prev; return [...prev, { ...newMsg, attachments: parseAttachments(newMsg.attachments) } as Message]; });
              setTimeout(scrollToBottom, 100);
            }
            if (newMsg.sender_id !== user.id) supabase.from("messages").update({ is_read: true }).eq("id", newMsg.id).abortSignal(controller.signal);
          }
        } else if (payload.eventType === "UPDATE") {
          const updatedMsg = payload.new as any;
          if (selectedConversation && updatedMsg.conversation_id === selectedConversation.id && !controller.signal.aborted)
            setMessages((prev) => prev.map((m) => m.id === updatedMsg.id ? { ...m, is_read: updatedMsg.is_read } : m));
        } else if (payload.eventType === "DELETE") {
          const deletedMsg = payload.old as any;
          if (!controller.signal.aborted) setMessages((prev) => prev.filter((m) => m.id !== deletedMsg.id));
        }
        if (!controller.signal.aborted) fetchConversations(controller.signal);
      }).subscribe();
    const conversationsChannel = supabase.channel(`client-conversations-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `client_id=eq.${user.id}` },
        () => { if (!controller.signal.aborted) fetchConversations(controller.signal); }).subscribe();
    return () => { controller.abort(); supabase.removeChannel(messagesChannel); supabase.removeChannel(conversationsChannel); };
  }, [user?.id, selectedConversation, fetchConversations, conversations]);

  /* ── Send Message ── */
  const handleSendMessage = async () => {
    if ((!newMessage.trim() && pendingAttachments.length === 0) || !selectedConversation || !user?.id) return;
    
    const content = newMessage.trim();
    const attachments = [...pendingAttachments];
    
    // Optimistic Update
    const tempId = crypto.randomUUID();
    const optimisticMsg: Message = {
      id: tempId,
      sender_id: user.id,
      content: content || (attachments.length > 0 ? "📎 Attachment" : ""),
      created_at: new Date().toISOString(),
      is_read: false,
      attachments
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage("");
    setPendingAttachments([]);
    setTimeout(scrollToBottom, 50);

    setSending(true);
    try {
      const { error, data } = await supabase.from("messages").insert({
        conversation_id: selectedConversation.id, sender_id: user.id,
        content: content || (attachments.length > 0 ? "📎 Attachment" : ""),
        is_read: false, attachments: attachments.length > 0 ? JSON.parse(JSON.stringify(attachments)) : [],
      }).select().single();
      
      if (error) { 
        if (error.name === "AbortError") return; 
        // Rollback on error
        setMessages(prev => prev.filter(m => m.id !== tempId));
        throw error; 
      }
      
      // Replace optimistic message with real message from DB
      setMessages(prev => prev.map(m => m.id === tempId ? { ...data, attachments: parseAttachments(data.attachments) } as Message : m));
      
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", selectedConversation.id);
    } catch (error: any) {
      if (error.name === "AbortError") return;
      toast({ variant: "destructive", title: "Failed to send message", description: error.message });
    } finally { setSending(false); }
  };

  /* ── Clear Chat ── */
  const handleClearChat = async () => {
    if (!selectedConversation || isClearing || !user?.id) return;
    const confirmed = globalThis.window.confirm("Are you sure you want to clear this chat?");
    if (!confirmed) return;
    setIsClearing(true);
    try {
      const isClient = selectedConversation.client_id === user.id;
      const { error } = await supabase.from("conversations")
        .update({ [isClient ? "client_last_cleared_at" : "artist_last_cleared_at"]: new Date().toISOString() })
        .eq("id", selectedConversation.id).abortSignal(controllerRef.current?.signal);
      if (error) { if (error.name === "AbortError" || (error as any).code === "ABORT" || error.message?.includes("signal is aborted")) return; throw error; }
      setMessages([]);
      toast({ title: "Chat Cleared", description: "All previous messages have been hidden for you." });
    } catch (error: any) {
      if (error.name === "AbortError" || error.code === "ABORT") return;
      toast({ title: "Error", description: "Failed to clear chat.", variant: "destructive" });
    } finally { setIsClearing(false); }
  };

  /* ── Block Artist ── */
  const handleBlockArtist = async () => {
    if (!selectedConversation?.artist_id || !user?.id) return;
    const confirmed = globalThis.window.confirm(`Are you sure you want to block ${selectedConversation.artistName}?`);
    if (!confirmed) return;
    try {
      const { error } = await supabase.from("user_blocks").insert({ blocker_id: user.id, blocked_id: selectedConversation.artist_id }).abortSignal(controllerRef.current?.signal);
      if (error) { if (error.name === "AbortError" || (error as any).code === "ABORT" || error.message?.includes("signal is aborted")) return; throw error; }
      toast({ title: "Artist Blocked", description: `${selectedConversation.artistName} has been blocked.` });
      handleBackToList();
    } catch (error: any) {
      if (error.name === "AbortError" || error.code === "ABORT") return;
      toast({ title: "Error", description: error.code === "23505" ? "Artist is already blocked." : "Failed to block artist.", variant: "destructive" });
    }
  };

  /* ── Mark All Read ── */
  const handleMarkAllRead = async () => {
    if (!user?.id || conversations.length === 0) return;
    try {
      const { error } = await supabase.from("messages").update({ is_read: true }).in("conversation_id", conversations.map((c) => c.id)).neq("sender_id", user.id);
      if (error) throw error;
      toast({ title: "Success", description: "All messages marked as read" });
      fetchConversations();
    } catch (error) {
      toast({ title: "Error", description: "Failed to mark messages as read", variant: "destructive" });
    }
  };

  /* ── Clear All Chats ── */
  const handleClearAllChats = async () => {
    if (!user?.id || conversations.length === 0 || isClearingAll) return;
    setIsClearingAll(true);
    try {
      const { error } = await supabase.from("conversations").update({ client_last_cleared_at: new Date().toISOString() }).eq("client_id", user.id);
      if (error) throw error;
      toast({ title: "Chats Cleared", description: "All conversations have been cleared" });
      setSelectedConversation(null); setMessages([]); fetchConversations();
    } catch (error) {
      toast({ title: "Error", description: "Failed to clear chats", variant: "destructive" });
    } finally { setIsClearingAll(false); }
  };

  const handleSelectConversation = (conv: Conversation) => { setSelectedConversation(conv); setShowConversationList(false); };
  const handleBackToList = () => { setShowConversationList(true); setSelectedConversation(null); };
  const handleViewProfile = (userId?: any) => { 
    const id = typeof userId === 'string' ? userId : selectedConversation?.artist_id;
    if (id) {
       if (id === user?.id) {
         // Clients don't have an "artist" profile usually, but they have a profile page
         navigate(`/profile/${id}`);
       } else {
         // Artists are viewed at /artist/:id
         navigate(`/artist/${id}`);
       }
    }
  };
  const handleMuteNotifications = () => toast({ title: "Notifications Muted", description: "You will no longer receive notifications for this chat." });
  const handleAttach = (attachment: Attachment) => setPendingAttachments((prev) => [...prev, attachment]);
  const handleRemoveAttachment = (index: number) => setPendingAttachments((prev) => prev.filter((_, i) => i !== index));

  const handleGlobalSearch = useCallback(async (query: string) => {
    if (query.length < 3 || !user?.id) {
      setGlobalSearchResults([]);
      return;
    }
    setIsSearchingGlobally(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("content, conversation_id, conversations!inner(artist_id)")
        .eq("conversations.client_id", user.id)
        .ilike("content", `%${query}%`)
        .limit(5);

      if (error) throw error;

      const results = await Promise.all((data || []).map(async (msg: any) => {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", msg.conversations.artist_id).maybeSingle();
        return {
          convId: msg.conversation_id,
          artistName: profile?.full_name || "Artist",
          content: msg.content
        };
      }));
      setGlobalSearchResults(results);
    } catch (err) {
      console.error("Global search error:", err);
    } finally {
      setIsSearchingGlobally(false);
    }
  }, [user?.id]);

  const filteredConversations = conversations.filter((conv) =>
    conv.artistName?.toLowerCase().includes(searchTerm.toLowerCase()) || conv.project_title?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredMessages = messages;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className={cn(
      "flex flex-col bg-white dark:bg-card transition-all duration-500 ease-in-out animate-fade-in mx-auto w-full",
      selectedConversation ? 
        "fixed inset-0 z-[100] h-[100dvh] lg:relative lg:inset-auto lg:h-[calc(100vh-12rem)] lg:min-h-[500px] lg:max-h-[800px] lg:rounded-3xl lg:shadow-xl lg:border lg:border-muted/20 lg:max-w-[1200px]" : 
        "h-[calc(100vh-12rem)] min-h-[500px] max-h-[800px] rounded-3xl shadow-xl border border-muted/20 max-w-[1200px]"
    )}>
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className={cn("w-full lg:w-80 border-r border-muted/20 flex flex-col bg-slate-50/50 dark:bg-card/50 transition-all duration-300", !showConversationList && "hidden lg:flex")}>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">Messages</h2>
            </div>
            <div className="relative group px-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Search artists or messages..." 
                value={searchTerm} 
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  handleGlobalSearch(e.target.value);
                }}
                className="pl-10 bg-white/50 dark:bg-background/50 border-muted/30 focus:border-primary/50 rounded-2xl h-11 text-xs transition-all" 
              />
              {isSearchingGlobally && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}

              {globalSearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white dark:bg-card border border-muted/20 rounded-2xl shadow-2xl p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-2 py-1">Message Results</p>
                  {globalSearchResults.map((res, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const conv = conversations.find(c => c.id === res.convId);
                        if (conv) handleSelectConversation(conv);
                        setGlobalSearchResults([]);
                        setSearchTerm("");
                      }}
                      className="w-full text-left p-2 hover:bg-muted/50 rounded-xl transition-colors group"
                    >
                      <p className="text-[10px] font-bold text-primary group-hover:underline">{res.artistName}</p>
                      <p className="text-xs text-muted-foreground truncate italic">"{res.content}"</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <ScrollArea className="flex-1 px-2">
            <div className="pb-4 space-y-1.5">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3">
                  <div className="p-3 rounded-full bg-muted/20"><MessageSquare className="h-6 w-6 text-muted-foreground opacity-50" /></div>
                  <p className="text-sm text-muted-foreground font-medium">No conversations found</p>
                </div>
              ) : filteredConversations.map((conversation) => (
                <ConversationItem key={conversation.id} conversation={conversation} isSelected={selectedConversation?.id === conversation.id} onClick={() => handleSelectConversation(conversation)} />
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* ── Main Chat ── */}
        <main className={cn("flex-1 flex flex-col bg-white dark:bg-card transition-all duration-300", showConversationList && !selectedConversation && "hidden lg:flex")}>
          {selectedConversation ? (
            <>
              {/* Header */}
              <header className="px-4 py-3 sm:px-6 border-b border-muted/20 flex items-center justify-between bg-white/80 dark:bg-card/80 backdrop-blur-md z-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Button variant="ghost" size="icon" className="lg:hidden rounded-full hover:bg-muted/30 h-12 w-12 min-h-[48px]" onClick={handleBackToList}><ArrowLeft className="h-5 w-5" /></Button>
                  
                  <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group" onClick={handleViewProfile}>
                    <div className="relative shrink-0">
                      <Avatar className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl shadow-sm transition-transform group-hover:scale-105 duration-300">
                        <AvatarImage src={selectedConversation.artistAvatar} />
                        <AvatarFallback className="bg-primary/5 text-primary">{selectedConversation.artistName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {selectedConversation.isOnline && <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-card rounded-full shadow-sm" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm sm:text-base truncate leading-none mb-1 group-hover:text-primary transition-colors">{selectedConversation.artistName}</h3>
                      <div className="flex items-center gap-2">
                        <span className={cn("flex items-center gap-1 text-[10px] sm:text-xs font-medium", selectedConversation.isOnline ? "text-emerald-500" : "text-muted-foreground")}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", selectedConversation.isOnline ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30")} />
                          {selectedConversation.isOnline ? "Online" : "Offline"}
                        </span>
                        {selectedConversation.project_title && (
                          <><span className="h-1 w-1 bg-muted rounded-full" /><span className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">Project: {selectedConversation.project_title}</span></>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 text-muted-foreground hover:text-primary transition-colors min-h-[48px]">
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={8} className="w-52 rounded-2xl p-2.5 shadow-2xl border-primary/5 z-[100]">
                      <DropdownMenuItem className="gap-3 cursor-pointer rounded-xl py-3" onSelect={() => handleViewProfile(selectedConversation.artist_id)}>
                        <div className="p-2 bg-primary/10 text-primary rounded-xl"><User className="h-4 w-4" /></div>
                        <span className="font-bold">View Profile</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-3 cursor-pointer rounded-xl py-3" onSelect={handleMuteNotifications}>
                        <div className="p-2 bg-muted rounded-xl"><BellOff className="h-4 w-4" /></div>
                        <span className="font-bold">Mute Notifications</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-2" />
                      <DropdownMenuItem className="gap-3 cursor-pointer text-destructive focus:text-destructive rounded-xl py-3" onSelect={(e) => { e.preventDefault(); handleClearChat(); }}>
                        <div className="p-2 bg-destructive/10 text-destructive rounded-xl"><Trash2 className="h-4 w-4" /></div>
                        <span className="font-bold">Clear Chat</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-3 cursor-pointer text-destructive focus:text-destructive rounded-xl py-3" onSelect={(e) => { e.preventDefault(); handleClearAllChats(); }}>
                        <div className="p-2 bg-destructive/10 text-destructive rounded-xl"><Trash2 className="h-4 w-4" /></div>
                        <span className="font-bold">Clear All Chats</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-3 cursor-pointer text-destructive focus:text-destructive rounded-xl py-3" onSelect={(e) => { e.preventDefault(); handleBlockArtist(); }}>
                        <div className="p-2 bg-destructive/10 text-destructive rounded-xl"><Ban className="h-4 w-4" /></div>
                        <span className="font-bold">Block Artist</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </header>

              {/* Messages */}
              <ScrollArea className="flex-1 bg-slate-50/30 dark:bg-background/20" viewportRef={viewportRef}>
                <div className="p-4 sm:p-6 space-y-6">
                  {filteredMessages.length === 0 ? <EmptyChatState query={searchTerm} artistName={selectedConversation.artistName} /> : (
                    filteredMessages.map((message, index) => {
                      const isOwn = message.sender_id === user?.id;
                      const nextMsg = filteredMessages[index + 1];
                      const isLastInGroup = !nextMsg || nextMsg.sender_id !== message.sender_id;
                      const showDateSeparator = index === 0 || new Date(message.created_at).toDateString() !== new Date(filteredMessages[index - 1].created_at).toDateString();
                      return (
                        <div key={message.id} className="space-y-4">
                          {showDateSeparator && (
                            <div className="flex justify-center my-6">
                              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/30 border border-muted/20 backdrop-blur-sm">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                  {new Date(message.created_at).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                                </span>
                              </div>
                            </div>
                          )}
                          <MessageBubble 
                            message={message} 
                            isOwn={isOwn} 
                            isLastInGroup={isLastInGroup} 
                            artistAvatar={selectedConversation.artistAvatar} 
                            artistName={selectedConversation.artistName} 
                            userAvatar={user?.user_metadata?.avatar_url}
                            onProfileClick={() => handleViewProfile(isOwn ? user?.id : selectedConversation.artist_id)}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <footer className="p-4 bg-white dark:bg-card border-t border-muted/20 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="max-w-4xl mx-auto space-y-3">
                  {pendingAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-3 pb-2 animate-in slide-in-from-bottom-2 duration-300">
                      {pendingAttachments.map((attachment, index) => (
                        <AttachmentPreview key={index} attachment={attachment} onRemove={() => handleRemoveAttachment(index)} />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-background/40 p-1.5 rounded-[2.5rem] border border-muted/30 focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/5 transition-all shadow-inner relative">
                    <div className="flex items-center gap-0.5 pl-1.5">
                      <AttachmentInput onAttach={handleAttach} disabled={sending} />
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="p-1 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                        title="Add emoji"
                      >
                        <Smile className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <Textarea 
                      placeholder="Write a message..." 
                      value={newMessage} 
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                      }}
                      className="min-h-[36px] max-h-[160px] py-2 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm sm:text-base font-medium resize-none scrollbar-hide leading-tight flex-1"
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} />
                    
                    <div className="pr-1">
                      <Button onClick={handleSendMessage} disabled={(!newMessage.trim() && pendingAttachments.length === 0) || sending} size="icon"
                        className={cn("rounded-full h-8 w-8 sm:h-9 sm:w-9 shrink-0 shadow-lg transition-all duration-300 flex items-center justify-center p-0",
                          newMessage.trim() || pendingAttachments.length > 0 ? "bg-primary hover:bg-primary/90 scale-100" : "bg-muted opacity-50 scale-95")}>
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                      </Button>
                    </div>

                    {showEmojiPicker && (
                      <div className="absolute bottom-full left-0 mb-4 z-[110] animate-in fade-in slide-in-from-bottom-2">
                        <div className="fixed inset-0" onClick={() => setShowEmojiPicker(false)} />
                        <div className="relative shadow-2xl border border-muted/20 rounded-2xl overflow-hidden">
                          <EmojiPicker 
                            onEmojiClick={(emojiData) => {
                              setNewMessage(prev => prev + emojiData.emoji);
                              setShowEmojiPicker(false);
                            }}
                            width={300}
                            height={400}
                            theme={"auto" as any}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-center text-muted-foreground font-medium px-4 opacity-30">Press Enter to send • Shift + Enter for new line</p>
                </div>
              </footer>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6 bg-slate-50/30 dark:bg-background/10">
              <div className="relative">
                <div className="absolute -inset-4 bg-primary/10 rounded-full blur-2xl animate-pulse" />
                <div className="relative p-6 rounded-3xl bg-white dark:bg-card shadow-xl border border-muted/20"><MessageSquare className="h-12 w-12 text-primary" /></div>
              </div>
              <div className="max-w-sm space-y-2">
                <h3 className="text-2xl font-bold">Your Messages</h3>
                <p className="text-muted-foreground">Select a conversation from the sidebar to start chatting with an artist about your project.</p>
              </div>
              <Button variant="outline" className="rounded-full px-6 border-primary/20 hover:bg-primary/5" onClick={() => setShowConversationList(true)}>View Conversations</Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ClientMessages;




