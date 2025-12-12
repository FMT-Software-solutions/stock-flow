import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import { type OrganizationRoleEntity } from '@/types/organizations';
import supabase from '@/utils/supabase';
import { toast } from 'sonner';

export function useRoles() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  const { data: roles, isLoading, error } = useQuery({
    queryKey: ['organization_roles', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await supabase
        .from('organization_roles')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as OrganizationRoleEntity[];
    },
    enabled: !!currentOrganization?.id,
  });

  const createRole = useMutation({
    mutationFn: async (role: Partial<OrganizationRoleEntity>) => {
      if (!currentOrganization?.id) throw new Error('No organization selected');

      const { data, error } = await supabase
        .from('organization_roles')
        .insert({
          ...role,
          organization_id: currentOrganization.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization_roles'] });
      toast.success('Role created successfully');
    },
    onError: (error: any) => {
      console.error('Create role error:', error);
      toast.error('Failed to create role: ' + error.message);
    }
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OrganizationRoleEntity> & { id: string }) => {
      const { data, error } = await supabase
        .from('organization_roles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization_roles'] });
      toast.success('Role updated successfully');
    },
    onError: (error: any) => {
      console.error('Update role error:', error);
      toast.error('Failed to update role: ' + error.message);
    }
  });

  const deleteRole = useMutation({
    mutationFn: async (id: string) => {
      // Check if role is assigned to any users first? 
      // The DB constraint ON DELETE SET NULL handles it, but maybe we warn?
      // For now, let DB handle it.
      
      const { error } = await supabase
        .from('organization_roles')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization_roles'] });
      toast.success('Role deleted successfully');
    },
    onError: (error: any) => {
      console.error('Delete role error:', error);
      toast.error('Failed to delete role: ' + error.message);
    }
  });

  return {
    roles,
    isLoading,
    error,
    createRole,
    updateRole,
    deleteRole
  };
}
