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
    <div className={cn("flex p-1 bg-muted/40 rounded-full w-fit", className)}>
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all",
            range === o.key
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
