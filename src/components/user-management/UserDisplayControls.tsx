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
      <div className="flex items-center gap-0.5 border rounded-md p-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={displayMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onDisplayModeChange('grid')}
              className="p-1"
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
              variant={displayMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onDisplayModeChange('table')}
              className="p-1"
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
