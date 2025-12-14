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
  inventory: {
    label: 'Inventory',
    description: 'Manage products and stock',
    actions: {
      create: 'Create Products',
      edit: 'Edit Products',
      delete: 'Delete Products',
      export: 'Export Inventory',
    },
  },
  orders: {
    label: 'Orders',
    description: 'Manage customer orders',
    actions: {
      create: 'Create Orders',
      edit: 'Edit Orders',
      delete: 'Delete Orders',
      export: 'Export Orders',
    },
  },
  customers: {
    label: 'Customers',
    description: 'Manage customers',
    actions: {
      create: 'Create Customers',
      edit: 'Edit Customers',
      delete: 'Delete Customers',
      export: 'Export Customers',
    },
  },
  suppliers: {
    label: 'Suppliers',
    description: 'Manage suppliers',
    actions: {
      create: 'Create Suppliers',
      edit: 'Edit Suppliers',
      delete: 'Delete Suppliers',
      export: 'Export Suppliers',
    },
  },
  reports: {
    label: 'Reports',
    description: 'View and export reports',
    actions: {
      view: 'View Reports',
      export: 'Export Reports',
    },
  },
  expenses: {
    label: 'Expenses',
    description: 'Manage expenses',
    actions: {
      create: 'Create Expenses',
      edit: 'Edit Expenses',
      delete: 'Delete Expenses',
      export: 'Export Expenses',
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
    inventory: ['create', 'edit', 'delete', 'export'],
    orders: ['create', 'edit', 'delete', 'export'],
    customers: ['create', 'edit', 'delete', 'export'],
    suppliers: ['create', 'edit', 'delete', 'export'],
    reports: ['view', 'export'],
    expenses: ['create', 'edit', 'delete', 'export'],
    settings: ['manage_org_details', 'view_org_appearance_prefs', 'manage_org_appearance_prefs', 'manage_notifications'],
  },
  admin: {
    dashboard: [],
    user_management: ['create', 'edit', 'activate_deactivate', 'delete', 'update_permissions'],
    branch_management: ['create', 'edit', 'activate_deactivate'],
    inventory: ['create', 'edit', 'delete', 'export'],
    orders: ['create', 'edit', 'delete', 'export'],
    customers: ['create', 'edit', 'delete', 'export'],
    suppliers: ['create', 'edit', 'delete', 'export'],
    reports: ['view', 'export'],
    expenses: ['create', 'edit', 'delete', 'export'],
    settings: ['manage_org_details', 'view_org_appearance_prefs', 'manage_org_appearance_prefs', 'manage_notifications'],
  },
  branch_admin: {
    dashboard: [],
    user_management: ['create', 'edit', 'activate_deactivate'], 
    branch_management: ['edit', 'activate_deactivate'], 
    inventory: ['create', 'edit', 'delete', 'export'],
    orders: ['create', 'edit', 'delete', 'export'],
    customers: ['create', 'edit', 'delete', 'export'],
    suppliers: ['create', 'edit', 'delete', 'export'],
    reports: ['view', 'export'],
    expenses: ['create', 'edit', 'delete', 'export'],
    settings: ['view_org_appearance_prefs'],
  },
  write: {
    dashboard: [],
    inventory: ['create', 'edit'],
    orders: ['create', 'edit'],
    customers: ['create', 'edit'],
    suppliers: ['create', 'edit'],
    reports: ['view'],
    expenses: ['create', 'edit'],
    // Editors cannot access user management

    // Editors cannot access branch management (implied "viewers can only see dashboard", editor usually similar unless specified)
    // Editors cannot access settings (implied)
  },
  read: {
    dashboard: [],
    inventory: [],
    orders: [],
    customers: [],
    suppliers: [],
    reports: [],
    expenses: [],
    // Viewers can only see dashboard
  },
  custom: {
    // Custom roles can potentially have access to everything (controlled by owner)
    dashboard: [],
    user_management: ['create', 'edit', 'activate_deactivate', 'delete', 'update_permissions'],
    branch_management: ['create', 'edit', 'activate_deactivate'],
    inventory: ['create', 'edit', 'delete', 'export'],
    orders: ['create', 'edit', 'delete', 'export'],
    customers: ['create', 'edit', 'delete', 'export'],
    suppliers: ['create', 'edit', 'delete', 'export'],
    reports: ['view', 'export'],
    expenses: ['create', 'edit', 'delete', 'export'],
    settings: ['manage_org_details', 'view_org_appearance_prefs', 'manage_org_appearance_prefs', 'manage_notifications'],
  },
};

// Default permissions applied when a user is assigned a role
export const ROLE_DEFAULT_PERMISSIONS: RolePermissionsConfig = {
  owner: {
    dashboard: [],
    user_management: ['create', 'edit', 'activate_deactivate', 'delete', 'update_permissions'],
    branch_management: ['create', 'edit', 'activate_deactivate'],
    inventory: ['create', 'edit', 'delete', 'export'],
    orders: ['create', 'edit', 'delete', 'export'],
    customers: ['create', 'edit', 'delete', 'export'],
    suppliers: ['create', 'edit', 'delete', 'export'],
    reports: ['view', 'export'],
    expenses: ['create', 'edit', 'delete', 'export'],
    settings: ['manage_org_details', 'view_org_appearance_prefs', 'manage_org_appearance_prefs', 'manage_notifications'],
  },
  admin: {
    dashboard: [],
    user_management: ['create', 'edit', 'activate_deactivate', 'delete', 'update_permissions'],
    branch_management: ['create', 'edit', 'activate_deactivate'],
    inventory: ['create', 'edit', 'delete', 'export'],
    orders: ['create', 'edit', 'delete', 'export'],
    customers: ['create', 'edit', 'delete', 'export'],
    suppliers: ['create', 'edit', 'delete', 'export'],
    reports: ['view', 'export'],
    expenses: ['create', 'edit', 'delete', 'export'],
    settings: ['manage_org_details', 'view_org_appearance_prefs', 'manage_org_appearance_prefs', 'manage_notifications'],
  },
  branch_admin: {
    dashboard: [],
    user_management: ['create', 'edit', 'activate_deactivate'],
    branch_management: ['edit'],
    inventory: ['create', 'edit', 'delete', 'export'],
    orders: ['create', 'edit', 'delete', 'export'],
    customers: ['create', 'edit', 'delete', 'export'],
    suppliers: ['create', 'edit', 'delete', 'export'],
    reports: ['view', 'export'],
    expenses: ['create', 'edit', 'delete', 'export'],
    settings: ['view_org_appearance_prefs'],
  },
  write: {
    dashboard: [],
    inventory: ['create', 'edit'],
    orders: ['create', 'edit'],
    customers: ['create', 'edit'],
    suppliers: ['create', 'edit'],
    reports: ['view'],
    expenses: ['create', 'edit'],
  },
  read: {
    dashboard: [],
    inventory: [],
    orders: [],
    customers: [],
    suppliers: [],
    reports: [],
    expenses: [],
  },
  custom: {
    dashboard: [],
    inventory: [],
    orders: [],
    customers: [],
    suppliers: [],
    reports: [],
    expenses: [],
  },
};
