import type { UserRole } from '@/lib/auth';
import type {
  UserPermissions,
  PermissionScope,
  PermissionAction,
} from './types';
import {
  ROLE_ALLOWED_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  APP_PERMISSIONS,
} from './config';

/**
 * Returns a permission set with ALL possible scopes and actions enabled.
 * Useful for editing Custom Roles which have no inherent constraints.
 */
export function getAllPossiblePermissions(): UserPermissions {
  const result: UserPermissions = {};

  (Object.keys(APP_PERMISSIONS) as PermissionScope[]).forEach(scope => {
    const config = APP_PERMISSIONS[scope]!;
    result[scope] = {
      enabled: true,
      actions: Object.keys(config.actions) as PermissionAction[]
    };
  });

  return result;
}

/**
 * Checks if a user permission set allows a specific action on a scope.
 * 
 * @param permissions - The user's permission object
 * @param scope - The page/scope to check
 * @param action - The specific action to check (optional). If omitted, checks for view access.
 * @returns boolean
 */
export function hasPermission(
  permissions: UserPermissions,
  scope: PermissionScope,
  action?: PermissionAction
): boolean {
  const config = APP_PERMISSIONS[scope];
  if (config?.parent) {
    const parentPerm = permissions[config.parent];
    if (!parentPerm?.enabled) {
      return false;
    }
  }
  const scopePermission = permissions[scope];
  if (!scopePermission?.enabled) {
    return false;
  }
  if (!action || action === 'view') {
    return true;
  }
  return scopePermission.actions.includes(action);
}

/**
 * Constructs the full permission object for a user based on their role and any custom overrides.
 * This ensures that even if defaults change, we can reconstruct the user's effective permissions.
 * 
 * @param role - The user's role
 * @param customPermissions - (Optional) Custom permissions stored in DB (user overrides)
 * @param basePermissions - (Optional) The organization's base permissions for this role. If not provided, uses static defaults.
 * @returns UserPermissions
 */
export function buildUserPermissions(
  role: UserRole,
  customPermissions?: UserPermissions,
  basePermissions?: UserPermissions
): UserPermissions {
  if (import.meta.env.DEV) {
    console.debug('buildUserPermissions:start', {
      role,
      baseScopes: Object.keys(basePermissions || {}),
      customScopes: Object.keys(customPermissions || {}),
    });
  }
  // 1. Start with base permissions (organization role or static defaults)
  const result: UserPermissions = {};

  if (basePermissions) {
    // If basePermissions provided, it follows UserPermissions structure
    (Object.keys(basePermissions) as PermissionScope[]).forEach(scope => {
      const defaultScope = basePermissions[scope];
      if (defaultScope) {
        result[scope] = {
          enabled: defaultScope.enabled,
          actions: [...defaultScope.actions]
        };
      }
    });
  } else {
    // Fallback to static defaults which are arrays of actions
    const defaults = ROLE_DEFAULT_PERMISSIONS[role] || {};
    (Object.keys(defaults) as PermissionScope[]).forEach(scope => {
      const defaultActions = defaults[scope];
      if (defaultActions) {
        result[scope] = {
          enabled: true,
          actions: [...defaultActions]
        };
      }
    });
  }

  if (import.meta.env.DEV) {
    console.debug('buildUserPermissions:afterBase', {
      role,
      scopes: Object.keys(result),
    });
  }
  // 2. Apply custom overrides if they exist
  if (customPermissions) {
    (Object.keys(customPermissions) as PermissionScope[]).forEach(scope => {
      const custom = customPermissions[scope];
      if (custom) {
        // Validate against allowed permissions for this role
        const allowedActions = ROLE_ALLOWED_PERMISSIONS[role]?.[scope];

        // If the role isn't allowed this scope at all, skip it
        if (!allowedActions) return;

        // Filter actions to only include those allowed for this role
        const validActions = custom.actions.filter(a => allowedActions.includes(a));

        // If the override explicitly disables a scope, honor it.
        // If it explicitly enables it, honor it (checked against allowedActions above indirectly by existence).
        // If the scope wasn't in defaults but is in custom, add it (provided it's allowed).

        result[scope] = {
          enabled: custom.enabled,
          actions: validActions
        };
      }
    });
  }

  if (import.meta.env.DEV) {
    console.debug('buildUserPermissions:result', {
      role,
      scopes: Object.keys(result),
      snapshot: result,
    });
  }
  return result;
}

/**
 * Returns the list of permissions that CAN be assigned to a specific role.
 * Useful for the UI when an admin is editing a user's permissions.
 * 
 * @param role - The target role
 * @returns UserPermissions (structure showing enabled scopes and all possible actions)
 */
export function getAvailablePermissionsForRole(role: UserRole): UserPermissions {
  const allowed = ROLE_ALLOWED_PERMISSIONS[role] || {};
  const result: UserPermissions = {};

  (Object.keys(allowed) as PermissionScope[]).forEach(scope => {
    const allowedActions = allowed[scope];
    if (allowedActions) {
      result[scope] = {
        enabled: true, // This scope is available to be enabled
        actions: [...allowedActions]
      };
    }
  });

  return result;
}

/**
 * Validates a permission set against the role's constraints.
 * 
 * @param role - The user's role
 * @param permissions - The permissions to validate
 * @returns Object indicating validity and any errors
 */
export function validatePermissionsForRole(
  role: UserRole,
  permissions: UserPermissions
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const allowed = ROLE_ALLOWED_PERMISSIONS[role] || {};

  (Object.keys(permissions) as PermissionScope[]).forEach(scope => {
    const perm = permissions[scope];

    // Only check if enabled is true
    if (perm && perm.enabled) {
      const allowedActions = allowed[scope];

      // Check if scope is allowed
      if (!allowedActions) {
        errors.push(`Role '${role}' is not allowed to access scope '${scope}'`);
        return;
      }

      // Check if actions are allowed
      const invalidActions = perm.actions.filter(a => !allowedActions.includes(a));
      if (invalidActions.length > 0) {
        errors.push(
          `Role '${role}' cannot perform actions [${invalidActions.join(', ')}] on scope '${scope}'`
        );
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}
