import { useEffect, useState } from 'react';
import { 
  APP_PERMISSIONS, 
  getAvailablePermissionsForRole,
  type PermissionAction,
  type PermissionScope,
  type UserPermissions
} from '@/modules/permissions';
import type { UserRole } from '@/lib/auth';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface UserPermissionsEditorProps {
  role?: UserRole;
  permissionsJson: string | null | undefined;
  rolePermissions?: UserPermissions; // Base permissions from the selected role
  onChange: (newPermissionsJson: string) => void;
  readOnly?: boolean;
  availablePermissions?: UserPermissions;
  hideTitleSection?: boolean;
  showResetButtons?: boolean;
}

export function UserPermissionsEditor({ 
  role, 
  permissionsJson,
  rolePermissions,
  onChange,
  readOnly = false,
  availablePermissions: providedAvailablePermissions,
  hideTitleSection = false,
  showResetButtons = true
}: UserPermissionsEditorProps) {
  const [permissions, setPermissions] = useState<UserPermissions>({});

  // Parse permissions when prop changes
  useEffect(() => {
    try {
      setPermissions(permissionsJson ? JSON.parse(permissionsJson) : {});
    } catch (e) {
      console.error('Failed to parse permissions JSON', e);
      setPermissions({});
    }
  }, [permissionsJson]);

  const availablePermissions = providedAvailablePermissions || (role ? getAvailablePermissionsForRole(role) : {});
  const scopes = Object.keys(availablePermissions) as PermissionScope[];
  const parentScopes = scopes.filter((s) => !APP_PERMISSIONS[s]?.parent);
  const childrenFor = (parent: PermissionScope) =>
    scopes.filter((s) => APP_PERMISSIONS[s]?.parent === parent);

  const handleResetScope = (scope: PermissionScope) => {
    if (readOnly) return;
    const next = { ...permissions };
    delete next[scope];
    childrenFor(scope).forEach((child) => {
      delete next[child];
    });
    updatePermissions(next);
  };

  const handleScopeToggle = (scope: PermissionScope, enabled: boolean) => {
    if (readOnly) return;
    
    const currentScope = permissions[scope] || { enabled: false, actions: [] };
    
    const newPermissions = {
      ...permissions,
      [scope]: {
        ...currentScope,
        enabled,
        // If enabling, keep existing actions or default to empty. 
        // If disabling, we keep actions but they won't be active because enabled is false.
        actions: currentScope.actions || [] 
      }
    };

    updatePermissions(newPermissions);
  };

  const handleActionToggle = (scope: PermissionScope, action: PermissionAction, checked: boolean) => {
    if (readOnly) return;

    const currentScope = permissions[scope];
    // Fallback to role actions if user actions are undefined
    const currentActions = currentScope 
      ? (currentScope.actions || []) 
      : (rolePermissions?.[scope]?.actions || []);
    
    let newActions: PermissionAction[];
    if (checked) {
      newActions = [...new Set([...currentActions, action])];
    } else {
      newActions = currentActions.filter(a => a !== action);
    }

    const newPermissions = {
      ...permissions,
      [scope]: {
        ...currentScope,
        // If rolePermissions controls enablement, ensure we preserve the user's enabled state 
        // or default to true if we are adding actions (since actions imply enablement)
        enabled: rolePermissions ? (permissions[scope]?.enabled ?? true) : (currentScope?.enabled ?? true),
        actions: newActions
      }
    };

    updatePermissions(newPermissions);
  };

  const updatePermissions = (newPermissions: UserPermissions) => {
    setPermissions(newPermissions);
    onChange(JSON.stringify(newPermissions));
  };

  if (scopes.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No configurable permissions available for this role ({role}).
      </div>
    );
  }

  return (
    <div className="space-y-4">
    <div className="flex items-center justify-between">
          {!hideTitleSection && <div>
          <h3 className="text-lg font-medium">Page Access & Permissions</h3>
          <p className="text-sm text-muted-foreground">
            Configure detailed access rights for this user.
          </p>
        </div>}
        {readOnly && <Badge variant="secondary">Read Only</Badge>}
      </div>

      <div className="grid gap-4">
        {parentScopes.map((scope) => {
          const config = APP_PERMISSIONS[scope]!;
          
          const userScope = permissions[scope];
          
          // Determine effective actions for display
          // If userScope is undefined (no override), use role actions
          const effectiveActions = userScope 
            ? (userScope.actions || []) 
            : (rolePermissions?.[scope]?.actions || []);

          const availableActions = availablePermissions[scope]?.actions || [];
          
          // If userScope is present (override), use it. Otherwise fall back to rolePermissions.
          const isEnabled = userScope
            ? (userScope.enabled || false)
            : (rolePermissions?.[scope]?.enabled || false);

          // Switch is only disabled if readOnly is true
          const isSwitchDisabled = readOnly;

          return (
            <Card key={scope} className={isEnabled ? 'border-primary/20' : 'opacity-75'}>
              <CardHeader className="px-4 py-2 ">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`scope-${scope}`}
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleScopeToggle(scope, checked)}
                      disabled={isSwitchDisabled}
                    />
                    <div className="flex flex-col">
                      <Label htmlFor={`scope-${scope}`} className="text-base font-semibold cursor-pointer">
                        {config.label}
                      </Label>
                      <span className="text-xs text-muted-foreground">{config.description}</span>
                    </div>
                  </div>
                  {!readOnly && showResetButtons && <Button
                    variant="link"
                    size="sm"
                    onClick={() => handleResetScope(scope)}
                    disabled={readOnly}
                    title='Reset scope to organization default'
                  >
                    Reset
                  </Button> }
                </div>
              </CardHeader>
              
              {isEnabled && availableActions.length > 0 && (
                <CardContent className="p-4 pt-2 pl-14">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {availableActions.map((action) => {
                      const actionLabel = config.actions[action] || action;
                      const hasAction = effectiveActions.includes(action);

                      return (
                        <div key={`${scope}-${action}`} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${scope}-${action}`}
                            checked={hasAction}
                            onCheckedChange={(checked) => 
                              handleActionToggle(scope, action, checked === true)
                            }
                            disabled={readOnly}
                          />
                          <Label 
                            htmlFor={`${scope}-${action}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {actionLabel}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
              {childrenFor(scope).length > 0 && (
                <CardContent className="p-4 pt-2 pl-14">
                  <div className="grid gap-3">
                    {childrenFor(scope).map((child) => {
                      const childConfig = APP_PERMISSIONS[child]!;
                      const childUserScope = permissions[child];
                      const childEffectiveActions = childUserScope 
                        ? (childUserScope.actions || []) 
                        : (rolePermissions?.[child]?.actions || []);
                      const childAvailableActions = availablePermissions[child]?.actions || [];
                      
                      const childEnabled = childUserScope
                        ? (childUserScope.enabled || false)
                        : (rolePermissions?.[child]?.enabled || false);

                      const childSwitchDisabled = readOnly || !isEnabled;

                      return (
                        <Card key={child} className={childEnabled && isEnabled ? 'border-primary/20' : 'opacity-75'}>
                          <CardHeader className="px-4 py-2 ">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id={`scope-${child}`}
                                  checked={childEnabled && isEnabled}
                                  onCheckedChange={(checked) => handleScopeToggle(child, checked)}
                                  disabled={childSwitchDisabled}
                                />
                                <div className="flex flex-col">
                                  <Label htmlFor={`scope-${child}`} className="text-sm font-semibold cursor-pointer">
                                    {childConfig.label}
                                  </Label>
                                  <span className="text-xs text-muted-foreground">{childConfig.description}</span>
                                </div>
                              </div>
                              {showResetButtons && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  onClick={() => handleResetScope(child)}
                                  disabled={readOnly || !isEnabled}
                                >
                                  Reset
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          {childEnabled && isEnabled && childAvailableActions.length > 0 && (
                            <CardContent className="p-4 pt-2 pl-14">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {childAvailableActions.map((action) => {
                                  const actionLabel = childConfig.actions[action] || action;
                                  const hasAction = childEffectiveActions.includes(action);
                                  return (
                                    <div key={`${child}-${action}`} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`${child}-${action}`}
                                        checked={hasAction}
                                        onCheckedChange={(checked) => 
                                          handleActionToggle(child, action, checked === true)
                                        }
                                        disabled={readOnly || !isEnabled}
                                      />
                                      <Label 
                                        htmlFor={`${child}-${action}`}
                                        className="text-sm font-normal cursor-pointer"
                                      >
                                        {actionLabel}
                                      </Label>
                                    </div>
                                  );
                                })}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
