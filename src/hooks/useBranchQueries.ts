import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import type {
  Branch,
  UserBranch,
  CreateBranchData,
  UpdateBranchData,
  CreateUserBranchData,
  UpdateUserBranchData,
} from '../types/branches';

// Query Keys
export const branchKeys = {
  all: ['branches'] as const,
  userBranches: (userId: string, organizationId: string) =>
    [...branchKeys.all, 'user', userId, 'org', organizationId] as const,
  organizationBranches: (organizationId: string) =>
    [...branchKeys.all, 'organization', organizationId] as const,
  branch: (id: string) => [...branchKeys.all, 'detail', id] as const,
};

// Hook to fetch branches accessible to a user in an organization
export function useBranches(organizationId: string | undefined) {
  return useQuery({
    queryKey: branchKeys.organizationBranches(organizationId || ''),
    queryFn: async (): Promise<Branch[]> => {
      if (!organizationId) throw new Error('Organization ID is required');

      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_deleted', false)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });
}

// Hook to fetch user's branch assignments
export function useUserBranches(userId: string | undefined, organizationId: string | undefined) {
  return useQuery({
    queryKey: branchKeys.userBranches(userId || '', organizationId || ''),
    queryFn: async (): Promise<UserBranch[]> => {
      if (!userId || !organizationId) throw new Error('User ID and Organization ID are required');

      const { data, error } = await supabase
        .from('user_branches')
        .select(`
          *,
          branch:branches!inner(*)
        `)
        .eq('user_id', userId)
        .eq('branch.is_active', true)
        .eq('branch.is_deleted', false)
        .eq('branch.organization_id', organizationId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && !!organizationId,
  });
}

// Hook to create a new branch
export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBranchData): Promise<Branch> => {
      const { data: branch, error } = await supabase
        .from('branches')
        .insert({
          name: data.name,
          location: data.location,
          description: data.description,
          contact: data.contact,
          is_active: data.is_active ?? true,
          organization_id: data.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      return branch;
    },
    onSuccess: (data) => {
      // Invalidate and refetch organization branches
      queryClient.invalidateQueries({
        queryKey: branchKeys.organizationBranches(data.organization_id),
      });
    },
  });
}

// Hook to update a branch
export function useUpdateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateBranchData): Promise<Branch> => {
      const { id, ...updateData } = data;
      const { data: branch, error } = await supabase
        .from('branches')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return branch;
    },
    onSuccess: (data) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({
        queryKey: branchKeys.organizationBranches(data.organization_id),
      });
      queryClient.invalidateQueries({
        queryKey: branchKeys.branch(data.id),
      });
    },
  });
}

// Hook to remove a branch
export function useDeleteBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (branchId: string): Promise<void> => {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', branchId);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate all branch queries
      queryClient.invalidateQueries({
        queryKey: branchKeys.all,
      });
    },
  });
}

// Hook to assign user to branch
export function useAssignUserToBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateUserBranchData): Promise<UserBranch> => {
      const { data: userBranch, error } = await supabase
        .from('user_branches')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return userBranch;
    },
    onSuccess: (data) => {
      // Invalidate user branch queries
      queryClient.invalidateQueries({
        queryKey: branchKeys.userBranches(data.user_id, data.organization_id),
      });
    },
  });
}

// Hook to remove user from branch
export function useRemoveUserFromBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userBranchId: string): Promise<void> => {
      const { error } = await supabase
        .from('user_branches')
        .delete()
        .eq('id', userBranchId);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate all user branch queries
      queryClient.invalidateQueries({
        queryKey: branchKeys.all,
      });
    },
  });
}

// Hook to update user branch assignment
export function useUpdateUserBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateUserBranchData): Promise<UserBranch> => {
      const { id, ...updateData } = data;
      const { data: userBranch, error } = await supabase
        .from('user_branches')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return userBranch;
    },
    onSuccess: (data) => {
      // Invalidate user branch queries
      queryClient.invalidateQueries({
        queryKey: branchKeys.userBranches(data.user_id, data.organization_id),
      });
    },
  });
}