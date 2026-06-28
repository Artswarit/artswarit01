import { cn } from "@/lib/utils";

export type RangeKey = "7d" | "30d" | "90d";

interface Props {
  range: RangeKey;
  onChange: (r: RangeKey) => void;
  className?: string;
}

const OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
];

export function rangeToDate(r: RangeKey): Date {
  const days = r === "7d" ? 7 : r === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export default function AdminFilters({ range, onChange, className }: Props) {
  return (
    <div className={cn("flex p-0.5 bg-muted/50 rounded-full w-fit border border-border/40", className)}>
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "px-3 py-1.5 rounded-full text-[11px] font-medium transition-all",
            range === o.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
