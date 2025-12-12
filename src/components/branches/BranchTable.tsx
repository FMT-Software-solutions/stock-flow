import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BranchForm } from '@/components/forms/BranchForm';
import { Edit, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { useBranchContext } from '@/contexts/BranchContext';
import type { Branch } from '@/types';

interface BranchTableProps {
  branches: Branch[];
  isLoading?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function BranchTable({
  branches,
  isLoading,
  canEdit = false,
}: BranchTableProps) {
  const { isOwner, userBranches } = useBranchContext();
  const [selectedBranch, setSelectedBranch] = useState<Branch | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSuccess = () => {
    setIsDialogOpen(false);
    setSelectedBranch(undefined);
  };

  const handleEdit = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="h-4 bg-gray-100 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-100 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-100 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-100 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-100 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-100 animate-pulse rounded" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <>
      <TooltipProvider>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => {
                const isAssigned = userBranches.some(
                  (ub) => ub.id === branch.id
                );
                const userCanEdit = canEdit && (isOwner || isAssigned);
                const isInactive = !branch.is_active;

                return (
                  <TableRow
                    key={branch.id}
                    className={isInactive ? 'opacity-60' : ''}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        {branch.name}
                        {isInactive && (
                          <Lock className="ml-2 h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{branch.location}</TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate">
                        {branch.description || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={branch.is_active ? 'default' : 'secondary'}
                        className={
                          isInactive ? 'bg-muted text-muted-foreground' : ''
                        }
                      >
                        {branch.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-sm ${
                          isInactive ? 'text-gray-400' : 'text-muted-foreground'
                        }`}
                      >
                        {branch.created_at
                          ? format(new Date(branch.created_at), 'MMM d, yyyy')
                          : 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {userCanEdit ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(branch)}
                          className="p-2"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              className="p-2 cursor-not-allowed"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              You do not have permission to edit this branch
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </TooltipProvider>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {selectedBranch ? 'Edit Branch' : 'Create New Branch'}
            </DialogTitle>
            <DialogDescription>
              {selectedBranch
                ? 'Update the branch information below.'
                : 'Fill in the details to create a new branch.'}
            </DialogDescription>
          </DialogHeader>
          <BranchForm branch={selectedBranch} onSuccess={handleSuccess} />
        </DialogContent>
      </Dialog>
    </>
  );
}
