import { ROLE_HIERARCHY, type UserRole } from "@/lib/auth";
import type { UserPermissions } from "@/modules/permissions/types";
import type { CompleteTheme } from "./theme";

// Use UserRole from auth.ts for consistency
export type { UserRole as OrganizationRole } from "@/lib/auth";
export { USER_ROLE_DISPLAY_NAMES as ROLE_DISPLAY_NAMES } from "@/lib/auth";


// Logo settings simplified - always square orientation
export interface LogoSettings {
  // Reserved for future logo-related settings if needed
}

export interface NotificationSettings {
  roleChanges: boolean;
  securityAlerts: boolean;
  appUpdates: boolean;
  newUserAdded: boolean;
}

export interface BrandColors {
  light: {
    primary: string;
    secondary: string;
    accent: string;
  };
  dark: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

// Main organization interface
export interface Organization {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  logo?: string | null;
  address?: string | null;
  created_at: string;
  updated_at: string;
  currency: string;
  logo_settings: LogoSettings;
  brand_colors: CompleteTheme;
  notification_settings: NotificationSettings;
  theme_name?: string | null;
  is_active: boolean;
  ai_daily_limit: number;
  has_purchased: boolean;
  trial_end_date: string | null;
}

export interface OrganizationRoleEntity {
  id: string;
  organization_id: string;
  name: string;
  type: 'owner' | 'admin' | 'branch_admin' | 'custom';
  permissions: string; // JSON string of UserPermissions
  description?: string | null;
  created_at: string;
  updated_at: string;
}

// User organization relationship interface
export interface UserOrganization {
  id: string;
  user_id: string;
  organization_id: string;
  role: UserRole; // Keeps backward compatibility for now, but should ideally derive from role_id
  role_id?: string | null; // New field
  role_details?: OrganizationRoleEntity; // For joined queries
  created_at: string;
  updated_at: string;
  organization?: Organization; // Optional populated organization data
}

// Organization with user role (for context)
export interface OrganizationWithRole extends Organization {
  user_role: UserRole; // This might be 'custom' if we update UserRole, or we map it to closest standard role
  role_id?: string | null; // New field
  role_name?: string; // New field for display
  permissions?: string | null; // JSON string of UserPermissions (from user override or role)
  branch_ids?: string[]; // Assigned branches for current user in this org
}

// Organization creation/update types
export interface CreateOrganizationData {
  name: string;
  email?: string | null;
  phone?: string | null;
  logo?: string | null;
  address?: string | null;
  currency?: string;
  logo_settings?: LogoSettings;
  brand_colors?: CompleteTheme | null;
  notification_settings?: NotificationSettings;
  theme_name?: string | null;
  is_active: boolean;
}

export interface UpdateOrganizationData extends Partial<CreateOrganizationData> {
  id: string;
}

// Organization context types
export interface OrganizationContextType {
  currentOrganization: OrganizationWithRole | null;
  userOrganizations: OrganizationWithRole[];
  selectedOrgId: string | null;
  isLoading: boolean;
  error: string | null;
  selectOrganization: (organizationId: string) => Promise<void>;
  createOrganization: (data: CreateOrganizationData) => Promise<Organization>;
  updateOrganization: (data: UpdateOrganizationData) => Promise<Organization>;
  refreshOrganizations: () => Promise<void>;
  inviteUser: (organizationId: string, email: string, role: UserRole) => Promise<void>;
  updateUserRole: (userOrganizationId: string, role: UserRole) => Promise<void>;
  removeUser: (userOrganizationId: string) => Promise<void>;
  clearOrganizationData: () => void;
}

// Default values
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  roleChanges: true,
  securityAlerts: true,
  appUpdates: true,
  newUserAdded: true,
};

export const DEFAULT_BRAND_COLORS: BrandColors = {
  light: {
    primary: '#3b82f6',
    secondary: '#64748b',
    accent: '#06b6d4',
  },
  dark: {
    primary: '#60a5fa',
    secondary: '#94a3b8',
    accent: '#22d3ee',
  },
};

export const DEFAULT_LOGO_SETTINGS: LogoSettings = {
  // No default settings needed - always square orientation
};



// Helper function to check if user has permission
export const hasPermission = (
  userRole: UserRole,
  requiredRole: UserRole
): boolean => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

export interface OrganizationContextItem {
  organization: Organization;
  user_role: UserRole;
  role_id?: string | null;
  role_name?: string | null;
  base_role_permissions: UserPermissions;
  user_overrides?: UserPermissions | null;
  branch_ids: string[];
  effective_permissions?: UserPermissions | null;
  needs_seeding?: boolean;
}
