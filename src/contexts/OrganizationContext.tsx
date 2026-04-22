import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  useCreateOrganization,
  useInviteUser,
  useRemoveUser,
  useUpdateOrganization,
  useUpdateUserRole,
  useUserOrganizationsV2,
} from '../hooks/useOrganizationQueries';
import type {
  CreateOrganizationData,
  Organization,
  OrganizationContextType,
  OrganizationRole,
  OrganizationWithRole,
  UpdateOrganizationData,
} from '../types/organizations';
import { useAuth } from './AuthContext';
import { buildUserPermissions } from '@/modules/permissions';
import { setOrgTheme } from '@/lib/dexie';

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
);

const STORAGE_KEY = 'fmt-selected-organization';

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const { user } = useAuth();
  const [
    currentOrganization,
    setCurrentOrganization,
  ] = useState<OrganizationWithRole | null>(null);
  const [
    selectedOrgId,
    setSelectedOrgId,
    removeSelectedOrgId,
  ] = useLocalStorage<string | null>(STORAGE_KEY, null);

  // Always use RPC v2 for organization context
  const {
    data: userOrganizationsRaw = [],
    isLoading,
    error: queryError,
    refetch: refreshOrganizations,
  } = useUserOrganizationsV2(user?.id);

  const userOrganizations: OrganizationWithRole[] = (userOrganizationsRaw as any[]).map(
    (item) => {
      const effective =
        item.effective_permissions ||
        buildUserPermissions(
          item.user_role,
          item.user_overrides || undefined,
          item.base_role_permissions || {}
        );
      return {
        ...item.organization,
        user_role: item.user_role as OrganizationRole,
        role_id: item.role_id ?? null,
        role_name: item.role_name ?? null,
        permissions: JSON.stringify(effective),
        branch_ids: Array.isArray(item.branch_ids) ? item.branch_ids : [],
      } as OrganizationWithRole;
    }
  );

  const createOrganizationMutation = useCreateOrganization();
  const updateOrganizationMutation = useUpdateOrganization();
  const inviteUserMutation = useInviteUser();
  const updateUserRoleMutation = useUpdateUserRole();
  const removeUserMutation = useRemoveUser();

  // Convert query error to string for compatibility
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : 'An error occurred'
    : null;

  // Handle organization selection logic in useEffect to avoid state updates during render
  useEffect(() => {
    if (userOrganizations.length === 0) return;
    
    // Always find the current organization from the latest userOrganizations data
    // This ensures that when userOrganizations updates (e.g. after a mutation), 
    // currentOrganization gets the updated properties.
    const activeId = selectedOrgId || (userOrganizations.length === 1 ? userOrganizations[0].id : null);
    
    if (activeId) {
      const latestOrgData = userOrganizations.find(org => org.id === activeId);
      if (latestOrgData) {
        // Only update state if the actual data changed, to prevent infinite re-renders
        if (JSON.stringify(currentOrganization) !== JSON.stringify(latestOrgData)) {
          setCurrentOrganization(latestOrgData);
          if (selectedOrgId !== activeId) {
            setSelectedOrgId(activeId);
          }
        }
      }
    }
  }, [userOrganizations, selectedOrgId, currentOrganization]);

  const selectOrganization = async (organizationId: string) => {
    const organization = userOrganizations.find(
      (org) => org.id === organizationId
    );
    if (organization) {
      if (selectedOrgId !== organizationId) {
        setSelectedOrgId(organizationId);
      }
      setCurrentOrganization(organization);
      if (organization.brand_colors) {
        await setOrgTheme(
          organization.id,
          organization.brand_colors.id,
          organization.brand_colors
        );
      }
    }
  };

  const createOrganization = async (
    data: CreateOrganizationData
  ): Promise<Organization> => {
    if (!user) throw new Error('User not authenticated');
    const newOrganization = await createOrganizationMutation.mutateAsync({
      data,
      userId: user.id,
    });

    // Create the organization with role for immediate selection
    const newOrganizationWithRole: OrganizationWithRole = {
      ...newOrganization,
      user_role: 'owner' as OrganizationRole,
    };

    setSelectedOrgId(newOrganization.id);
    setCurrentOrganization(newOrganizationWithRole);

    return newOrganization;
  };

  const updateOrganization = async (
    data: UpdateOrganizationData
  ): Promise<Organization> => {
    return updateOrganizationMutation.mutateAsync(data);
  };

  const inviteUser = async (
    organizationId: string,
    email: string,
    role: OrganizationRole
  ): Promise<void> => {
    await inviteUserMutation.mutateAsync({ organizationId, email, role });
  };

  const updateUserRole = async (
    userOrganizationId: string,
    role: OrganizationRole
  ): Promise<void> => {
    await updateUserRoleMutation.mutateAsync({ userOrganizationId, role });
  };

  const removeUser = async (userOrganizationId: string): Promise<void> => {
    await removeUserMutation.mutateAsync(userOrganizationId);
  };

  const refreshOrganizationsWrapper = async (): Promise<void> => {
    await refreshOrganizations();
  };

  const clearOrganizationData = () => {
    setCurrentOrganization(null);
    removeSelectedOrgId();
  };

  const value: OrganizationContextType = {
    currentOrganization,
    userOrganizations,
    selectedOrgId,
    isLoading,
    error,
    selectOrganization,
    createOrganization,
    updateOrganization,
    refreshOrganizations: refreshOrganizationsWrapper,
    inviteUser,
    updateUserRole,
    removeUser,
    clearOrganizationData,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error(
      'useOrganization must be used within an OrganizationProvider'
    );
  }
  return context;
}
