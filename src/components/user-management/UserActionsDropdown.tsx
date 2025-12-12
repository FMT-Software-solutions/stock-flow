import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Edit, MoreHorizontal, Trash2, UserCheck, UserX } from 'lucide-react';
import type { UserWithRelations, UserAction } from '@/types/user-management';

interface UserActionsDropdownProps {
  user: UserWithRelations;
  canEdit: boolean;
  canDelete: boolean;
  canDeactivate: boolean;
  onAction: (action: UserAction, user: UserWithRelations) => void;
}

export function UserActionsDropdown({
  user,
  canEdit,
  canDelete,
  canDeactivate,
  onAction,
}: UserActionsDropdownProps) {
  const hasAnyAction = canEdit || canDelete || canDeactivate;

  if (!hasAnyAction) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled
            className="h-8 w-8 p-0 cursor-not-allowed opacity-50"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Read-only view</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit && (
          <DropdownMenuItem onClick={() => onAction('edit', user)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit User
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {canDeactivate && user.is_active && (
          <DropdownMenuItem
            onClick={() => onAction('deactivate', user)}
            className="text-orange-600"
          >
            <UserX className="mr-2 h-4 w-4" />
            Deactivate
          </DropdownMenuItem>
        )}
        {canDeactivate && !user.is_active && (
          <DropdownMenuItem
            onClick={() => onAction('reactivate', user)}
            className="text-green-600"
          >
            <UserCheck className="mr-2 h-4 w-4" />
            Activate
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem
            onClick={() => onAction('delete', user)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
