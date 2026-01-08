import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  useCreateOrganization,
  useInviteUser,
  useRemoveUser,
  useUpdateOrganization,
  useUpdateUserRole,
  useUserOrganizations,
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

  // Use React Query hooks
  const useRpc = !!import.meta.env.VITE_ORG_RPC_BOOTSTRAP;
  const {
    data: userOrganizationsRaw = [],
    isLoading,
    error: queryError,
    refetch: refreshOrganizations,
  } = useRpc
    ? useUserOrganizationsV2(user?.id)
    : useUserOrganizations(user?.id);

  const userOrganizations: OrganizationWithRole[] = useRpc
    ? (userOrganizationsRaw as any[]).map((item) => {
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
      })
    : (userOrganizationsRaw as OrganizationWithRole[]);

  console.log(userOrganizations);

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
    if (userOrganizations.length === 1) {
      const onlyId = userOrganizations[0].id;
      if (currentOrganization?.id !== onlyId || selectedOrgId !== onlyId) {
        selectOrganization(onlyId);
      }
      return;
    }
    if (selectedOrgId && currentOrganization?.id !== selectedOrgId) {
      selectOrganization(selectedOrgId);
    }
  }, [userOrganizations, selectedOrgId, currentOrganization?.id]);

  const selectOrganization = async (organizationId: string) => {
    const organization = userOrganizations.find(
      (org) => org.id === organizationId
    );
    if (organization) {
      if (selectedOrgId !== organizationId) {
        setSelectedOrgId(organizationId);
      }
      if (currentOrganization?.id !== organization.id) {
        setCurrentOrganization(organization);
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
