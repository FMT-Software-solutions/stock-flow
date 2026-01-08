import { useRoleCheck } from '@/components/auth/RoleGuard';
import { Input } from '@/components/ui/input';
import { useUserFiltering } from '@/components/user-management/hooks/useUserFiltering';
import InactiveUsersSection from '@/components/user-management/InactiveUsersSection';
import { UserActionDialogs } from '@/components/user-management/UserActionDialogs';
import { UserAddDialog } from '@/components/user-management/UserAddDialog';
import { UserDisplayControls } from '@/components/user-management/UserDisplayControls';
import { UserFiltersControls } from '@/components/user-management/UserFiltersControls';
import { UserGrid } from '@/components/user-management/UserGrid';
import { UserPagination } from '@/components/user-management/UserPagination';
import { UserTable } from '@/components/user-management/UserTable';
import { useAuth } from '@/contexts/AuthContext';
import { useBranchContext } from '@/contexts/BranchContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUserBranches } from '@/hooks/useBranchQueries';
import { useUserActions } from '@/hooks/useUserActions';
import { useUserQueries } from '@/hooks/useUserQueries';
import { useUsersPreferences } from '@/hooks/useUsersPreferences';
import type { UserAction } from '@/types/user-management';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useDebounceValue } from '@/hooks/useDebounce';

