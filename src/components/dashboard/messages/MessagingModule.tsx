import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search,
  Send,
  Loader2,
  MoreVertical,
  ArrowLeft,
  MessageSquare,
  Clock,
  Check,
  CheckCheck,
  Trash2,
  BellOff,
  User,
  Ban,
  Smile,
  X } from
"lucide-react";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useAuth } from "@/contexts/AuthContext";
import {
  AttachmentInput,
  AttachmentPreview,
  AttachmentDisplay,
  Attachment } from
"@/components/messages/MessageAttachments";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";

interface MessagingModuleProps {
  onChatActiveChange?: (isActive: boolean) => void;
}

const MessagingModule = ({ onChatActiveChange }: MessagingModuleProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const {
    conversations,
    messages,
    setMessages,
    activeConversationId,
    setActiveConversationId,
    sendMessage,
    loading
  } = useRealtimeMessages();

  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchingGlobally, setIsSearchingGlobally] = useState(false);
  const [globalSearchResults, setGlobalSearchResults] = useState<{convId: string, userName: string, content: string}[]>([]);
  const [showConversationList, setShowConversationList] = useState(true);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);

  // Get active conversation details
  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );

  // Filter conversations based on search query
  const filteredConversations = conversations.filter(
    (conv) =>
    conv.otherUser?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.projectTitle?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter messages based on local state (just show all for unified search)
  const filteredMessages = messages;

  // Track whether user is pinned at the bottom of the message list
  const isAtBottomRef = useRef(true);

  // Keep isAtBottomRef updated as user scrolls
  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      // Consider "at bottom" if within 150px of the bottom edge
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 150;
    };
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [activeConversationId]);

  // Auto-scroll: only if user is already pinned at bottom
  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport || messages.length === 0) return;
    if (isAtBottomRef.current) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  // Always jump to bottom when switching conversations
  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport || !activeConversationId) return;
    isAtBottomRef.current = true;
    // Small delay to let the messages render first
    setTimeout(() => {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "instant" });
    }, 50);
  }, [activeConversationId]);

  // Handle mobile view toggling
  useEffect(() => {
    if (activeConversationId) {
      setShowConversationList(false);
      onChatActiveChange?.(true);
    } else {
      setShowConversationList(true);
      onChatActiveChange?.(false);
    }
  }, [activeConversationId, onChatActiveChange]);

  // Handle URL sync for conversation ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get("conversationId");
    if (convId && convId !== activeConversationId) {
      setActiveConversationId(convId);
    }
  }, [setActiveConversationId, activeConversationId]);

  // Format timestamp for display
  const formatMessageTime = (timestamp: Date | null) => {
    if (!timestamp) return "";
    const now = new Date();
    const diffInDays = Math.floor(
      (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffInDays === 0) {
      return timestamp.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
    } else if (diffInDays === 1) {
      return "Yesterday";
    } else if (diffInDays < 7) {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return days[timestamp.getDay()];
    } else {
      return timestamp.toLocaleDateString();
    }
  };

  const [isClearing, setIsClearing] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    controllerRef.current = new AbortController();
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const handleSendMessage = async () => {
    if (!messageInput.trim() && pendingAttachments.length === 0) return;
    if (!activeConversationId) return;

    const content = messageInput.trim();
    const attachments = [...pendingAttachments];

    if (!content && attachments.length === 0) return;

    // Optimistic Update
    const tempId = crypto.randomUUID();
    const optimisticMsg: any = {
      id: tempId,
      senderId: user.id,
      text: content || (attachments.length > 0 ? "📎 Attachment" : ""),
      timestamp: new Date(),
      read: false,
      attachments: attachments
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setMessageInput("");
    setPendingAttachments([]);
    setTimeout(() => {
      if (messagesViewportRef.current) {
        messagesViewportRef.current.scrollTo({ top: messagesViewportRef.current.scrollHeight, behavior: "instant" });
      }
    }, 50);

    try {
      await sendMessage(
        activeConversationId,
        content,
        attachments,
        controllerRef.current?.signal
      );
    } catch (error: any) {
      if (
      error.name === "AbortError" ||
      error.message?.includes("signal is aborted"))

      return;
      toast({
        variant: "destructive",
        title: "Failed to send",
        description:
        error.message || "Could not send message. Please try again."
      });
    }
  };

  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);

  const handleGlobalSearch = useCallback(async (query: string) => {
    if (query.length < 3 || !user?.id) {
      setGlobalSearchResults([]);
      return;
    }
    setIsSearchingGlobally(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("content, conversation_id, conversations!inner(client_id)")
        .eq("conversations.artist_id", user.id)
        .ilike("content", `%${query}%`)
        .limit(5);

      if (error) throw error;

      const results = await Promise.all((data || []).map(async (msg: any) => {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", msg.conversations.client_id).maybeSingle();
        return {
          convId: msg.conversation_id,
          userName: profile?.full_name || "Client",
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

  const handleAttach = (attachment: Attachment) => {
    setPendingAttachments((prev) => [...prev, attachment]);
  };

  const handleRemoveAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleViewProfile = (userId?: any) => {
    const id = typeof userId === 'string' ? userId : activeConversation?.otherUser?.id;
    if (id) {
      if (id === user?.id) {
        // If it's our own profile, navigate to artist profile since this is MessagingModule (Artist side)
        navigate(`/artist/${id}`);
      } else {
        // Otherwise navigate to client profile
        navigate(`/profile/${id}`);
      }
    }
  };

  const handleMuteNotifications = () => {
    toast({
      title: "Notifications Muted",
      description: `You will no longer receive notifications for this chat.`
    });
  };

  const handleClearChat = async () => {
    if (!activeConversationId || isClearing || !user?.id) return;

    const confirmed = window.confirm(
      "Are you sure you want to clear this chat? This will hide all previous messages for you."
    );
    if (!confirmed) return;

    setIsClearing(true);
    try {
      // Instead of deleting from DB, we update the last_cleared_at timestamp for the current user
      const now = new Date().toISOString();
      const isClient = activeConversation?.clientId === user.id;

      const { error } = await supabase.
      from("conversations").
      update({
        [isClient ? "client_last_cleared_at" : "artist_last_cleared_at"]: now
      }).
      eq("id", activeConversationId).
      abortSignal(controllerRef.current?.signal);

      if (error) {
        if (
        error.name === "AbortError" ||
        (error as any).code === "ABORT" ||
        error.message?.includes("signal is aborted"))

        return;
        throw error;
      }

      // Explicitly clear local messages
      setMessages([]);

      toast({
        title: "Chat Cleared",
        description: "All previous messages have been hidden for you."
      });
    } catch (error: any) {
      if (
      error.name === "AbortError" ||
      error.code === "ABORT" ||
      error.message?.includes("signal is aborted"))

      return;
      console.error("Error clearing chat:", error);
      toast({
        title: "Error",
        description: "Failed to clear chat. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleBlockUser = async () => {
    if (!activeConversation?.otherUser?.id || !user?.id) return;

    const confirmed = window.confirm(
      `Are you sure you want to block ${activeConversation.otherUser.name}? You won't receive messages from them.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase.
      from("user_blocks").
      insert({
        blocker_id: user.id,
        blocked_id: activeConversation.otherUser.id
      }).
      abortSignal(controllerRef.current?.signal);

      if (error) {
        if (
        error.name === "AbortError" ||
        (error as any).code === "ABORT" ||
        error.message?.includes("signal is aborted"))

        return;
        throw error;
      }

      toast({
        title: "User Blocked",
        description: `${activeConversation.otherUser.name} has been blocked.`
      });

      // Clear active conversation
      setActiveConversationId(null);
    } catch (error: any) {
      if (
      error.name === "AbortError" ||
      error.code === "ABORT" ||
      error.message?.includes("signal is aborted"))

      return;
      console.error("Error blocking user:", error);
      toast({
        title: "Error",
        description:
        error.code === "23505" ?
        "User is already blocked." :
        "Failed to block user. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleClearAllChats = async () => {
    if (!user?.id || conversations.length === 0) return;
    const confirmed = window.confirm("Are you sure you want to clear ALL chats? This will hide all current messages in all your conversations.");
    if (!confirmed) return;

    try {
      const { error } = await supabase.from("conversations").update({ artist_last_cleared_at: new Date().toISOString() }).eq("artist_id", user.id);
      if (error) throw error;
      toast({ title: "All Chats Cleared", description: "All your conversation histories have been hidden." });
    } catch (error) {
      console.error("Error clearing all chats:", error);
      toast({ title: "Error", description: "Failed to clear chats.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-12rem)] min-h-[500px] bg-white dark:bg-card rounded-2xl sm:rounded-3xl shadow-xl border border-muted/20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">
            Loading your messages...
          </p>
        </div>
      </div>);

  }

  return (
    <div className={cn(
      "flex flex-col bg-white dark:bg-card transition-all duration-500 ease-in-out animate-fade-in relative mx-auto w-full",
      activeConversationId ?
        "fixed inset-0 z-[100] h-[100dvh] lg:relative lg:inset-auto lg:h-[calc(100vh-13rem)] lg:sm:h-[calc(100vh-15rem)] lg:min-h-[550px] lg:max-h-[900px] lg:rounded-2xl lg:sm:rounded-[2.5rem] lg:shadow-2xl lg:border lg:border-muted/20 lg:max-w-[1400px]" :
        "h-[calc(100vh-13rem)] sm:h-[calc(100vh-15rem)] min-h-[550px] max-h-[900px] rounded-2xl sm:rounded-[2.5rem] shadow-2xl border border-muted/20 max-w-[1400px]"
    )}>
      <div className="flex flex-1 overflow-hidden relative">
        {/* Conversations Sidebar */}
        <aside
          className={cn(
            "w-full lg:w-96 border-r border-muted/20 flex flex-col bg-slate-50/30 dark:bg-card/30 transition-all duration-500 ease-in-out z-20",
            !showConversationList && "hidden lg:flex"
          )}>
          
          <div className="p-4 sm:p-7 space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-br from-primary via-primary/90 to-purple-600 bg-clip-text text-transparent tracking-tighter">
                Messages
              </h2>
            </div>
            <div className="relative group px-1">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-all duration-300" />
              <Input
                placeholder="Search clients or messages..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleGlobalSearch(e.target.value);
                }}
                className="pl-12 bg-white/80 dark:bg-background/40 border-muted/20 focus:border-primary/40 focus:ring-4 focus:ring-primary/5 rounded-[1.25rem] h-12 sm:h-14 text-base transition-all shadow-sm group-focus-within:shadow-xl group-focus-within:shadow-primary/5 min-h-[48px]" />
              {isSearchingGlobally && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />}

              {globalSearchResults.length > 0 && (
                <div className="absolute top-full left-1 right-1 z-50 mt-2 bg-white dark:bg-card border border-muted/20 rounded-[1.5rem] shadow-2xl p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300 backdrop-blur-xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-3 py-1">Recent Matches</p>
                  {globalSearchResults.map((res, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setActiveConversationId(res.convId);
                        setGlobalSearchResults([]);
                        setSearchQuery("");
                      }}
                      className="w-full text-left p-3 hover:bg-primary/5 rounded-2xl transition-all group flex flex-col gap-1 border border-transparent hover:border-primary/10"
                    >
                      <p className="text-xs font-black text-primary group-hover:underline flex items-center gap-2">
                        <User className="h-3 w-3" /> {res.userName}
                      </p>
                      <p className="text-sm text-muted-foreground/80 truncate italic tracking-tight">"{res.content}"</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 px-3 sm:px-4">
            <div className="pb-8 space-y-3">
              {filteredConversations.length === 0 ?
              <div className="flex flex-col items-center justify-center py-24 px-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                  <div className="p-7 rounded-[2rem] bg-primary/5 ring-12 ring-primary/[0.02]">
                    <MessageSquare className="h-10 w-10 text-primary/20" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-base text-muted-foreground font-black tracking-tight">
                      No conversations found
                    </p>
                    <p className="text-xs text-muted-foreground/60 font-medium">
                      Try searching for a different name or project
                    </p>
                  </div>
                </div> :

              filteredConversations.map((conv, index) =>
              <div
                key={conv.id}
                className={cn(
                  "group relative p-4 sm:p-5 rounded-[1.75rem] cursor-pointer transition-all duration-500 animate-fade-in border-2 border-transparent min-h-[80px] sm:min-h-[100px]",
                  activeConversationId === conv.id ?
                  "bg-white dark:bg-background shadow-2xl shadow-primary/10 border-primary/10 translate-x-1" :
                  "hover:bg-white/90 dark:hover:bg-background/60 hover:translate-x-1"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => setActiveConversationId(conv.id)} role="button" tabIndex={0} onKeyDown={(e) => {if (e.key === "Enter" || e.key === " ") {e.preventDefault(); setActiveConversationId(conv.id);}}}>
                
                    <div className="flex gap-4 sm:gap-5 items-center">
                      <div className="relative shrink-0">
                        <Avatar className="h-12 w-12 sm:h-16 sm:w-16 rounded-[1.25rem] shadow-lg border-2 border-white dark:border-muted/20 transition-all duration-500 group-hover:scale-105 group-hover:rotate-2">
                          <AvatarImage src={conv.otherUser?.avatar} />
                          <AvatarFallback className="bg-primary/5 text-primary text-base font-black">
                            {conv.otherUser?.name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {conv.otherUser?.isOnline &&
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 bg-emerald-500 border-4 border-white dark:border-card rounded-full shadow-lg ring-4 ring-emerald-500/20" />
                    }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1 sm:mb-1.5">
                          <h3
                        className={cn(
                          "text-sm sm:text-lg font-black truncate transition-colors leading-none tracking-tight",
                          activeConversationId === conv.id ?
                          "text-primary" :
                          "group-hover:text-primary"
                        )}>
                        
                            {conv.otherUser?.name || "Client"}
                          </h3>
                          {conv.lastMessageTime &&
                      <span className="text-[9px] sm:text-xs text-muted-foreground/50 font-black whitespace-nowrap ml-2 sm:ml-3 uppercase tracking-widest">
                              {formatMessageTime(conv.lastMessageTime)}
                            </span>
                      }
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:gap-4">
                          <p className="text-xs sm:text-sm text-muted-foreground/70 truncate leading-relaxed font-semibold">
                            {conv.lastMessage || "Start a conversation..."}
                          </p>
                          {conv.unreadCount > 0 &&
                      <Badge className="bg-primary text-primary-foreground text-[9px] sm:text-xs h-5 sm:h-7 min-w-[20px] sm:min-w-[28px] px-1.5 sm:px-2 rounded-full border-none shadow-xl shadow-primary/30 flex items-center justify-center animate-bounce font-black">
                              {conv.unreadCount}
                            </Badge>
                      }
                        </div>
                        {conv.projectTitle &&
                    <div className="mt-2 sm:mt-3">
                            <Badge
                        variant="outline"
                        className="text-[8px] sm:text-[10px] py-0.5 sm:py-1 px-2 sm:px-3 font-black border-primary/10 bg-primary/5 text-primary/60 uppercase tracking-widest rounded-xl transition-all group-hover:bg-primary group-hover:text-white group-hover:border-primary">
                        
                              {conv.projectTitle}
                            </Badge>
                          </div>
                    }
                      </div>
                    </div>
                  </div>
              )
              }
            </div>
          </ScrollArea>
        </aside>

        {/* Chat Main Area */}
        <main
          className={cn(
            "flex-1 flex flex-col bg-white dark:bg-card transition-all duration-500 ease-in-out relative z-10",
            showConversationList && !activeConversationId && "hidden lg:flex"
          )}>
          
          {activeConversation ?
          <>
              {/* Chat Header */}
              <header className="px-4 py-3 sm:px-8 sm:py-5 border-b border-muted/20 flex items-center justify-between bg-white/80 dark:bg-card/80 backdrop-blur-xl z-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
                  <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden rounded-xl h-12 w-12 hover:bg-primary/10 text-primary transition-all min-h-[48px]"
                  onClick={(e) => { e.stopPropagation(); setActiveConversationId(null); }}>
                  
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  
                  <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0 cursor-pointer group" onClick={handleViewProfile}>
                    <div className="relative shrink-0">
                      <Avatar className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl shadow-lg transition-transform group-hover:scale-105 duration-300">
                        <AvatarImage src={activeConversation.otherUser?.avatar} />
                        <AvatarFallback className="bg-primary/5 text-primary text-sm font-black">
                          {activeConversation.otherUser?.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {activeConversation.otherUser?.isOnline &&
                      <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-emerald-500 border-2 border-white dark:border-card rounded-full shadow-lg ring-2 ring-emerald-500/20" />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-black text-base sm:text-xl truncate leading-tight mb-1 group-hover:text-primary transition-colors min-h-[24px] flex items-center">
                        {activeConversation.otherUser?.name}
                      </h3>
                      <div className="flex items-center gap-3">
                        <span
                        className={cn(
                          "flex items-center gap-1.5 text-[10px] sm:text-xs font-black transition-colors uppercase tracking-widest min-h-[20px]",
                          activeConversation.otherUser?.isOnline ?
                          "text-emerald-500" :
                          "text-muted-foreground/60"
                        )}>
                        
                          {activeConversation.otherUser?.isOnline ?
                        <>
                              <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                              Online
                            </> :
                        <>
                              <span className="h-2 w-2 bg-muted-foreground/30 rounded-full" />
                              Offline
                            </>
                        }
                        </span>
                        {activeConversation.projectTitle &&
                      <>
                            <span className="h-1.5 w-1.5 bg-muted rounded-full" />
                            <span className="text-[10px] sm:text-xs text-muted-foreground/80 font-black truncate uppercase tracking-widest min-h-[20px] flex items-center">
                              {activeConversation.projectTitle}
                            </span>
                          </>
                      }
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl h-12 w-12 sm:h-12 sm:w-12 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all min-h-[48px]">
                      
                        <MoreVertical className="h-5 w-5 sm:h-6 sm:w-6" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                    align="end"
                    sideOffset={8}
                    className="w-56 sm:w-64 rounded-2xl p-2.5 shadow-2xl border-primary/5 animate-in fade-in zoom-in-95 duration-200 z-[100]">
                    
                      <DropdownMenuItem
                      className="gap-4 cursor-pointer text-sm rounded-xl py-3"
                      onSelect={handleViewProfile}>
                      
                        <div className="p-2 bg-primary/10 text-primary rounded-xl">
                          <User className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <span className="font-black">View Profile</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                      className="gap-4 cursor-pointer text-sm rounded-xl py-3"
                      onSelect={handleMuteNotifications}>
                      
                        <div className="p-2 bg-muted rounded-xl">
                          <BellOff className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <span className="font-black">Mute Chat</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-2.5" />
                      <DropdownMenuItem
                      className="gap-4 cursor-pointer text-sm text-destructive focus:text-destructive rounded-xl py-3"
                      onSelect={(e) => {
                        e.preventDefault();
                        setTimeout(() => {
                          handleClearChat();
                        }, 100);
                      }}>
                      
                        <div className="p-2 bg-destructive/10 text-destructive rounded-xl">
                          <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <span className="font-black">Clear History</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                      className="gap-4 cursor-pointer text-sm text-destructive focus:text-destructive rounded-xl py-3"
                      onSelect={(e) => {
                        e.preventDefault();
                        handleBlockUser();
                      }}>
                      
                        <div className="p-2 bg-destructive/10 text-destructive rounded-xl">
                          <Ban className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <span className="font-black">Block User</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-2" />
                      <DropdownMenuItem
                      className="gap-4 cursor-pointer text-sm text-destructive focus:text-destructive rounded-xl py-3"
                      onSelect={(e) => {
                        e.preventDefault();
                        handleClearAllChats();
                      }}>
                        <div className="p-2 bg-destructive/10 text-destructive rounded-xl">
                          <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <span className="font-black">Clear All Chats</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </header>

              <ScrollArea
              className="flex-1 bg-slate-50/30 dark:bg-background/20"
              viewportRef={messagesViewportRef}>
              
                <div className="p-5 sm:p-10 space-y-6 sm:space-y-10">
                  {filteredMessages.length === 0 ?
                <div className="flex flex-col items-center justify-center py-24 space-y-6 sm:space-y-8 text-center">
                      <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                        <div className="relative p-7 sm:p-10 rounded-[2.5rem] bg-white dark:bg-card shadow-2xl border border-primary/5">
                          <MessageSquare className="h-10 w-10 sm:h-16 sm:w-16 text-primary/40 animate-pulse" />
                        </div>
                      </div>
                      <div className="space-y-3 px-8">
                        <p className="font-black text-xl sm:text-3xl tracking-tight">
                          No messages found
                        </p>
                        <p className="text-sm sm:text-base text-muted-foreground/70 max-w-[240px] sm:max-w-md mx-auto leading-relaxed font-bold">
                          {searchQuery ?
                      "Try searching for something else." :
                      "Start a conversation by sending a message below to discuss your project."}
                        </p>
                      </div>
                    </div> :

                <>
                      {filteredMessages.map((msg, idx) => {
                    const nextMsg = filteredMessages[idx + 1];
                    const isOwn = msg.senderId === user?.id;
                    const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-2.5 sm:gap-3 group animate-fade-in",
                          isOwn ? "flex-row-reverse" : "flex-row"
                        )}
                        style={{ animationDelay: `${idx * 25}ms` }}>
                        
                        <div className="w-8 shrink-0 self-end mb-1">
                          {isLastInGroup && (
                            <Avatar 
                              className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg shadow-sm border border-muted/10 overflow-hidden cursor-pointer hover:scale-110 transition-transform duration-200 active:scale-95"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewProfile(isOwn ? user?.id : activeConversation?.otherUser?.id);
                              }}
                            >
                              <AvatarImage src={isOwn ? user?.user_metadata?.avatar_url : activeConversation?.otherUser?.avatar} className="object-cover" />
                              <AvatarFallback className="text-[10px] bg-primary/5 text-primary">
                                {isOwn ? (user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0)) : activeConversation?.otherUser?.name?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                                                <div className={cn("flex flex-col max-w-[80%] sm:max-w-[70%]", isOwn ? "items-end" : "items-start")}>
                          
                              <div
                            className={cn(
                              "relative px-5 py-3.5 sm:px-7 sm:py-4 rounded-[1.5rem] sm:rounded-[2rem] text-sm sm:text-base leading-relaxed shadow-sm transition-all duration-300 group-hover:shadow-md",
                              isOwn ?
                              "bg-primary text-primary-foreground rounded-tr-none shadow-primary/20 font-medium" :
                              "bg-white dark:bg-card text-foreground rounded-tl-none border border-muted/20 shadow-black/5 font-medium"
                            )}>
                            
                                <span>{msg.text}</span>
                                {msg.attachments &&
                            msg.attachments.length > 0 &&
                            <AttachmentDisplay
                              attachments={msg.attachments}
                              isOwnMessage={isOwn} />
                            }
                              </div>
                              <div className={cn("flex items-center gap-1.5 mt-1.5 px-1", isOwn ? "flex-row-reverse" : "flex-row")}>
                                <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                                  {formatMessageTime(msg.timestamp)}
                                </span>
                                {isOwn &&
                            <span
                              className={cn(
                                "flex items-center transition-colors",
                                msg.read ?
                                "text-emerald-500" :
                                "text-muted-foreground/60"
                              )}>
                              
                                    {msg.read ?
                              <CheckCheck className="h-3 w-3" /> :
                              <Check className="h-3 w-3" />
                              }
                                  </span>
                            }
                              </div>
                            </div>
                          </div>);

                  })}
                      <div className="h-4" />
                    </>
                }
                </div>
              </ScrollArea>

              {/* Message Input Area */}
              <div className="p-4 bg-white dark:bg-card border-t border-muted/20 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="max-w-4xl mx-auto">
                  {pendingAttachments.length > 0 &&
                <div className="flex flex-wrap gap-3 mb-4 animate-in slide-in-from-bottom-2 duration-300">
                      {pendingAttachments.map((attachment, index) =>
                  <AttachmentPreview
                    key={index}
                    attachment={attachment}
                    onRemove={() => handleRemoveAttachment(index)} />
  
                  )}
                    </div>
                }
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="flex-1 relative group bg-slate-50 dark:bg-background/50 border border-muted/30 focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/5 rounded-[2.5rem] transition-all flex items-center p-1">
                      <div className="flex items-center gap-0.5 pl-1.5 shrink-0">
                        <AttachmentInput
                        onAttach={handleAttach}
                        disabled={loading} />
                        <button
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="p-1 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                          title="Add emoji"
                        >
                          <Smile className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <textarea
                      rows={1}
                      value={messageInput}
                      onChange={(e) => {
                        setMessageInput(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type a message..."
                      className="w-full bg-transparent border-none focus:ring-0 py-1.5 sm:py-2 px-3 text-sm sm:text-base font-medium resize-none transition-all scrollbar-hide min-h-[36px] sm:min-h-[44px] max-h-[160px] sm:max-h-[240px] leading-tight flex-1" />
                      
                      {showEmojiPicker && (
                        <div className="absolute bottom-full left-0 mb-4 z-[110] animate-in fade-in slide-in-from-bottom-2">
                          <div className="fixed inset-0" onClick={() => setShowEmojiPicker(false)} />
                          <div className="relative shadow-2xl border border-muted/20 rounded-2xl overflow-hidden">
                            <EmojiPicker 
                              onEmojiClick={(emojiData) => {
                                setMessageInput(prev => prev + emojiData.emoji);
                                setShowEmojiPicker(false);
                              }}
                              width={320}
                              height={400}
                              theme={"auto" as any}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 pr-0.5">
                      <Button
                      onClick={handleSendMessage}
                      disabled={
                      !messageInput.trim() &&
                      pendingAttachments.length === 0 ||
                      loading
                      }
                      size="icon"
                      className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all shrink-0 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:scale-95 flex items-center justify-center p-0">
                      
                        {loading ?
                      <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> :
  
                       <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      }
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2.5 mt-4 opacity-40">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground text-center font-bold uppercase tracking-widest">
                      Press Enter to send • Shift + Enter for new line
                    </p>
                  </div>
                </div>
              </div>
            </> :

          <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-slate-50/20 dark:bg-background/10">
              <div className="relative mb-8 group">
                <div className="absolute inset-0 bg-primary/15 blur-3xl rounded-full group-hover:bg-primary/20 transition-all duration-500" />
                <div className="relative bg-white dark:bg-card p-8 sm:p-12 rounded-[3rem] shadow-2xl border border-primary/5 transition-transform duration-500 group-hover:scale-110">
                  <MessageSquare className="h-16 w-16 sm:h-24 sm:w-24 text-primary animate-bounce shadow-primary/20" />
                </div>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black mb-3 tracking-tight">
                Select a conversation
              </h2>
              <p className="text-xs sm:text-base text-muted-foreground/70 max-w-[240px] sm:max-w-md mx-auto leading-relaxed font-medium">
                Choose a client from the sidebar to start discussing your
                creative projects and manage collaborations.
              </p>
            </div>
          }
        </main>
      </div>
    </div>);

};

export default MessagingModule;




