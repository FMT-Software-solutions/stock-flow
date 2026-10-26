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
        return 'All branches';
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
            <TableRow className="bg-muted/50 text-xs hover:bg-muted/50">
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branches</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-8 bg-muted animate-pulse rounded" />
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
            <TableRow className="bg-muted/50 text-xs hover:bg-muted/50">
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branches</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isInactive = !user.is_active;
              const userRole = getUserRole(user);
              // Owners see every branch.
              const userBranches = userRole === 'owner' ? 'All branches' : getUserBranches(user);
              const fullName = getFullName(user.profile);
              const hasLowerRole =
                isBranchAdmin() && ['owner', 'admin'].includes(userRole);

              return (
                <TableRow key={user.id} className={isInactive ? 'opacity-60' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={processAvatarUrl(user.profile.avatar)}
                        />
                        <AvatarFallback className="text-xs">
                          {getUserInitials(user)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-1.5 font-medium">
                          {fullName}
                          {isInactive && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Inactive" />}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{user.profile.email}</span>
                        {user.is_first_login && (
                          <span className="text-xs text-amber-600 dark:text-amber-400">First login pending</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {ROLE_DISPLAY_NAMES[userRole]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-40 truncate text-sm text-muted-foreground" title={userBranches}>
                      {userBranches}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span
                        className={`h-2 w-2 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                        aria-hidden
                      />
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {user.last_login
                        ? format(new Date(user.last_login), 'd MMM yyyy, HH:mm')
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
