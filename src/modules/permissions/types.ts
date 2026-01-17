import type { UserRole } from '@/lib/auth';

// 1. Top-level permissions (Pages)
export type PermissionScope =
  | 'dashboard'
  | 'user_management'
  | 'branch_management'
  | 'inventory'
  | 'discounts'
  | 'inventory_entries'
  | 'products'
  | 'product_categories'
  | 'variations'
  | 'orders'
  | 'customers'
  | 'suppliers'
  | 'reports'
  | 'expenses'
  | 'expense_categories'
  | 'expense_types'
  | 'settings';





// 2. Child permissions (Actions)
export type PermissionAction =
  | 'view'      // Implicitly true if enabled
  | 'create'
  | 'edit'
  | 'delete'
  | 'export'
  | 'view_code'
  | 'manage_roles'
  | 'activate_deactivate'
  | 'update_permissions'
  | 'manage_org_details'
  | 'view_org_appearance_prefs'
  | 'manage_org_appearance_prefs'
  | 'manage_notifications';

// 3. Permission Storage Structure
export type DataLookback =
  | { unit: 'days'; value: number }
  | { unit: 'months'; value: number }
  | { unit: 'years'; value: number }
  | { unit: 'forever' };

export interface PermissionDataAccess {
  maxLookback?: DataLookback;
}

export interface ScopePermission {
  enabled: boolean;
  actions: PermissionAction[];
  dataAccess?: PermissionDataAccess;
}

export type UserPermissions = Partial<Record<PermissionScope, ScopePermission>>;

// Configuration Types
export interface PermissionDefinition {
  label: string;
  description: string;
  actions: Partial<Record<PermissionAction, string>>;
  parent?: PermissionScope;
  children?: PermissionScope[];
}

export type AppPermissionsConfig = Partial<Record<PermissionScope, PermissionDefinition>>;

export type RolePermissionsConfig = Record<UserRole, Partial<Record<PermissionScope, PermissionAction[]>>>;
