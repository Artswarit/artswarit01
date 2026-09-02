import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';

interface Filters {
  search: string;
  category: string;
  status: string;
  type: string;
  tags: string[];
  sortBy: string;
}

interface SearchFiltersProps {
  onFiltersChange: (filters: Filters) => void;
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  category: 'all',
  status: 'all',
  type: 'all',
  tags: [],
  sortBy: 'newest',
};

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All categories' },
  { value: 'Music', label: 'Music' },
  { value: 'Digital Art', label: 'Digital Art' },
  { value: 'Photography', label: 'Photography' },
  { value: 'Video', label: 'Video' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All status' },
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
  { value: 'archived', label: 'Archived' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'image', label: 'Image' },
  { value: 'music', label: 'Music' },
  { value: 'video', label: 'Video' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'most_liked', label: 'Most liked' },
  { value: 'most_viewed', label: 'Most viewed' },
  { value: 'price_high', label: 'Price: high to low' },
  { value: 'price_low', label: 'Price: low to high' },
];

/** Compact select styled as a toolbar control rather than a form field. */
const FilterSelect = ({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}) => {
  const active = value !== 'all' && value !== 'newest';
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          // shrink-0 + whitespace-nowrap: without these the flex row squeezes
          // every trigger until the labels truncate to "All…".
          'h-9 w-auto shrink-0 gap-1.5 whitespace-nowrap rounded-lg border-border/60 bg-background px-3 text-xs font-medium',
          'transition-colors hover:bg-muted/50 focus:ring-2 focus:ring-ring focus:ring-offset-0',
          active && 'border-primary/40 bg-primary/5 text-primary',
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const ArtworkSearchFilters = ({ onFiltersChange }: SearchFiltersProps) => {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [tagInput, setTagInput] = useState('');

  const updateFilters = (newFilters: Filters) => {
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!filters.tags.includes(newTag)) {
        updateFilters({ ...filters, tags: [...filters.tags, newTag] });
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    updateFilters({ ...filters, tags: filters.tags.filter((tag) => tag !== tagToRemove) });
  };

  const clearFilters = () => {
    updateFilters({ ...DEFAULT_FILTERS, tags: [] });
    setTagInput('');
  };

  // Reset is a destructive-ish action, so it only appears once there is
  // something to reset — an always-visible button reads as a primary control.
  const activeCount =
    (filters.search.trim() ? 1 : 0) +
    (filters.category !== 'all' ? 1 : 0) +
    (filters.status !== 'all' ? 1 : 0) +
    (filters.type !== 'all' ? 1 : 0) +
    (filters.sortBy !== 'newest' ? 1 : 0) +
    filters.tags.length;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-token-xs sm:p-4">
      <div className="flex flex-col gap-3">
        {/* Search + reset */}
        <div className="flex items-center gap-2">
          <div className="group relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
            <Input
              placeholder="Search artworks..."
              value={filters.search}
              onChange={(e) => updateFilters({ ...filters, search: e.target.value })}
              className="h-9 rounded-lg border-border/60 bg-background pl-9 text-sm"
            />
          </div>
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 shrink-0 gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
              <span className="tabular-nums">{activeCount}</span>
            </Button>
          )}
        </div>

        {/* Filter controls — scroll sideways on narrow screens instead of
            stacking into a tall column. */}
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 no-scrollbar">
          <FilterSelect
            ariaLabel="Filter by category"
            value={filters.category}
            onChange={(value) => updateFilters({ ...filters, category: value })}
            options={CATEGORY_OPTIONS}
          />
          <FilterSelect
            ariaLabel="Filter by status"
            value={filters.status}
            onChange={(value) => updateFilters({ ...filters, status: value })}
            options={STATUS_OPTIONS}
          />
          <FilterSelect
            ariaLabel="Filter by type"
            value={filters.type}
            onChange={(value) => updateFilters({ ...filters, type: value })}
            options={TYPE_OPTIONS}
          />
          <div className="ml-auto shrink-0 pl-2">
            <FilterSelect
              ariaLabel="Sort artworks"
              value={filters.sortBy}
              onChange={(value) => updateFilters({ ...filters, sortBy: value })}
              options={SORT_OPTIONS}
            />
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
          <Input
            placeholder="Add tag filter…"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            aria-label="Add tag filter"
            className="h-8 w-full rounded-lg border-border/60 bg-background text-xs sm:w-48"
          />
          {filters.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="h-8 gap-1 rounded-lg border border-primary/20 bg-primary/5 pl-2.5 pr-1 text-xs font-medium text-primary"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove ${tag} tag`}
                className="grid h-5 w-5 place-items-center rounded transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ArtworkSearchFilters;
