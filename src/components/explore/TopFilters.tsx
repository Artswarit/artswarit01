
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import GlassCard from '@/components/ui/glass-card';
import { Search, Filter, Grid, List, SlidersHorizontal, X } from 'lucide-react';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface FilterState {
  search: string;
  category: string;
  artworkType: string;
  sortBy: string;
}

interface TopFiltersProps {
  onFiltersChange: (filters: FilterState & { tags: string[]; location: string; priceRange: string }) => void;
  onViewModeChange: (mode: 'grid' | 'list') => void;
  viewMode: 'grid' | 'list';
  resultsCount: number;
  initialCategory?: string;
  initialSearch?: string;
}

const TopFilters = ({ onFiltersChange, onViewModeChange, viewMode, resultsCount, initialCategory, initialSearch }: TopFiltersProps) => {
  const { format, userCurrencySymbol } = useCurrencyFormat();
  
  const [filters, setFilters] = useState<FilterState>({
    search: initialSearch || '',
    category: initialCategory || 'all',
    artworkType: 'all',
    sortBy: 'most_recent'
  });

  const [advancedFilters, setAdvancedFilters] = useState({
    tags: '',
    location: ''
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const categories = [
    "Digital Art", "Music", "Hip-Hop", "Abstract Art", "Landscape", 
    "Portrait", "Music Video", "Contemporary", "Traditional", "Photography",
    "Musicians", "Writers", "Rappers", "Editors", "Scriptwriters", 
    "Photographers", "Illustrators", "Voice Artists", "Animators", 
    "UI/UX Designers", "Singers", "Dancers"
  ];

  const activeFiltersCount = [
    filters.category !== 'all',
    filters.artworkType !== 'all',
    filters.sortBy !== 'most_recent',
    advancedFilters.tags.length > 0,
    advancedFilters.location.length > 0
  ].filter(Boolean).length;

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange({ 
      ...newFilters, 
      tags: advancedFilters.tags.split(',').map(t => t.trim()).filter(Boolean), 
      location: advancedFilters.location,
      priceRange: 'all'
    });
  };

  const handleAdvancedFilterChange = (key: 'tags' | 'location', value: string) => {
    const newAdvanced = { ...advancedFilters, [key]: value };
    setAdvancedFilters(newAdvanced);
    onFiltersChange({ 
      ...filters, 
      tags: newAdvanced.tags.split(',').map(t => t.trim()).filter(Boolean), 
      location: newAdvanced.location,
      priceRange: 'all'
    });
  };

  useEffect(() => {
    onFiltersChange({ 
      ...filters, 
      tags: advancedFilters.tags.split(',').map(t => t.trim()).filter(Boolean), 
      location: advancedFilters.location,
      priceRange: 'all'
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      search: initialSearch || '',
      category: initialCategory || prev.category
    }));
    onFiltersChange({ 
      search: initialSearch || '',
      category: initialCategory || 'all',
      artworkType: filters.artworkType,
      sortBy: filters.sortBy,
      tags: advancedFilters.tags.split(',').map(t => t.trim()).filter(Boolean),
      location: advancedFilters.location,
      priceRange: 'all'
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSearch, initialCategory]);

  const resetFilters = () => {
    const resetF = {
      search: '',
      category: 'all',
      artworkType: 'all',
      sortBy: 'most_recent'
    };
    const resetA = {
      tags: '',
      location: ''
    };
    setFilters(resetF);
    setAdvancedFilters(resetA);
    onFiltersChange({ ...resetF, tags: [], location: '', priceRange: 'all' });
  };

  return (
    <div className="transition-all duration-300 ease-apple">
      <div className="container mx-auto px-4 py-2.5 sm:py-3">
        {/* Main Filter Row */}
        <div className="flex flex-col lg:flex-row gap-2.5 sm:gap-3 items-stretch lg:items-center">
          {/* Results Count (visible on desktop in row) */}
          <div className="hidden xl:block shrink-0 pr-1">
            <p className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {resultsCount} artwork{resultsCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 lg:max-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search artworks"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10 h-11 bg-muted/50 border-transparent rounded-full focus-visible:ring-primary/20 focus-visible:bg-background text-sm transition-all duration-300 ease-apple"
            />
          </div>

          {/* Quick Filters */}
          <div className="grid grid-cols-2 xs:grid-cols-3 lg:flex gap-2 items-center flex-1">
            <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
              <SelectTrigger className="w-full lg:w-[170px] bg-muted/50 border-transparent rounded-full h-11 text-sm font-medium">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-popover/95 backdrop-blur-xl border-border/60 rounded-2xl max-h-[300px]">
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.artworkType} onValueChange={(value) => handleFilterChange('artworkType', value)}>
              <SelectTrigger className="w-full lg:w-[140px] bg-muted/50 border-transparent rounded-full h-11 text-sm font-medium">
                <SelectValue placeholder="Media" />
              </SelectTrigger>
              <SelectContent className="bg-popover/95 backdrop-blur-xl border-border/60 rounded-2xl">
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.sortBy} onValueChange={(value) => handleFilterChange('sortBy', value)}>
              <SelectTrigger className="w-full lg:w-[170px] bg-muted/50 border-transparent rounded-full h-11 text-sm font-medium">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent className="bg-popover/95 backdrop-blur-xl border-border/60 rounded-2xl">
                <SelectItem value="most_recent">Most recent</SelectItem>
                <SelectItem value="most_liked">Most liked</SelectItem>
                <SelectItem value="most_viewed">Most viewed</SelectItem>
                <SelectItem value="price_low">Price: low to high</SelectItem>
                <SelectItem value="price_high">Price: high to low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 justify-between lg:justify-start">
            <div className="flex items-center gap-2 flex-1 lg:flex-none">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn(
                  "h-11 px-4 flex-1 xs:flex-none rounded-full transition-all duration-300 ease-apple active:scale-[0.97]",
                  showAdvanced 
                    ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                    : "bg-muted/50 hover:bg-muted"
                )}
              >
                <SlidersHorizontal className={cn("w-4 h-4 mr-2 transition-transform duration-300 ease-apple", showAdvanced && "rotate-180")} />
                <span className="font-medium text-sm">Filters</span>
                {activeFiltersCount > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="ml-2 bg-background/70 text-foreground border-none h-5 min-w-5 flex items-center justify-center p-0 text-[10px]"
                  >
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-11 px-4 rounded-full bg-muted/50 hover:bg-muted transition-all duration-300 ease-apple active:scale-[0.97]"
                title="Reset filters"
              >
                <X className="w-4 h-4 xs:mr-1.5" />
                <span className="hidden xs:inline font-medium text-sm">Reset</span>
              </Button>
            </div>

            <div className="flex items-center justify-center bg-muted/50 rounded-full p-1 self-end xs:self-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onViewModeChange('grid')}
                aria-label="Grid view"
                className={cn(
                  "h-9 w-9 rounded-full transition-all duration-300 ease-apple",
                  viewMode === 'grid' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onViewModeChange('list')}
                aria-label="List view"
                className={cn(
                  "h-9 w-9 rounded-full transition-all duration-300 ease-apple",
                  viewMode === 'list' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile results count + active chips */}
        <div className="mt-2 flex xl:hidden flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            {resultsCount} artwork{resultsCount !== 1 ? 's' : ''}
          </p>
          
          <div className="flex flex-wrap gap-1.5">
            {filters.category !== 'all' && (
              <Badge variant="secondary" className="pl-3 pr-1 py-0.5 rounded-full bg-muted/60 text-foreground border-transparent text-[11px] font-medium">
                {filters.category}
                <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 rounded-full hover:bg-transparent" onClick={() => handleFilterChange('category', 'all')}>
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.artworkType !== 'all' && (
              <Badge variant="secondary" className="pl-3 pr-1 py-0.5 rounded-full bg-muted/60 text-foreground border-transparent text-[11px] font-medium">
                {filters.artworkType}
                <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 rounded-full hover:bg-transparent" onClick={() => handleFilterChange('artworkType', 'all')}>
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
          </div>
        </div>


        {/* Advanced Filters (Collapsible) */}
        {showAdvanced && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <GlassCard className="p-5 border-primary/10 bg-white/40 dark:bg-card/40 backdrop-blur-2xl shadow-xl rounded-3xl">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/80 ml-1">Search by Tags</label>
                  <div className="relative group">
                    <Input 
                      placeholder="e.g. abstract, blue, digital" 
                      value={advancedFilters.tags}
                      onChange={(e) => handleAdvancedFilterChange('tags', e.target.value)}
                      className="bg-white/60 dark:bg-background/60 border-border/20 rounded-2xl pl-4 h-11 focus-visible:ring-primary/20 transition-all group-hover:border-primary/30"
                    />
                  </div>
                  <p className="text-[9px] font-bold text-muted-foreground/40 ml-1 uppercase tracking-wider">Separate tags with commas</p>
                </div>
                
                <div className="space-y-2.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/80 ml-1">Artist Location</label>
                  <Input 
                    placeholder="e.g. New York, London" 
                    value={advancedFilters.location}
                    onChange={(e) => handleAdvancedFilterChange('location', e.target.value)}
                    className="bg-white/60 dark:bg-background/60 border-border/20 rounded-2xl h-11 focus-visible:ring-primary/20 transition-all hover:border-primary/30"
                  />
                </div>

                <div className="space-y-2.5 flex flex-col justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={resetFilters}
                    className="w-full bg-white/40 dark:bg-background/40 border-border/20 rounded-2xl h-11 text-xs font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all active:scale-[0.98]"
                  >
                    Clear All Filters
                  </Button>
                </div>
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopFilters;
