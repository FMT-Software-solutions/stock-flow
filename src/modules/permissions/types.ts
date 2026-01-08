import type { UserRole } from '@/lib/auth';

// 1. Top-level permissions (Pages)
export type PermissionScope =
  | 'dashboard'
  | 'user_management'
  | 'branch_management'
  | 'inventory'
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
  | 'manage_roles'
  | 'activate_deactivate'
  | 'update_permissions'
  | 'manage_org_details'
  | 'view_org_appearance_prefs'
  | 'manage_org_appearance_prefs'
  | 'manage_notifications';

// 3. Permission Storage Structure
export interface ScopePermission {
  enabled: boolean;
  actions: PermissionAction[];
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
