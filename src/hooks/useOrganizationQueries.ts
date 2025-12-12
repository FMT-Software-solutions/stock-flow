import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import type {
  Organization,
  OrganizationWithRole,
  CreateOrganizationData,
  UpdateOrganizationData,
  OrganizationRole,
} from '../types/organizations';
import {
  DEFAULT_BRAND_COLORS,
  DEFAULT_LOGO_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '../types/organizations';

// Query Keys
export const organizationKeys = {
  all: ['organizations'] as const,
  userOrganizations: (userId: string) => [...organizationKeys.all, 'user', userId] as const,
  organization: (id: string) => [...organizationKeys.all, 'detail', id] as const,
};

// Hook to fetch user organizations
export function useUserOrganizations(userId: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.userOrganizations(userId || ''),
    queryFn: async (): Promise<OrganizationWithRole[]> => {
      if (!userId) throw new Error('User ID is required');

      const { data, error } = await supabase
        .from('user_organizations')
        .select(`
          id,
          role,
          permissions,
          role_id,
          organization_role:organization_roles(
            id,
            name,
            type,
            permissions
          ),
          created_at,
          updated_at,
          organization:organizations!inner(
            id,
            name,
            email,
            phone,
            logo,
            address,
            created_at,
            updated_at,
            currency,
            logo_settings,
            brand_colors,
            notification_settings,
            is_active
          )
        `)
        .eq('user_id', userId)
        .eq('organization.is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const organizations: OrganizationWithRole[] = data
        ?.map(item => {
          // Determine effective permissions:
          // 1. If organization_role exists, use its permissions
          // 2. Fallback to direct permissions column
          // 3. Fallback to role defaults (handled in types or wherever used)
          
          const orgRole = Array.isArray(item.organization_role) 
            ? item.organization_role[0] 
            : item.organization_role;

          let effectivePermissions = item.permissions;
          if (orgRole?.permissions) {
            // Merge logic:
            // 1. Parse role permissions (Base)
            // 2. Parse user permissions (Override)
            // 3. For each scope, use Role's enabled state
            // 4. For each scope, use User's actions if defined, else Role's actions
            
            try {
              const rolePerms = JSON.parse(orgRole.permissions);
              const userPerms = item.permissions ? JSON.parse(item.permissions) : {};
              const mergedPerms: any = {};

              Object.keys(rolePerms).forEach(scope => {
                const roleScope = rolePerms[scope];
                const userScope = userPerms[scope];

                mergedPerms[scope] = {
                  enabled: roleScope.enabled, // Page access locked to Role
                  actions: userScope?.actions ?? roleScope.actions // Actions fallback to Role if not defined by User
                };
              });
              
              effectivePermissions = JSON.stringify(mergedPerms);
            } catch (e) {
              console.error('Error merging permissions', e);
              effectivePermissions = orgRole.permissions;
            }
          }

          return {
            ...(item.organization as any),
            user_role: (orgRole?.type || item.role) as OrganizationRole, // Use role type (owner/custom/etc) or legacy role
            role_id: item.role_id,
            role_name: orgRole?.name,
            permissions: effectivePermissions,
          };
        }) || [];

      return organizations;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to create organization
export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      data,
      userId,
    }: {
      data: CreateOrganizationData;
      userId: string;
    }): Promise<Organization> => {
      if (!userId) throw new Error('User not authenticated');

      // Create organization with default values
      const organizationData = {
        ...data,
        currency: data.currency || 'GHS',
        logo_settings: data.logo_settings || DEFAULT_LOGO_SETTINGS,
        brand_colors: data.brand_colors || DEFAULT_BRAND_COLORS,
        notification_settings: data.notification_settings || DEFAULT_NOTIFICATION_SETTINGS,
      };

      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert(organizationData)
        .select()
        .single();

      if (createError) throw createError;

      // Add user as owner
      const { error: userOrgError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: userId,
          organization_id: newOrg.id,
          role: 'owner' as OrganizationRole,
        });

      if (userOrgError) throw userOrgError;

      return newOrg;
    },
    onSuccess: (_, { userId }) => {
      // Invalidate and refetch user organizations
      queryClient.invalidateQueries({
        queryKey: organizationKeys.userOrganizations(userId),
      });
    },
  });
}

// Hook to update organization
export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateOrganizationData): Promise<Organization> => {
      const { id, ...updateData } = data;
      
      // Filter out undefined values and convert them to null for proper database handling
      const cleanedUpdateData = Object.fromEntries(
        Object.entries(updateData).map(([key, value]) => [
          key,
          value === undefined ? null : value
        ])
      );

      const { data: updatedOrg, error: updateError } = await supabase
        .from('organizations')
        .update(cleanedUpdateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Organization update error:', updateError);
        throw updateError;
      }

      return updatedOrg;
    },
    onSuccess: (updatedOrg, variables) => {
      // Update the specific organization in cache
      queryClient.setQueryData(
        organizationKeys.organization(variables.id),
        updatedOrg
      );
      
      // Invalidate user organizations to refresh the list
      queryClient.invalidateQueries({
        queryKey: organizationKeys.all,
      });
    },
  });
}

// Hook to invite user to organization
export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      email,
      role,
    }: {
      organizationId: string;
      email: string;
      role: OrganizationRole;
    }) => {
      // This would typically involve sending an invitation email
      // For now, we'll just add the user if they exist
      const { data: userData, error: userError } = await supabase
        .from('auth.users')
        .select('id')
        .eq('email', email)
        .single();

      if (userError) throw new Error('User not found');

      const { error: inviteError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: userData.id,
          organization_id: organizationId,
          role,
        });

      if (inviteError) throw inviteError;

      return { success: true };
    },
    onSuccess: () => {
      // Invalidate all organization queries to refresh data
      queryClient.invalidateQueries({
        queryKey: organizationKeys.all,
      });
    },
  });
}

// Hook to update user role
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userOrganizationId,
      role,
    }: {
      userOrganizationId: string;
      role: OrganizationRole;
    }) => {
      const { error: updateError } = await supabase
        .from('user_organizations')
        .update({ role })
        .eq('id', userOrganizationId);

      if (updateError) throw updateError;

      return { success: true };
    },
    onSuccess: () => {
      // Invalidate all organization queries to refresh data
      queryClient.invalidateQueries({
        queryKey: organizationKeys.all,
      });
    },
  });
}

// Hook to remove user from organization
export function useRemoveUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userOrganizationId: string) => {
      const { error: deleteError } = await supabase
        .from('user_organizations')
        .delete()
        .eq('id', userOrganizationId);

      if (deleteError) throw deleteError;

      return { success: true };
    },
    onSuccess: () => {
      // Invalidate all organization queries to refresh data
      queryClient.invalidateQueries({
        queryKey: organizationKeys.all,
      });
    },
  });
}