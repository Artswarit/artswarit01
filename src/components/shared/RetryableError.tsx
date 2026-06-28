import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Standard error + retry surface.
 *
 * Replaces "infinite spinner on failure" anti-patterns. Render this when a
 * fetch has resolved with an error and the user can retry. Never render
 * alongside a spinner — pick one.
 *
 * Intentionally minimal styling: callers control wrapper sizing (card,
 * fullscreen, inline) by passing `className`.
 */
export interface RetryableErrorProps {
  title?: string;
  description?: React.ReactNode;
  error?: unknown;
  onRetry?: () => void;
  retryLabel?: string;
  loading?: boolean;
  className?: string;
  size?: "sm" | "md";
}

const sizeMap = {
  sm: { wrap: "py-6", icon: "h-8 w-8", title: "text-sm", desc: "text-xs" },
  md: { wrap: "py-12", icon: "h-10 w-10", title: "text-base", desc: "text-sm" },
} as const;

const messageOf = (error: unknown): string | undefined => {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return undefined;
};

export const RetryableError: React.FC<RetryableErrorProps> = ({
  title = "Something went wrong",
  description,
  error,
  onRetry,
  retryLabel = "Try again",
  loading,
  className,
  size = "md",
}) => {
  const s = sizeMap[size];
  const detail = description ?? messageOf(error) ?? "Please check your connection and try again.";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6",
        s.wrap,
        className,
      )}
      role="alert"
    >
      <AlertTriangle className={cn("text-destructive mb-3", s.icon)} aria-hidden />
      <h3 className={cn("font-black tracking-tight text-foreground mb-1", s.title)}>{title}</h3>
      <p className={cn("text-muted-foreground max-w-sm leading-relaxed", s.desc, onRetry && "mb-4")}>
        {detail}
      </p>
      {onRetry ? (
        <Button
          variant="outline"
          size={size === "sm" ? "sm" : "default"}
          onClick={onRetry}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
};

export default RetryableError;
