import React from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";

interface Message {
  id: string;
  content: string;
  sender?: string;
  created_at?: string | Date;
  sender_id?: string;
  user_id?: string;
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  nextSame?: boolean;
  prevSame?: boolean;
  avatarUrl?: string | null;
  senderName?: string;
  children?: React.ReactNode;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  nextSame = false,
  prevSame = false,
  avatarUrl,
  senderName,
  children,
}) => {
  const timeString = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div
      className={cn(
        "flex items-end gap-2.5 max-w-[85%] sm:max-w-[75%] transition-all duration-300",
        isOwn ? "ml-auto flex-row-reverse" : "mr-auto"
      )}
    >
      {!isOwn && (
        <div className="w-8 h-8 shrink-0">
          {!nextSame && (
            <Avatar className="h-8 w-8 rounded-xl shadow-md border border-muted/20">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={senderName || "User"}
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase rounded-xl">
                  {(senderName || "U").slice(0, 1)}
                </div>
              )}
            </Avatar>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        {!isOwn && !nextSame && senderName && (
          <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest ml-1">
            {senderName}
          </span>
        )}
        <div
          className={cn(
            "px-4 py-3 text-sm font-medium leading-relaxed shadow-sm transition-all duration-200 select-text hover:shadow-md",
            isOwn
              ? "bg-primary text-primary-foreground font-semibold shadow-primary/5"
              : "bg-white dark:bg-card text-foreground border border-muted/30"
          )}
          style={{
            borderBottomRightRadius: isOwn && nextSame ? "6px" : "20px",
            borderTopRightRadius: isOwn && prevSame ? "6px" : "20px",
            borderBottomLeftRadius: !isOwn && nextSame ? "6px" : "20px",
            borderTopLeftRadius: !isOwn && prevSame ? "6px" : "20px",
          }}
        >
          {message.content && (
            <p className="whitespace-pre-wrap break-words text-[13.5px] sm:text-[14px]">
              {message.content}
            </p>
          )}
          {children}
          {timeString && (
            <span
              className={cn(
                "block text-[9px] mt-1.5 text-right font-bold uppercase tracking-wider",
                isOwn ? "text-primary-foreground/60" : "text-muted-foreground/50"
              )}
            >
              {timeString}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
