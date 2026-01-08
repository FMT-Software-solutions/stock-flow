import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import type {
  Organization,
  OrganizationWithRole,
  CreateOrganizationData,
  UpdateOrganizationData,
  OrganizationRole,
} from '../types/organizations';
import type { OrganizationContextItem } from '../types/organizations';
import {
  DEFAULT_BRAND_COLORS,
  DEFAULT_LOGO_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '../types/organizations';
import { buildUserPermissions } from '@/modules/permissions';

// Query Keys
export const organizationKeys = {
  all: ['organizations'] as const,
  userOrganizations: (userId: string) => [...organizationKeys.all, 'user', userId] as const,
  userOrganizationsV2: (userId: string) => [...organizationKeys.all, 'user-v2', userId] as const,
  organization: (id: string) => [...organizationKeys.all, 'detail', id] as const,
};

export function useUserOrganizationsV2(userId: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.userOrganizationsV2(userId || ''),
    queryFn: async (): Promise<OrganizationContextItem[]> => {
      if (!userId) throw new Error('User ID is required');
      const { data, error } = await supabase.rpc('get_user_org_context', { user_id: userId });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      return rows.map((item: any) => {
        const basePerms = item.base_role_permissions || {};
        const overrides = item.user_overrides || undefined;
        const effective = item.effective_permissions || buildUserPermissions(item.user_role as any, overrides, basePerms);
        return {
          organization: item.organization as Organization,
          user_role: item.user_role as OrganizationRole,
          role_id: item.role_id ?? null,
          role_name: item.role_name ?? null,
          base_role_permissions: basePerms,
          user_overrides: overrides ?? null,
          branch_ids: Array.isArray(item.branch_ids) ? item.branch_ids : [],
          effective_permissions: effective,
          needs_seeding: !!item.needs_seeding
        };
      });
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

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
            is_active,
            ai_daily_limit
          )
        `)
        .eq('user_id', userId)
        .eq('organization.is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const organizations: OrganizationWithRole[] = await Promise.all(
        (data || []).map(async item => {
          const orgRole = Array.isArray(item.organization_role)
            ? item.organization_role[0]
            : item.organization_role;

          const roleType = (orgRole?.type || item.role) as OrganizationRole;

          let basePermissionsObj: any = {};
          let customPermissionsObj: any = {};

          try {
            basePermissionsObj = orgRole?.permissions ? JSON.parse(orgRole.permissions) : {};
          } catch {
            basePermissionsObj = {};
          }

          try {
            customPermissionsObj = item.permissions ? JSON.parse(item.permissions) : {};
          } catch {
            customPermissionsObj = {};
          }

          if (!basePermissionsObj || Object.keys(basePermissionsObj).length === 0) {
            const { data: roleByType } = await supabase
              .from('organization_roles')
              .select('id,type,permissions')
              .eq('organization_id', (item.organization as any)?.id)
              .eq('type', roleType)
              .limit(1);
            const fallbackRole = Array.isArray(roleByType) ? roleByType[0] : roleByType;
            try {
              basePermissionsObj = fallbackRole?.permissions ? JSON.parse(fallbackRole.permissions) : {};
            } catch {
              basePermissionsObj = {};
            }
          }

          const hasBase = basePermissionsObj && Object.keys(basePermissionsObj).length > 0;
          const effectivePermissionsObj = buildUserPermissions(
            roleType as any,
            customPermissionsObj,
            hasBase ? basePermissionsObj : undefined
          );
          if (import.meta.env.DEV) {
            console.debug('org:effective-permissions', {
              organizationId: (item.organization as any)?.id,
              organizationName: (item.organization as any)?.name,
              roleType,
              baseScopes: Object.keys(basePermissionsObj || {}),
              overrideScopes: Object.keys(customPermissionsObj || {}),
              effectiveScopes: Object.keys(effectivePermissionsObj || {}),
              usedFallbackDefaults: !hasBase
            });
          }
          const effectivePermissions = JSON.stringify(effectivePermissionsObj);

          return {
            ...(item.organization as any),
            user_role: roleType,
            role_id: item.role_id,
            role_name: orgRole?.name,
            permissions: effectivePermissions,
          };
        })
      );

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