export default function UserManagement() {
  const { checkPermission, isBranchAdmin, isOwner, isAdmin } = useRoleCheck();
  const { currentOrganization } = useOrganization();
  const { selectedBranchIds } = useBranchContext();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Permission checks
  const canView = checkPermission('user_management', 'view'); // Or just 'user_management' scope check implied by view
  const canCreate = checkPermission('user_management', 'create');
  const canEdit = checkPermission('user_management', 'edit');
  const canDelete = checkPermission('user_management', 'delete');
  const canDeactivate = checkPermission(
    'user_management',
    'activate_deactivate'
  );

  // State for dialogs and forms
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounceValue(searchTerm, 1000);

  // User preferences and filters
  const {
    displayMode,
    setDisplayMode,
    pageSize,
    setPageSize,
    currentPage,
    setCurrentPage,
    filters,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    updateFilters,
    resetFilters,
  } = useUsersPreferences();

  // Data fetching
  const { users, branches, isLoading, createUser } = useUserQueries();

  // Fetch current user's branch assignments for branch admin restrictions
  const { data: userBranches } = useUserBranches(
    user?.id,
    currentOrganization?.id
  );

  // User actions
  const userActions = useUserActions();

  // Get user's assigned branch IDs for branch admin restrictions
  const userAssignedBranchIds = useMemo(() => {
    if ((!isBranchAdmin() && !isAdmin()) || !userBranches) return [];
    return userBranches.map((ub) => ub.branch_id).filter(Boolean) as string[];
  }, [userBranches, isBranchAdmin, isAdmin]);

  // Filter branches based on user role - branch admins only see their assigned branches
  const availableBranches = useMemo(() => {
    if (!branches) return [];
    if (isOwner()) return branches; // Owners see all branches
    if (isBranchAdmin() || isAdmin()) {
      // Branch admins and Admins only see their assigned branches
      return branches.filter((branch) =>
        userAssignedBranchIds.includes(branch.id)
      );
    }
    return branches; // Other roles see all branches
  }, [branches, isOwner, isBranchAdmin, isAdmin, userAssignedBranchIds]);

  // Check if branch admin can perform action on user
  const canPerformUserAction = (user: any) => {
    if (isOwner()) return true; // Owners can act on all users
    if ((isBranchAdmin() || isAdmin()) && userAssignedBranchIds.length > 0) {
      // Branch admins and Admins can only act on users from their assigned branches
      const userBranches = user.user_branches || [];
      return userBranches.some(
        (ub: any) =>
          ub.branch_id && userAssignedBranchIds.includes(ub.branch_id)
      );
    }
    return true; // Other roles can act on users they can see
  };

  // Event handlers
  const handleUserActionLocal = (action: UserAction, user: any) => {
    // Check if user can perform this action
    if (!canPerformUserAction(user)) {
      toast.error('You can only manage users from your assigned branches.');
      return;
    }

    switch (action) {
      case 'edit':
        navigate(`/users/${user.id}`);
        break;
      case 'deactivate':
        // Show confirmation dialog for deactivation
        if ((window as any).userActionDialogs) {
          (window as any).userActionDialogs.openDeactivateDialog({
            id: user.id,
            email: user.profile?.email || '',
            full_name: `${user.profile?.first_name || ''} ${
              user.profile?.last_name || ''
            }`.trim(),
            role: user.user_organizations?.[0]?.role || 'read',
            is_active: user.is_active,
          });
        } else {
          // Fallback to direct action if dialog not available
          userActions.handleUserAction(action, user, currentOrganization?.id);
        }
        break;
      case 'delete':
        // Show confirmation dialog for permanent deletion
        if ((window as any).userActionDialogs) {
          (window as any).userActionDialogs.openDeleteDialog({
            id: user.id,
            email: user.profile?.email || '',
            full_name: `${user.profile?.first_name || ''} ${
              user.profile?.last_name || ''
            }`.trim(),
            role: user.user_organizations?.[0]?.role || 'read',
            is_active: user.is_active,
          });
        } else {
          // Fallback to direct action if dialog not available
          userActions.handleUserAction(action, user, currentOrganization?.id);
        }
        break;
      default:
        userActions.handleUserAction(action, user, currentOrganization?.id);
        break;
    }
  };

  const handleCreateUser = (userData: any) => {
    // For non-owners, restrict branch assignments to only their assigned branches
    let allowedBranchIds = userData.selectedBranchIds || [];
    if (!isOwner() && userAssignedBranchIds.length > 0) {
      // Filter selected branches to only include those the user is assigned to
      allowedBranchIds = allowedBranchIds.filter((branchId: string) =>
        userAssignedBranchIds.includes(branchId)
      );
    }

    // Transform the form data to include branch assignments
    const transformedData = {
      ...userData,
      // Handle branch assignments based on role and form data
      branchIds: userData.assignAllBranches
        ? !isOwner()
          ? userAssignedBranchIds
          : availableBranches
              ?.filter((b: any) => b.is_active)
              .map((b: any) => b.id) || []
        : allowedBranchIds || (userData.branchId ? [userData.branchId] : []),
      // Remove the form-specific fields
      assignAllBranches: undefined,
      selectedBranchIds: undefined,
      // Pass roleId if available
      roleId: userData.roleId,
      // Use provided permissions (from role selection) or build defaults
      permissions: userData.permissions || '',
    };

    createUser.mutate(transformedData, {
      onSuccess: () => {
        setIsCreateDialogOpen(false);
        toast.success('User created successfully!');
      },
      onError: (error) => {
        console.error('Error creating user:', error);
        toast.error(error.message || 'Failed to create user');
      },
    });
  };

  // Use custom hook for filtering, sorting, and pagination
  const { paginatedUsers, totalUsers, totalPages } = useUserFiltering({
    users,
    searchTerm: debouncedSearchTerm,
    filters,
    sortBy,
    sortOrder,
    currentPage,
    pageSize,
    isBranchAdmin,
    userAssignedBranchIds,
    selectedBranchIds,
  });

  // Event handlers

  // Access control check
  if (!canView) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access user management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage users and their permissions
          </p>
        </div>
        {canCreate && (
          <UserAddDialog
            isOpen={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
            onSubmit={handleCreateUser}
            branches={availableBranches || []}
            isLoading={createUser.isPending}
          />
        )}
      </div>

      {/* Search and Display Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        <UserDisplayControls
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
        />
      </div>

      {/* Filters and Sorting */}
      <div className="mb-6">
        <UserFiltersControls
          filters={filters}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onFiltersChange={updateFilters}
          onSortChange={(newSortBy, newSortOrder) => {
            setSortBy(newSortBy);
            setSortOrder(newSortOrder);
          }}
          onResetFilters={resetFilters}
        />
      </div>

      {/* User Display - Hide when status filter is 'inactive' */}
      {filters.status !== 'inactive' &&
        (isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading users...</p>
          </div>
        ) : (
          <>
            {displayMode === 'table' ? (
              <UserTable
                users={paginatedUsers}
                currentUserId={user?.id}
                onUserAction={handleUserActionLocal}
                branches={branches || []}
                canEdit={canEdit}
                canDelete={canDelete}
                canDeactivate={canDeactivate}
              />
            ) : (
              <UserGrid
                users={paginatedUsers}
                currentUserId={user?.id}
                onUserAction={handleUserActionLocal}
                branches={branches || []}
                canEdit={canEdit}
                canDelete={canDelete}
                canDeactivate={canDeactivate}
              />
            )}

            {/* Pagination */}
            <UserPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalUsers}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </>
        ))}

      {/* Inactive Users Section - Show based on status filter */}
      {(filters.status === 'all' || filters.status === 'inactive') && (
        <InactiveUsersSection
          filters={filters}
          searchTerm={debouncedSearchTerm}
          isDefaultOpen={filters.status === 'inactive'}
        />
      )}

      {/* User Action Dialogs */}
      <UserActionDialogs
        onPasswordRegenerated={(tempPassword) => {
          toast.success(`Temporary password generated: ${tempPassword}`);
        }}
      />
    </div>
  );
}
