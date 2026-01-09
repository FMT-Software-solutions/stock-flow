import { useOrganization } from '@/contexts/OrganizationContext';
import { hasPermission } from '@/modules/permissions';
import type {
  PermissionAction,
  PermissionScope,
} from '@/modules/permissions/types';
import type { OrganizationRole } from '@/types/organizations';
import type { ReactNode } from 'react';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: OrganizationRole[];
  fallback?: ReactNode;
}

export function RoleGuard({
  children,
  allowedRoles,
  fallback = null,
}: RoleGuardProps) {
  const { currentOrganization } = useOrganization();

  if (!currentOrganization) {
    return <>{fallback}</>;
  }

  const hasPermission = allowedRoles.includes(currentOrganization.user_role);

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Hook for checking roles in components
export function useRoleCheck() {
  const { currentOrganization } = useOrganization();

  const hasRole = (roles: OrganizationRole[]) => {
    if (!currentOrganization) return false;
    return roles.includes(currentOrganization.user_role);
  };

  const checkPermission = (
    scope: PermissionScope,
    action?: PermissionAction
  ) => {
    if (!currentOrganization) return false;

    // Require an explicit permissions payload from OrganizationContext
    if (!currentOrganization.permissions) return false;

    try {
      const permissions = JSON.parse(currentOrganization.permissions);
      const allowed = hasPermission(permissions, scope, action);
      return allowed;
    } catch (e) {
      console.error('Failed to parse permissions', e);
      return false;
    }
  };

  const canManageAllData = () => hasRole(['owner', 'admin']);
  const canViewAllData = () =>
    hasRole(['owner', 'admin', 'branch_admin', 'write']);
  const canManageBranchData = () =>
    hasRole(['owner', 'admin', 'branch_admin', 'write']);
  const canManageUserData = () => hasRole(['owner', 'admin', 'branch_admin']);
  const canWrite = () => hasRole(['owner', 'admin', 'branch_admin', 'write']);
  const canRead = () =>
    hasRole(['owner', 'admin', 'branch_admin', 'write', 'read']);
  const isOwner = () => hasRole(['owner']);
  const isAdmin = () => hasRole(['admin']);
  const isBranchAdmin = () => hasRole(['branch_admin']);

  return {
    hasRole,
    checkPermission,
    canManageAllData,
    canViewAllData,
    canManageBranchData,
    canManageUserData,
    canWrite,
    canRead,
    isOwner,
    isAdmin,
    isBranchAdmin,
    currentRole: currentOrganization?.user_role,
  };
}

// Higher-order component for role-based access
export function withRoleGuard<P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles: OrganizationRole[],
  fallback?: ReactNode
) {
  return function GuardedComponent(props: P) {
    return (
      <RoleGuard allowedRoles={allowedRoles} fallback={fallback}>
        <Component {...props} />
      </RoleGuard>
    );
  };
}
