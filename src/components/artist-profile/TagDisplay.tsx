import React from "react";
import { Link } from "react-router-dom";
import { Tag as TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagDisplayProps {
  tags: string[];
  /**
   * When provided, each tag renders as a button that calls this instead of
   * navigating — for surfaces that filter in place (e.g. a profile's own
   * gallery). Omit it to get links into Explore.
   */
  onTagClick?: (tag: string) => void;
  /** Accessible name for the group. */
  label?: string;
  className?: string;
}

const chipClasses =
  "inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 " +
  "text-xs font-medium text-primary transition-colors " +
  "hover:border-primary/40 hover:bg-primary/10 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-background";

/**
 * Tag chips for artwork and profile surfaces.
 *
 * Every chip is a real interactive element — a `<button>` when the caller
 * handles the click, otherwise a `<Link>` into Explore's tag filter. The
 * previous version put `onClick` on a bare `<span>`, so tags were invisible
 * to keyboard and screen-reader users and, without a handler, silently did
 * nothing at all.
 */
const TagDisplay: React.FC<TagDisplayProps> = ({ tags, onTagClick, label = "Tags", className }) => {
  const cleaned = Array.from(
    new Set((tags ?? []).map((tag) => (tag ?? "").trim()).filter(Boolean)),
  );
  if (cleaned.length === 0) return null;

  return (
    <ul aria-label={label} className={cn("my-2 flex list-none flex-wrap gap-2 p-0", className)}>
      {cleaned.map((tag) => (
        <li key={tag}>
          {onTagClick ? (
            <button type="button" onClick={() => onTagClick(tag)} className={chipClasses}>
              <TagIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
              {tag}
            </button>
          ) : (
            <Link
              to={`/explore?tag=${encodeURIComponent(tag)}`}
              aria-label={`Explore artworks tagged ${tag}`}
              className={chipClasses}
            >
              <TagIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
              {tag}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
};

export default TagDisplay;
