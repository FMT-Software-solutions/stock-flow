import { Button } from '@/components/ui/button';
import { Grid3X3, Table } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { UserDisplayMode } from '@/types/user-management';

interface UserDisplayControlsProps {
  displayMode: UserDisplayMode;
  onDisplayModeChange: (mode: UserDisplayMode) => void;
}

export function UserDisplayControls({
  displayMode,
  onDisplayModeChange,
}: UserDisplayControlsProps) {
  return (
    <TooltipProvider>
      <div className="flex h-8 items-center gap-0.5 rounded-md border p-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={displayMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onDisplayModeChange('grid')}
              className="h-6 w-6 p-0"
              aria-label="Grid view"
              aria-pressed={displayMode === 'grid'}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Grid View</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={displayMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onDisplayModeChange('table')}
              className="h-6 w-6 p-0"
              aria-label="Table view"
              aria-pressed={displayMode === 'table'}
            >
              <Table className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Table View</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
