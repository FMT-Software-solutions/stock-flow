import type { AppPermissionsConfig, RolePermissionsConfig } from './types';

export const APP_PERMISSIONS: AppPermissionsConfig = {
  dashboard: {
    label: 'Dashboard',
    description: 'Overview of organization activity',
    actions: {},
  },
  user_management: {
    label: 'User Management',
    description: 'Manage users and their roles',
    actions: {
      create: 'Create Users',
      edit: 'Edit Users',
      activate_deactivate: 'Activate/Deactivate Users',
      delete: 'Delete Users',
      update_permissions: 'Update User Permissions',
    },
  },
  branch_management: {
    label: 'Branch Management',
    description: 'Manage branches and locations',
    actions: {
      create: 'Create Branches',
      edit: 'Edit Branches',
      activate_deactivate: 'Activate/Deactivate Branches',
    },
  },
  settings: {
    label: 'Settings',
    description: 'Organization settings',
    actions: {
      manage_org_details: 'Manage Organization Details',
      view_org_appearance_prefs: 'View Appearance Preferences',
      manage_org_appearance_prefs: 'Manage Appearance Preferences',
      manage_notifications: 'Manage Notifications',
    },
  },
};

// 4. Role Constraints
// Defines which actions are POSSIBLE for each role.
// If a scope is missing, the role cannot access that page at all.
// If a scope is present with empty array, the role can only VIEW that page.
export const ROLE_ALLOWED_PERMISSIONS: RolePermissionsConfig = {
  owner: {
    dashboard: [],
    user_management: ['create', 'edit', 'activate_deactivate', 'delete', 'update_permissions'],
    branch_management: ['create', 'edit', 'activate_deactivate'],
    settings: ['manage_org_details', 'view_org_appearance_prefs', 'manage_org_appearance_prefs', 'manage_notifications'],
  },
  admin: {
    dashboard: [],
    user_management: ['create', 'edit', 'activate_deactivate', 'delete', 'update_permissions'],
    branch_management: ['create', 'edit', 'activate_deactivate'],
    settings: ['manage_org_details', 'view_org_appearance_prefs', 'manage_org_appearance_prefs', 'manage_notifications'],
  },
  branch_admin: {
    dashboard: [],
    user_management: ['create', 'edit', 'activate_deactivate'], 
    branch_management: ['edit', 'activate_deactivate'], 
    settings: ['view_org_appearance_prefs'],
  },
  write: {
    dashboard: [],
    // Editors cannot access user management
    // Editors cannot access branch management (implied "viewers can only see dashboard", editor usually similar unless specified)
    // Editors cannot access settings (implied)
  },
  read: {
    dashboard: [],
    // Viewers can only see dashboard
  },
  custom: {
    // Custom roles can potentially have access to everything (controlled by owner)
    dashboard: [],
    user_management: ['create', 'edit', 'activate_deactivate', 'delete', 'update_permissions'],
    branch_management: ['create', 'edit', 'activate_deactivate'],
    settings: ['manage_org_details', 'view_org_appearance_prefs', 'manage_org_appearance_prefs', 'manage_notifications'],
  },
};

// Default permissions applied when a user is assigned a role
export const ROLE_DEFAULT_PERMISSIONS: RolePermissionsConfig = {
  owner: {
    dashboard: [],
    user_management: ['create', 'edit', 'activate_deactivate', 'delete', 'update_permissions'],
    branch_management: ['create', 'edit', 'activate_deactivate'],
    settings: ['manage_org_details', 'view_org_appearance_prefs', 'manage_org_appearance_prefs', 'manage_notifications'],
  },
  admin: {
    dashboard: [],
    user_management: ['create', 'edit', 'activate_deactivate', 'delete', 'update_permissions'],
    branch_management: ['create', 'edit', 'activate_deactivate'],
    settings: ['manage_org_details', 'view_org_appearance_prefs', 'manage_org_appearance_prefs', 'manage_notifications'],
  },
  branch_admin: {
    dashboard: [],
    user_management: ['create', 'edit', 'activate_deactivate'],
    branch_management: ['edit'],
    settings: ['view_org_appearance_prefs'],
  },
  write: {
    dashboard: [],
  },
  read: {
    dashboard: [],
  },
  custom: {
    dashboard: [],
  },
};
