import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { MapPin, Calendar, Edit, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { useBranchContext } from '@/contexts/BranchContext';
import type { Branch } from '@/types';

interface BranchGridProps {
  branches: Branch[];
  isLoading?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function BranchGrid({
  branches,
  isLoading,
  canEdit = false,
}: BranchGridProps) {
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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 bg-gray-100 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <>
      <TooltipProvider>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => {
            const isAssigned = userBranches.some((ub) => ub.id === branch.id);
            const userCanEdit = canEdit && (isOwner || isAssigned);
            const isInactive = !branch.is_active;

            return (
              <Card
                key={branch.id}
                className={`relative transition-all duration-200 ${
                  isInactive ? 'opacity-80' : 'hover:shadow-md'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle
                      className={`text-lg ${
                        isInactive ? 'opacity-60 dark:opacity-40' : ''
                      }`}
                    >
                      {branch.name}
                      {isInactive && (
                        <Lock className="inline ml-2 h-4 w-4 text-gray-400" />
                      )}
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={branch.is_active ? 'default' : 'secondary'}
                        className={
                          isInactive ? 'bg-muted text-muted-foreground' : ''
                        }
                      >
                        {branch.is_active ? 'Active' : 'Inactive'}
                      </Badge>
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
                    </div>
                  </div>
                  <div
                    className={`flex items-center text-sm ${
                      isInactive ? 'text-gray-500' : 'text-primary'
                    }`}
                  >
                    <MapPin className="mr-1 h-4 w-4" />
                    {branch.location}
                  </div>
                </CardHeader>
                <CardContent>
                  {branch.description && (
                    <p
                      className={`text-sm mb-4 ${
                        isInactive ? 'text-gray-400' : 'text-muted-foreground'
                      }`}
                    >
                      {branch.description}
                    </p>
                  )}
                  <div
                    className={`flex items-center text-xs ${
                      isInactive ? 'text-gray-400' : 'text-muted-foreground'
                    }`}
                  >
                    <Calendar className="mr-1 h-3 w-3" />
                    Created{' '}
                    {branch.created_at
                      ? format(new Date(branch.created_at), 'MMM d, yyyy')
                      : 'Unknown'}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TooltipProvider>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-106.25">
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
