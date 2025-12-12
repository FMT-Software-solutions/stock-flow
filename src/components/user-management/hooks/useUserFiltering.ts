import { useMemo } from 'react';
import type { UserWithRelations } from '@/types/user-management';

interface UseUserFilteringProps {
  users: UserWithRelations[] | undefined;
  searchTerm: string;
  filters: {
    status?: 'all' | 'active' | 'inactive';
    role?: string;
  };
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  currentPage: number;
  pageSize: number;
  isBranchAdmin: () => boolean;
  userAssignedBranchIds: string[];
  selectedBranchIds?: string[];
}

interface UseUserFilteringReturn {
  filteredUsers: UserWithRelations[];
  sortedUsers: UserWithRelations[];
  paginatedUsers: UserWithRelations[];
  totalUsers: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

export function useUserFiltering({
  users,
  searchTerm,
  filters,
  sortBy,
  sortOrder,
  currentPage,
  pageSize,
  isBranchAdmin,
  userAssignedBranchIds,
  selectedBranchIds = [],
}: UseUserFilteringProps): UseUserFilteringReturn {
  // Filter and search users
  const filteredUsers = useMemo(() => {
    if (!users) return [];

    return users.filter((user: any) => {
      // Global Branch Selection Filter
      if (selectedBranchIds.length > 0) {
        const userRole = user.user_organizations?.[0]?.role;
        // Owners are always visible regardless of branch selection
        if (userRole !== 'owner') {
          const userBranches = user.user_branches || [];
          // If user has branches, at least one must be in the selected branches
          const hasOverlap = userBranches.some((ub: any) => 
            selectedBranchIds.includes(ub.branch_id)
          );
          if (!hasOverlap) return false;
        }
      }

      // Branch admin restriction: only show users from assigned branches
      if (isBranchAdmin() && userAssignedBranchIds.length > 0) {
        const userBranches = user.user_branches || [];
        const hasAssignedBranch = userBranches.some(
          (ub: any) =>
            ub.branch_id && userAssignedBranchIds.includes(ub.branch_id)
        );
        if (!hasAssignedBranch) return false;
      }

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const fullName = `${user.profile.first_name || ''} ${
          user.profile.last_name || ''
        }`.toLowerCase();
        const email = user.profile.email?.toLowerCase() || '';

        if (!fullName.includes(searchLower) && !email.includes(searchLower)) {
          return false;
        }
      }

      // Status filter
      if (filters.status === 'active' && !user.is_active) return false;
      if (filters.status === 'inactive' && user.is_active) return false;
      // 'all' status shows both active and inactive users

      // Role filter
      if (filters.role) {
        const userRole = user.user_organizations?.[0]?.role;
        if (userRole !== filters.role) return false;
      }

      return true;
    });
  }, [users, searchTerm, filters, isBranchAdmin, userAssignedBranchIds, selectedBranchIds]);

  // Sort users
  const sortedUsers = useMemo(() => {
    if (!filteredUsers.length) return [];

    return [...filteredUsers].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'full_name':
          aValue = `${a.profile.first_name || ''} ${
            a.profile.last_name || ''
          }`.toLowerCase();
          bValue = `${b.profile.first_name || ''} ${
            b.profile.last_name || ''
          }`.toLowerCase();
          break;
        case 'email':
          aValue = a.profile.email?.toLowerCase() || '';
          bValue = b.profile.email?.toLowerCase() || '';
          break;
        case 'created_at':
          aValue = new Date(a.created_at || 0);
          bValue = new Date(b.created_at || 0);
          break;
        case 'last_login':
          aValue = new Date(a.last_login || 0);
          bValue = new Date(b.last_login || 0);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredUsers, sortBy, sortOrder]);

  // Paginate users
  const totalUsers = sortedUsers.length;
  const totalPages = Math.ceil(totalUsers / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedUsers = sortedUsers.slice(startIndex, endIndex);

  return {
    filteredUsers,
    sortedUsers,
    paginatedUsers,
    totalUsers,
    totalPages,
    startIndex,
    endIndex,
  };
}