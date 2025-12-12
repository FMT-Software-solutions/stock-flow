import { useState, useMemo } from 'react';

import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';

import { useUserBranches } from '@/hooks/useBranchQueries';
import { useUserQueries } from '@/hooks/useUserQueries';
import { useUserActions } from '@/hooks/useUserActions';
import type { UserFilters } from '@/types/user-management';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '../ui/badge';
import {
  ChevronDown,
  ChevronRight,
  UserCheck,
  Users,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { UserRole } from '@/lib/auth';
import { useRoleCheck } from '@/components/auth/RoleGuard';

import { useBranchContext } from '@/contexts/BranchContext';

interface InactiveUser {
  id: string;
  user_id: string;
  role: UserRole;
  is_active: boolean;
  organization_id: string;
  created_at: string;
  updated_at: string;
  profiles: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    avatar: string | null;
    phone: string | null;
    created_at: string;
    updated_at: string;
  };
  user_branches?: Array<{
    branch_id: string;
    branches: {
      name: string;
    };
  }>;
}

interface InactiveUsersSectionProps {
  filters: UserFilters;
  searchTerm: string;
  isDefaultOpen?: boolean;
}

export default function InactiveUsersSection({
  filters,
  searchTerm,
  isDefaultOpen = false,
}: InactiveUsersSectionProps) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const { selectedBranchIds } = useBranchContext();

  const { isBranchAdmin, canViewAllData } = useRoleCheck();

  // Fetch current user's branch assignments for branch admin restrictions
  const { data: userBranches } = useUserBranches(
    user?.id,
    currentOrganization?.id
  );

  // Get user's assigned branch IDs for branch admin restrictions
  const userAssignedBranchIds = useMemo(() => {
    if (!isBranchAdmin() || !userBranches) return [];
    return userBranches.map((ub) => ub.branch_id).filter(Boolean) as string[];
  }, [userBranches, isBranchAdmin]);

  const [showInactiveUsers, setShowInactiveUsers] = useState(isDefaultOpen);
  const [selectedUser, setSelectedUser] = useState<InactiveUser | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'reactivate' | 'delete'>(
    'reactivate'
  );

  // Use the inactive users query and reactivate mutation from useUserQueries
  const {
    inactiveUsers: allInactiveUsers,
    inactiveUsersLoading,
    reactivateUser,
  } = useUserQueries();

  // Use user actions for delete functionality
  const { deleteUser } = useUserActions();

  // Filter inactive users for branch admins and apply filters
  const inactiveUsers = useMemo(() => {
    let filteredData = allInactiveUsers || [];

    // Filter for branch admins - only show users from their assigned branches
    if (isBranchAdmin() && userAssignedBranchIds.length > 0) {
      filteredData = filteredData.filter((userOrg) => {
        const userBranches = userOrg.user_branches || [];
        return userBranches.some(
          (ub: any) =>
            ub.branch_id && userAssignedBranchIds.includes(ub.branch_id)
        );
      });
    }

    // Apply search term filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredData = filteredData.filter((user) => {
        const fullName = `${user.profiles?.first_name || ''} ${
          user.profiles?.last_name || ''
        }`.toLowerCase();
        const email = user.profiles?.email?.toLowerCase() || '';
        return fullName.includes(searchLower) || email.includes(searchLower);
      });
    }

    // Global Branch Selection Filter
    if (selectedBranchIds.length > 0) {
      filteredData = filteredData.filter((user) => {
        const userRole = user.role;
        // Owners are always visible regardless of branch selection
        if (userRole !== 'owner') {
          const userBranches = user.user_branches || [];
          // If user has branches, at least one must be in the selected branches
          const hasOverlap = userBranches.some((ub: any) =>
            selectedBranchIds.includes(ub.branch_id)
          );
          if (!hasOverlap) return false;
        }
        return true;
      });
    }

    // Apply role filter
    if (filters.role) {
      filteredData = filteredData.filter((user) => user.role === filters.role);
    }

    return filteredData as InactiveUser[];
  }, [
    allInactiveUsers,
    isBranchAdmin,
    userAssignedBranchIds,
    searchTerm,
    filters,
    selectedBranchIds,
  ]);

  // Use reactivate user mutation from useUserQueries with custom success/error handling
  const reactivateUserMutation = {
    ...reactivateUser,
    mutate: (userId: string) => {
      reactivateUser.mutate(
        { userId, organizationId: currentOrganization?.id || '' },
        {
          onSuccess: () => {
            toast.success('User reactivated successfully!');
          },
          onError: (error: any) => {
            toast.error(error.message || 'Failed to reactivate user');
          },
        }
      );
    },
  };

  // Only render if user can view user data
  if (!canViewAllData()) {
    return null;
  }

  return (
    <div className="mt-8 space-y-4">
      <Collapsible open={showInactiveUsers} onOpenChange={setShowInactiveUsers}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex w-full items-center justify-between p-0 hover:bg-transparent"
          >
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-md font-semibold text-muted-foreground">
                Inactive Users ({inactiveUsers?.length || 0})
              </h2>
            </div>
            {showInactiveUsers ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-4">
          <div className="space-y-4">
            {inactiveUsersLoading ? (
              <div className="text-center py-4 text-muted-foreground">
                Loading inactive users...
              </div>
            ) : inactiveUsers && inactiveUsers.length > 0 ? (
              <div className="grid gap-4">
                {inactiveUsers.map((user) => (
                  <Card
                    key={user.id}
                    className="border-dashed border-muted-foreground/30"
                  >
                    <CardContent>
                      <div className="flex justify-between items-start">
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-col md:flex-row md:items-center items-start md:space-x-2">
                            <h3 className="font-semibold text-muted-foreground">
                              {user.profiles?.first_name &&
                              user.profiles?.last_name
                                ? `${user.profiles.first_name} ${user.profiles.last_name}`
                                : user.profiles?.email}
                            </h3>
                            <Badge variant="secondary" className="bg-muted">
                              {user.role || 'User'}
                            </Badge>
                            <Badge variant="destructive" className="text-xs">
                              Inactive
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {user.profiles?.email}
                          </p>
                          {user.user_branches && user.user_branches.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                              Branch{user.user_branches.length > 1 ? 'es' : ''}:{' '}
                              {user.user_branches
                                .filter((ub) => ub.branches?.name)
                                .map((ub) => ub.branches.name)
                                .join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              reactivateUserMutation.isPending ||
                              deleteUser.isPending
                            }
                            className="border-green-200 text-green-700 hover:bg-green-50"
                            onClick={() => {
                              setSelectedUser(user);
                              setDialogAction('reactivate');
                              setIsDialogOpen(true);
                            }}
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Reactivate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              reactivateUserMutation.isPending ||
                              deleteUser.isPending
                            }
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setSelectedUser(user);
                              setDialogAction('delete');
                              setIsDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No inactive users found.
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Single reusable dialog instance */}
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogAction === 'reactivate'
                ? 'Reactivate User'
                : 'Remove User'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogAction === 'reactivate' ? (
                <>
                  Are you sure you want to reactivate "
                  {selectedUser?.profiles?.first_name &&
                  selectedUser?.profiles?.last_name
                    ? `${selectedUser.profiles.first_name} ${selectedUser.profiles.last_name}`
                    : selectedUser?.profiles?.email}
                  "? This will restore their access to this organization again.
                </>
              ) : (
                <>
                  Are you sure you want to remove "
                  {selectedUser?.profiles?.first_name &&
                  selectedUser?.profiles?.last_name
                    ? `${selectedUser.profiles.first_name} ${selectedUser.profiles.last_name}`
                    : selectedUser?.profiles?.email}
                  "? This action cannot be undone and will remove all user data
                  from the organization.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDialogOpen(false);
                setSelectedUser(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (selectedUser) {
                  if (dialogAction === 'reactivate') {
                    reactivateUserMutation.mutate(selectedUser.user_id);
                  } else {
                    try {
                      await deleteUser.mutateAsync({
                        userId: selectedUser.user_id,
                        organizationId: currentOrganization?.id || '',
                      });
                    } catch (error) {
                      // Error handling is already done in the mutation
                      console.error('Remove user error:', error);
                    }
                  }
                  setIsDialogOpen(false);
                  setSelectedUser(null);
                }
              }}
              className={
                dialogAction === 'reactivate'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }
            >
              {dialogAction === 'reactivate' ? 'Reactivate' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
