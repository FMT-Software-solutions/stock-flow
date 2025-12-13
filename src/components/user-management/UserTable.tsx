import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Lock } from 'lucide-react';
import { UserActionsDropdown } from './UserActionsDropdown';
import { format } from 'date-fns';
import { ROLE_DISPLAY_NAMES } from '@/types/organizations';
import type { UserWithRelations, UserAction } from '@/types/user-management';
import { getFullName } from '@/types/user-management';
import { processAvatarUrl } from '@/utils/asset-path';
import { useRoleCheck } from '../auth/RoleGuard';

interface UserTableProps {
  users: UserWithRelations[];
  currentUserId?: string;
  isLoading?: boolean;
  onUserAction?: (action: UserAction, user: UserWithRelations) => void;
  branches?: any[]; // Available branches for comparison
  canEdit?: boolean;
  canDelete?: boolean;
  canDeactivate?: boolean;
}

export function UserTable({
  users,
  currentUserId,
  isLoading,
  onUserAction,
  branches = [],
  canEdit = false,
  canDelete = false,
  canDeactivate = false,
}: UserTableProps) {
  const { isBranchAdmin } = useRoleCheck();

  const handleAction = (action: UserAction, user: UserWithRelations) => {
    onUserAction?.(action, user);
  };

  const getUserInitials = (user: UserWithRelations) => {
    const fullName = getFullName(user.profile);
    return fullName
      .split(' ')
      .map((name) => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserRole = (user: UserWithRelations) => {
    const userOrg = user.user_organizations?.[0];
    return userOrg?.role || 'read';
  };

  const getUserBranches = (user: UserWithRelations) => {
    const userBranches = user.user_branches || [];
    const activeBranches = branches.filter((b) => b.is_active);

    // Check if user has all active branches assigned
    if (
      activeBranches.length > 0 &&
      userBranches.length === activeBranches.length
    ) {
      const userBranchIds = new Set(userBranches.map((ub) => ub.branch_id));
      const hasAllBranches = activeBranches.every((b) =>
        userBranchIds.has(b.id)
      );

      if (hasAllBranches) {
        return 'All Branches';
      }
    }

    const branchNames = userBranches
      .filter((ub) => ub.branch)
      .map((ub) => ub.branch!.name)
      .join(', ');
    return branchNames || '-';
  };

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branches</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-gray-100 animate-pulse rounded-full" />
                    <div className="h-4 w-24 bg-gray-100 animate-pulse rounded" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="h-4 w-32 bg-gray-100 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-16 bg-gray-100 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-20 bg-gray-100 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-16 bg-gray-100 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-20 bg-gray-100 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-8 bg-gray-100 animate-pulse rounded" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branches</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isInactive = !user.is_active;
              const userRole = getUserRole(user);
              const userBranches = getUserBranches(user);
              const fullName = getFullName(user.profile);
              const hasLowerRole =
                isBranchAdmin() && ['owner', 'admin'].includes(userRole);

              return (
                <TableRow
                  key={user.id}
                  className={isInactive ? 'opacity-60' : ''}
                >
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={processAvatarUrl(user.profile.avatar)}
                        />
                        <AvatarFallback className="text-xs">
                          {getUserInitials(user)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {fullName}
                          {isInactive && (
                            <Lock className="ml-2 inline h-4 w-4 text-gray-400" />
                          )}
                        </span>
                        {user.is_first_login && (
                          <span className="text-xs text-orange-600">
                            First login pending
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={isInactive ? 'text-gray-400' : ''}>
                      {user.profile.email}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        isInactive ? 'text-gray-400 border-gray-300' : ''
                      }
                    >
                      {ROLE_DISPLAY_NAMES[userRole]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[150px] truncate">
                      <span
                        className={`text-sm ${
                          isInactive ? 'text-gray-400' : 'text-muted-foreground'
                        }`}
                      >
                        {userBranches}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.is_active ? 'default' : 'secondary'}
                      className={
                        isInactive ? 'bg-muted text-muted-foreground' : ''
                      }
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-[12px] ${
                        isInactive ? 'text-gray-400' : 'text-muted-foreground'
                      }`}
                    >
                      {user.last_login
                        ? format(
                            new Date(user.last_login),
                            'MMM d, yyyy h:mm a'
                          )
                        : 'Never'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {userRole !== 'owner' &&
                      currentUserId !== user.id &&
                      !hasLowerRole && (
                        <UserActionsDropdown
                          user={user}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          canDeactivate={canDeactivate}
                          onAction={handleAction}
                        />
                      )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
