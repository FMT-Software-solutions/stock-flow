import { useBranchContext } from '../../contexts/BranchContext';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '../ui/dropdown-menu';
import { GitBranch, ChevronDown } from 'lucide-react';

export function BranchSelector() {
  const { 
    availableBranches, 
    selectedBranchIds, 
    selectBranch, 
    selectAllBranches,
    isOwner,
    isLoading 
  } = useBranchContext();

  const selectedCount = selectedBranchIds.length;
  const allSelected = availableBranches.length > 0 && selectedCount === availableBranches.length;

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
          <GitBranch className="h-4 w-4" />
          <span className="hidden md:inline">
            {allSelected 
              ? 'All Branches' 
              : selectedCount === 0 
                ? 'Select Branch' 
                : `${selectedCount} Branch${selectedCount > 1 ? 'es' : ''}`}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Select Branches</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {isOwner && (
            <>
                <DropdownMenuCheckboxItem
                    checked={allSelected}
                    onCheckedChange={() => selectAllBranches()}
                >
                    All Branches
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
            </>
        )}

        {availableBranches.map((branch) => (
          <DropdownMenuCheckboxItem
            key={branch.id}
            checked={selectedBranchIds.includes(branch.id)}
            onCheckedChange={() => selectBranch(branch.id)}
            onSelect={(e) => e.preventDefault()}
          >
            {branch.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
