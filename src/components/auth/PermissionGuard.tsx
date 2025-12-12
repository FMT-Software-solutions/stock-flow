import { useRoleCheck } from '@/components/auth/RoleGuard';
import type { PermissionAction, PermissionScope } from '@/modules/permissions/types';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

interface PermissionGuardProps {
  children: ReactNode;
  scope: PermissionScope;
  action?: PermissionAction;
  fallback?: ReactNode;
  redirectTo?: string;
}

export function PermissionGuard({
  children,
  scope,
  action,
  fallback,
  redirectTo = '/dashboard',
}: PermissionGuardProps) {
  const { checkPermission } = useRoleCheck();
  const hasAccess = checkPermission(scope, action);

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
