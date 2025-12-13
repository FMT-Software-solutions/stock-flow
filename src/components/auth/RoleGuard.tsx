import { useOrganization } from '@/contexts/OrganizationContext';
import { hasPermission, buildUserPermissions } from '@/modules/permissions';
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

    // If no permissions string, we use the role's default permissions
    // This handles legacy data or cases where permissions haven't been explicitly stored
    if (!currentOrganization.permissions) {
      const defaultPermissions = buildUserPermissions(
        currentOrganization.user_role
      );
      return hasPermission(defaultPermissions, scope, action);
    }

    try {
      const permissions = JSON.parse(currentOrganization.permissions);
      return hasPermission(permissions, scope, action);
    } catch (e) {
      console.error('Failed to parse permissions', e);
      // Fallback to role defaults on parse error
      const defaultPermissions = buildUserPermissions(
        currentOrganization.user_role
      );
      return hasPermission(defaultPermissions, scope, action);
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
