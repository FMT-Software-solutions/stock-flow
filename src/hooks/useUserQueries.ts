import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Branch } from '@/types/branches';
import type { UserWithRelations } from '@/types/user-management';
import { supabase } from '@/utils/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Query Keys
export const userKeys = {
  all: ['users'] as const,
  organizationUsers: (organizationId: string) =>
    [...userKeys.all, 'organization', organizationId] as const,
  user: (id: string) => [...userKeys.all, 'detail', id] as const,
};

interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roleId?: string;
  branchIds?: string[];
  permissions?: string; // Stringified JSON
}

interface UpdateUserData {
  authUserId: string;
  userData: {
    firstName?: string;
    lastName?: string;
    role?: string;
    roleId?: string;
    branchId?: string;
    branchIds?: string[];
    permissions?: string; // Stringified JSON
  };
}

export function useUser(userId: string | undefined) {
  const { currentOrganization } = useOrganization();

  return useQuery({
    queryKey: userId ? userKeys.user(userId) : [],
    queryFn: async (): Promise<UserWithRelations> => {
      if (!userId || !currentOrganization) throw new Error('Invalid user or organization');

      const { data, error } = await supabase
        .from('user_organizations')
        .select(`
          id,
          user_id,
          role,
          role_id,
          organization_role:organization_roles(
            id,
            name,
            type,
            permissions
          ),
          is_active,
          permissions,
          organization_id,
          created_at,
          updated_at,
          profiles!user_organizations_user_id_fkey1(
            id,
            email,
            first_name,
            last_name,
            avatar,
            phone,
            gender,
            date_of_birth,
            created_at,
            updated_at
          ),
          auth_users!user_organizations_user_id_fkey2(
            id,
            is_first_login,
            last_login,
            password_updated,
            otp_requests_count,
            last_otp_request
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('User not found');

      // Fetch branches for this user
      const { data: branchesData } = await supabase
        .from('user_branches')
        .select(`
          id,
          user_id,
          branch_id,
          organization_id,
          created_at,
          updated_at,
          branches (
            id,
            name,
            location,
            is_active
          )
        `)
        .eq('user_id', userId)
        .eq('organization_id', currentOrganization.id);

      const userBranches = branchesData?.map(ub => ({
        ...ub,
        branch: ub.branches
      })) || [];

      return {
        ...data.auth_users,
        profile: data.profiles,
        user_organizations: [data],
        user_branches: userBranches
      } as unknown as UserWithRelations;
    },
    enabled: !!userId && !!currentOrganization?.id,
  });
}

export function useUserQueries() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch users in the current organization
  const {
    data: users = [],
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({
    queryKey: userKeys.organizationUsers(currentOrganization?.id || ''),
    queryFn: async (): Promise<UserWithRelations[]> => {
      if (!currentOrganization) throw new Error('No organization selected');

      // Single optimized query joining user_organizations with profiles and auth_users via user_id
      const { data, error } = await supabase
        .from('user_organizations')
        .select(`
          id,
          user_id,
          role,
          role_id,
          organization_role:organization_roles(
            id,
            name,
            type,
            permissions
          ),
          is_active,
          permissions,
          organization_id,
          created_at,
          updated_at,
          profiles!user_organizations_user_id_fkey1(
            id,
            email,
            first_name,
            last_name,
            avatar,
            phone,
            gender,
            date_of_birth,
            created_at,
            updated_at
          ),
          auth_users!user_organizations_user_id_fkey2(
            id,
            is_first_login,
            last_login,
            password_updated,
            otp_requests_count,
            last_otp_request
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user_branches in a single query for all users in this organization
      // This is more efficient than individual queries per user
      const userIds = data?.map(userOrg => userOrg.user_id).filter(Boolean) || [];
      let userBranchesMap: Record<string, any[]> = {};

      if (userIds.length > 0) {
        const { data: branchesData, error: branchesError } = await supabase
          .from('user_branches')
          .select(`
            id,
            user_id,
            branch_id,
            created_at,
            updated_at,
            branch:branches!inner(
              id,
              name,
              location,
              description,
              is_active,
              created_at,
              updated_at,
              organization_id,
              contact
            )
          `)
          .in('user_id', userIds)
          .eq('branch.organization_id', currentOrganization.id);

        if (!branchesError && branchesData) {
          // Group branches by user_id for efficient lookup
          userBranchesMap = branchesData.reduce((acc, ub) => {
            if (!acc[ub.user_id]) acc[ub.user_id] = [];
            acc[ub.user_id].push(ub);
            return acc;
          }, {} as Record<string, any[]>);
        }
      }

      return data?.map(userOrg => {
        const profile = Array.isArray(userOrg.profiles) ? userOrg.profiles[0] : userOrg.profiles;
        const authUser = (Array.isArray(userOrg.auth_users) ? userOrg.auth_users[0] : userOrg.auth_users) as any;
        const userBranches = userBranchesMap[userOrg.user_id] || [];

        return {
          id: userOrg.user_id || '',
          email: profile?.email || '',
          is_active: userOrg.is_active,
          is_first_login: authUser?.is_first_login || null,
          password_updated: authUser?.password_updated || null,
          last_login: authUser?.last_login || null,
          otp_requests_count: authUser?.otp_requests_count || null,
          last_otp_request: authUser?.last_otp_request || null,
          created_at: profile?.created_at || '',
          updated_at: profile?.updated_at || '',
          profile: profile,
          user_organizations: [{
            id: userOrg.id,
            organization_id: userOrg.organization_id,
            role: userOrg.role,
            is_active: userOrg.is_active,
            permissions: userOrg.permissions,
            created_at: userOrg.created_at,
            updated_at: userOrg.updated_at,
            organization: {
              id: userOrg.organization_id,
              name: ''
            }
          }],
          user_branches: userBranches.map(ub => ({
            id: ub.id,
            user_id: ub.user_id,
            branch_id: ub.branch_id,
            organization_id: currentOrganization.id,
            created_at: ub.created_at,
            updated_at: ub.updated_at,
            branch: ub.branch
          }))
        };
      }) || [];
    },
    enabled: !!currentOrganization,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch branches for the current organization
  const {
    data: branches = [],
    isLoading: branchesLoading,
    error: branchesError,
  } = useQuery({
    queryKey: ['branches', currentOrganization?.id],
    queryFn: async (): Promise<Branch[]> => {
      if (!currentOrganization) throw new Error('No organization selected');

      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Create user mutation
  const createUser = useMutation({
    mutationFn: async (userData: CreateUserData) => {
      if (!currentOrganization) throw new Error('No organization selected');

      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error('No access token');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role,
            roleId: userData.roleId,
            branchIds: userData.branchIds,
            permissions: userData.permissions,
            organizationId: currentOrganization.id,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }

      const result = await response.json();

      // Activity logging would be handled by edge function

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.organizationUsers(currentOrganization?.id || '') });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      // Toast notification handled in component
    },
    onError: () => {
      // Error handling in component
    },
  });

  // Update user mutation
  const updateUser = useMutation({
    mutationFn: async ({ authUserId, userData }: UpdateUserData) => {
      if (!currentOrganization) throw new Error('No organization selected');

      const updates: Promise<any>[] = [];

      // 1. Update profile if name changed
      if (userData.firstName !== undefined || userData.lastName !== undefined) {
        const profileUpdate = supabase
          .from('profiles')
          .update({
            ...(userData.firstName !== undefined && { first_name: userData.firstName }),
            ...(userData.lastName !== undefined && { last_name: userData.lastName }),
            updated_at: new Date().toISOString(),
          })
          .eq('id', authUserId);

        updates.push(Promise.resolve(profileUpdate));
      }

      // 2. Update role or permissions if changed
      if (userData.role || userData.permissions !== undefined) {
        const updatePayload: any = {
          updated_at: new Date().toISOString(),
        };

        if (userData.role) {
          updatePayload.role = userData.role;
        }

        if (userData.permissions !== undefined) {
          updatePayload.permissions = userData.permissions;
        }

        const userOrgUpdate = supabase
          .from('user_organizations')
          .update(updatePayload)
          .eq('user_id', authUserId)
          .eq('organization_id', currentOrganization.id);

        updates.push(Promise.resolve(userOrgUpdate));
      }

      // 3. Update branch assignments if changed
      if (userData.branchId !== undefined || userData.branchIds !== undefined) {
        // Get current user's branch assignments
        const { data: currentBranches } = await supabase
          .from('user_branches')
          .select('branch_id')
          .eq('user_id', authUserId);

        const currentBranchIds = currentBranches?.map(b => b.branch_id).filter(Boolean) || [];

        // Determine which branches to assign
        let newBranchIds: string[] = [];
        if (userData.branchIds) {
          newBranchIds = userData.branchIds;
        } else if (userData.branchId) {
          newBranchIds = [userData.branchId];
        }

        // Find branches to add and remove
        const branchesToAdd = newBranchIds.filter(id => !currentBranchIds.includes(id));
        const branchesToRemove = currentBranchIds.filter(id => !newBranchIds.includes(id));

        // Remove branches that are no longer assigned
        if (branchesToRemove.length > 0) {
          const deleteBranches = supabase
            .from('user_branches')
            .delete()
            .eq('user_id', authUserId)
            .in('branch_id', branchesToRemove);

          updates.push(Promise.resolve(deleteBranches));
        }

        // Add new branch assignments
        if (branchesToAdd.length > 0) {
          const branchInserts = branchesToAdd.map(branchId => ({
            user_id: authUserId,
            branch_id: branchId,
            organization_id: currentOrganization.id,
            created_by: user?.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));

          const addBranches = supabase
            .from('user_branches')
            .insert(branchInserts);

          updates.push(Promise.resolve(addBranches));
        }
      }

      // Execute all updates
      const results = await Promise.all(updates);

      // Check for errors
      for (const result of results) {
        if (result.error) {
          throw new Error(result.error.message || 'Failed to update user');
        }
      }

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: userKeys.organizationUsers(currentOrganization?.id || '') });
      queryClient.invalidateQueries({ queryKey: userKeys.user(variables.authUserId) });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      // Toast notification handled in component
    },
    onError: () => {
      // Error handling in component
    },
  });

  // Fetch inactive users in the current organization
  const {
    data: inactiveUsers = [],
    isLoading: inactiveUsersLoading,
    error: inactiveUsersError,
  } = useQuery({
    queryKey: ['inactive-users', currentOrganization?.id],
    queryFn: async (): Promise<any[]> => {
      if (!currentOrganization) throw new Error('No organization selected');

      // Get inactive users with their profile data
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_organizations')
        .select(
          `
          id,
          user_id,
          role,
          is_active,
          organization_id,
          created_at,
          updated_at,
          profiles!user_organizations_user_id_fkey1(
            id,
            email,
            first_name,
            last_name,
            avatar,
            phone,
            created_at,
            updated_at
          )
        `
        )
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', false)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get user branches separately
      const userIds = profilesData?.map(user => user.user_id) || [];
      let userBranchesData: any[] = [];

      if (userIds.length > 0) {
        const { data: branchesData, error: branchesError } = await supabase
          .from('user_branches')
          .select(`
            user_id,
            branch_id,
            branches(
              name
            )
          `)
          .in('user_id', userIds);

        if (branchesError) throw branchesError;
        userBranchesData = branchesData || [];
      }

      // Map user branches by user_id
      const userBranchesMap = userBranchesData.reduce((acc, ub) => {
        if (!acc[ub.user_id]) acc[ub.user_id] = [];
        acc[ub.user_id].push({
          branch_id: ub.branch_id,
          branches: ub.branches
        });
        return acc;
      }, {} as Record<string, any[]>);

      // Combine the data
      const combinedData = profilesData?.map(user => {
        const profile = Array.isArray(user.profiles) ? user.profiles[0] : user.profiles;
        return {
          ...user,
          profiles: profile,
          user_branches: userBranchesMap[user.user_id] || []
        };
      }) || [];

      return combinedData;
    },
    enabled: !!currentOrganization,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Reactivate user mutation
  const reactivateUser = useMutation({
    mutationFn: async ({ userId, organizationId }: { userId: string; organizationId: string }) => {
      if (!currentOrganization) throw new Error('No organization selected');

      // Update user_organizations to set is_active = true
      const { data, error } = await supabase
        .from('user_organizations')
        .update({
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .select();

      if (error) {
        throw new Error(error.message || 'Failed to reactivate user');
      }

      if (!data || data.length === 0) {
        throw new Error('User not found in organization');
      }

      return { userId, organizationId, data };
    },
    onSuccess: () => {
      // Invalidate relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: userKeys.organizationUsers(currentOrganization?.id || '') });
      queryClient.invalidateQueries({ queryKey: ['inactive-users', currentOrganization?.id] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
    onError: () => {
      // Error handling in component
    },
  });

  const deactivateUser = useMutation({
    mutationFn: async ({ userId, organizationId }: { userId: string; organizationId: string }) => {
      if (!currentOrganization) throw new Error('No organization selected');

      // Update user_organizations to set is_active = false
      const { data, error } = await supabase
        .from('user_organizations')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .select();

      if (error) {
        throw new Error(error.message || 'Failed to deactivate user');
      }

      if (!data || data.length === 0) {
        throw new Error('User not found in organization');
      }

      return { userId, organizationId, data };
    },
    onSuccess: () => {
      // Invalidate relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: userKeys.organizationUsers(currentOrganization?.id || '') });
      queryClient.invalidateQueries({ queryKey: ['inactive-users', currentOrganization?.id] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
    onError: () => {
      // Error handling in component
    },
  });

  return {
    users,
    branches,
    inactiveUsers,
    isLoading: usersLoading || branchesLoading,
    inactiveUsersLoading,
    error: usersError || branchesError,
    inactiveUsersError,
    createUser,
    updateUser,
    reactivateUser,
    deactivateUser,
  };
}