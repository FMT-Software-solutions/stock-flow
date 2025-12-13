import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ROLE_DISPLAY_NAMES } from '@/types/organizations';
import type { UserAction, UserWithRelations } from '@/types/user-management';
import { getFullName } from '@/types/user-management';
import { format } from 'date-fns';
import { Calendar, Lock, Mail, MapPin } from 'lucide-react';
import { UserActionsDropdown } from './UserActionsDropdown';
import { processAvatarUrl } from '@/utils/asset-path';
import { useRoleCheck } from '../auth/RoleGuard';

interface UserGridProps {
  users: UserWithRelations[];
  currentUserId?: string;
  isLoading?: boolean;
  onUserAction?: (action: UserAction, user: UserWithRelations) => void;
  branches?: any[]; // Available branches for comparison
  canEdit?: boolean;
  canDelete?: boolean;
  canDeactivate?: boolean;
}

export function UserGrid({
  users,
  currentUserId,
  isLoading,
  onUserAction,
  branches = [],
  canEdit = false,
  canDelete = false,
  canDeactivate = false,
}: UserGridProps) {
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
      .map((ub) => ub.branch!.name);
    return branchNames;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-gray-100 rounded-full" />
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-gray-100 rounded" />
                    <div className="h-3 w-16 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="h-8 w-8 bg-gray-100 rounded" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-3 w-32 bg-gray-100 rounded" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {users.map((user) => {
          const isInactive = !user.is_active;
          const userRole = getUserRole(user);
          const userBranches = getUserBranches(user);
          const fullName = getFullName(user.profile);
          const hasLowerRole =
            isBranchAdmin() && ['owner', 'admin'].includes(userRole);

          return (
            <Card
              key={user.id}
              className={`transition-all hover:shadow-md ${
                isInactive ? 'opacity-60 bg-muted/30' : ''
              }`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={processAvatarUrl(user.profile.avatar)}
                      />
                      <AvatarFallback className="text-sm">
                        {getUserInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 gap-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-sm truncate">
                          {fullName}
                        </h3>
                        {isInactive && (
                          <Lock className="h-3 w-3 text-gray-400 shrink-0" />
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs w-fit ${
                          isInactive ? 'text-gray-400 border-gray-300' : ''
                        }`}
                      >
                        {ROLE_DISPLAY_NAMES[userRole]}
                      </Badge>
                    </div>
                  </div>
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
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{user.profile.email}</span>
                </div>

                {(Array.isArray(userBranches)
                  ? userBranches.length > 0
                  : userBranches) && (
                  <div className="flex items-start space-x-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      {userBranches === 'All Branches' ? (
                        <span>All Branches</span>
                      ) : (
                        <div className="space-y-1">
                          {Array.isArray(userBranches) &&
                            userBranches
                              .slice(0, 2)
                              .map((branch: string, index: number) => (
                                <div key={index} className="truncate">
                                  {branch}
                                </div>
                              ))}
                          {Array.isArray(userBranches) &&
                            userBranches.length > 2 && (
                              <div className="text-xs text-muted-foreground">
                                +{userBranches.length - 2} more
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Badge
                    variant={user.is_active ? 'default' : 'secondary'}
                    className={`text-xs ${
                      isInactive ? 'bg-muted text-muted-foreground' : ''
                    }`}
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </Badge>

                  {user.is_first_login && (
                    <Badge
                      variant="outline"
                      className="text-xs text-orange-600"
                    >
                      First login pending
                    </Badge>
                  )}
                </div>

                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>
                    Last login:{' '}
                    {user.last_login
                      ? format(new Date(user.last_login), 'MMM d, yyyy')
                      : 'Never'}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
