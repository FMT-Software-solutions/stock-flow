import { useBranchContext } from '../../contexts/BranchContext';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '../ui/dropdown-menu';
import { Checkbox } from '../ui/checkbox';
import { GitBranch, ChevronDown, MapPin } from 'lucide-react';

export function BranchSelector() {
  const {
    availableBranches,
    selectedBranchIds,
    selectBranch,
    selectSingleBranch,
    selectAllBranches,
    isOwner,
    isLoading,
  } = useBranchContext();

  const selectedCount = selectedBranchIds.length;
  const allSelected =
    availableBranches.length > 1 && selectedCount === availableBranches.length;

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 px-3">
        <GitBranch className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (availableBranches.length === 0) {
    return (
      <Button variant="outline" disabled className="flex items-center gap-2">
        <GitBranch className="h-4 w-4" />
        <span>No Branches</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          <span className="hidden md:inline">
            {allSelected
              ? 'All Branches'
              : availableBranches.length === 1
              ? availableBranches[0].name
              : selectedCount === 0
              ? 'Select Branch'
              : `${selectedCount} Branch${selectedCount > 1 ? 'es' : ''}`}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>Select Branches</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isOwner && (
          <>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                selectAllBranches();
              }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox checked={allSelected} className="pointer-events-none" />
              <span>All Branches</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <div className="max-h-75 overflow-y-auto">
          {availableBranches.map((branch) => {
            const isSelected = selectedBranchIds.includes(branch.id);
            return (
              <DropdownMenuItem
                key={branch.id}
                onSelect={(e) => {
                  e.preventDefault();
                  selectBranch(branch.id);
                }}
                className="flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2 flex-1">
                  <Checkbox
                    checked={isSelected}
                    className="pointer-events-none"
                  />
                  <span className="truncate">{branch.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectSingleBranch(branch.id);
                  }}
                >
                  Only
                </Button>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
