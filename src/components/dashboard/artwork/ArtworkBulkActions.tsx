import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2, Download, X } from 'lucide-react';

interface BulkActionsProps {
  selectedArtworks: string[];
  onClearSelection: () => void;
  onBulkAction: (action: string, options?: any) => void;
  isLoading?: boolean;
}

/**
 * Floating action bar for the current artwork selection.
 *
 * Portalled and `fixed` for two reasons: the dashboard route sits inside a
 * framer-motion wrapper with `will-change: transform`, which would otherwise
 * make `fixed` resolve against that page-tall element rather than the
 * viewport; and rendering in flow (as this previously did) pushed the grid
 * down every time a card was ticked, so the page jumped under the cursor.
 */
const ArtworkBulkActions = ({
  selectedArtworks,
  onClearSelection,
  onBulkAction,
  isLoading = false,
}: BulkActionsProps) => {
  const count = selectedArtworks.length;
  if (count === 0) return null;

  return createPortal(
    <div
      role="region"
      aria-label={`${count} artwork${count !== 1 ? 's' : ''} selected`}
      className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[90] flex justify-center px-4 sm:bottom-6"
    >
      {/* `flex-1` rather than `w-full`: index.css carries a global
          `.w-full { max-width: 100% !important }`, which would override
          max-w-xl and stretch this bar across the whole viewport. */}
      <div className="pointer-events-auto flex max-w-xl flex-1 items-center gap-2 rounded-2xl border border-border/60 bg-card/95 p-2 shadow-lg backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearSelection}
          aria-label="Clear selection"
          className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>

        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {count} <span className="font-normal text-muted-foreground">selected</span>
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => onBulkAction('export')}
            className="h-9 gap-1.5 rounded-lg px-3 text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Export</span>
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={isLoading}
                className="h-9 gap-1.5 rounded-lg px-3 text-xs font-medium"
              >
                {isLoading ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span className="hidden xs:inline">{isLoading ? 'Deleting…' : 'Delete'}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="w-[92vw] max-w-sm rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete {count} artwork{count !== 1 ? 's' : ''}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes {count !== 1 ? 'these artworks' : 'this artwork'} and
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="mt-0 rounded-lg">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onBulkAction('delete')}
                  className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ArtworkBulkActions;
