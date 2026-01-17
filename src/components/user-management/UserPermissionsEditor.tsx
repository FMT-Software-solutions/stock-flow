import { useEffect, useMemo, useState } from 'react';
import { 
  APP_PERMISSIONS, 
  getAvailablePermissionsForRole,
  type PermissionAction,
  type PermissionScope,
  type DataLookback,
  type UserPermissions
} from '@/modules/permissions';
import type { UserRole } from '@/lib/auth';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

  const navScopes = useMemo(() => {
    const result: PermissionScope[] = [];
    parentScopes.forEach((parent) => {
      result.push(parent);
      childrenFor(parent).forEach((child) => result.push(child));
    });
    scopes.forEach((s) => {
      if (!result.includes(s)) result.push(s);
    });
    return result;
  }, [parentScopes, scopes]);

  const [activeScope, setActiveScope] = useState<PermissionScope | undefined>(
    undefined
  );

  useEffect(() => {
    setActiveScope((prev) => {
      if (prev && navScopes.includes(prev)) return prev;
      if (navScopes.includes('dashboard')) return 'dashboard';
      return navScopes[0];
    });
  }, [navScopes]);

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

  const lookbackOptions: Array<{
    label: string;
    value: string;
    lookback?: DataLookback;
  }> = [
    { label: 'Default (Up to 1 Month)', value: 'default' },
    { label: 'Up to 1 Month', value: 'months:1', lookback: { unit: 'months', value: 1 } },
    { label: 'Up to 2 Months', value: 'months:2', lookback: { unit: 'months', value: 2 } },
    { label: 'Up to 3 Months', value: 'months:3', lookback: { unit: 'months', value: 3 } },
    { label: 'Up to 4 Months', value: 'months:4', lookback: { unit: 'months', value: 4 } },
    { label: 'Up to 6 Months', value: 'months:6', lookback: { unit: 'months', value: 6 } },
    { label: 'Up to 1 Year', value: 'years:1', lookback: { unit: 'years', value: 1 } },
    { label: 'Up to 2 Years', value: 'years:2', lookback: { unit: 'years', value: 2 } },
    { label: 'Forever', value: 'forever', lookback: { unit: 'forever' } },
  ];

  const serializeLookback = (lookback: DataLookback | undefined) => {
    if (!lookback) return 'default';
    if (lookback.unit === 'forever') return 'forever';
    return `${lookback.unit}:${lookback.value}`;
  };

  if (scopes.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No configurable permissions available for this role ({role}).
      </div>
    );
  }

  if (!activeScope) {
    return null;
  }

  const getScopeEnabled = (scope: PermissionScope) => {
    const userScope = permissions[scope];
    return userScope
      ? (userScope.enabled || false)
      : (rolePermissions?.[scope]?.enabled || false);
  };

  const getScopeActions = (scope: PermissionScope) => {
    const userScope = permissions[scope];
    return userScope
      ? (userScope.actions || [])
      : (rolePermissions?.[scope]?.actions || []);
  };

  const getScopeLookback = (scope: PermissionScope) => {
    const userScope = permissions[scope];
    return userScope?.dataAccess?.maxLookback ?? rolePermissions?.[scope]?.dataAccess?.maxLookback;
  };

  const activeConfig = APP_PERMISSIONS[activeScope]!;
  const activeParent = activeConfig.parent;
  const parentEnabled = activeParent ? getScopeEnabled(activeParent) : true;

  const activeIsEnabledRaw = getScopeEnabled(activeScope);
  const activeIsEnabled = activeParent ? activeIsEnabledRaw && parentEnabled : activeIsEnabledRaw;

  const activeAvailableActions = availablePermissions[activeScope]?.actions || [];
  const activeEffectiveActions = getScopeActions(activeScope);

  const activeLookback =
    activeScope === 'dashboard' ||
    activeScope === 'orders' ||
    activeScope === 'expenses'
      ? getScopeLookback(activeScope)
      : undefined;

  const isSwitchDisabled = readOnly || (activeParent ? !parentEnabled : false);
  const isResetDisabled = readOnly || (activeParent ? !parentEnabled : false);

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

      <div className="grid gap-4 md:grid-cols-[15rem_1fr]">
        <Card className="h-fit">
          <CardHeader className="px-3">
            <div className="text-sm font-medium text-primary">Pages</div>
          </CardHeader>
          <CardContent className="px-2">
            <div className="space-y-1 max-h-87.5 overflow-y-auto">
              {navScopes.map((scope) => {
                const config = APP_PERMISSIONS[scope]!;
                const isChild = !!config.parent;
                const isActive = scope === activeScope;

                return (
                  <Button
                    key={scope}
                    type="button"
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={`w-full justify-start ${isChild ? 'pl-8' : ''}`}
                    onClick={() => setActiveScope(scope)}
                  >
                    {config.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className={activeIsEnabled ? 'border-primary/20' : 'opacity-90'}>
          <CardHeader className="px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <Switch
                    id={`scope-${activeScope}`}
                    checked={activeIsEnabled}
                    onCheckedChange={(checked) =>
                      handleScopeToggle(activeScope, checked)
                    }
                    disabled={isSwitchDisabled}
                  />
                  <Label
                    htmlFor={`scope-${activeScope}`}
                    className="text-base font-semibold cursor-pointer"
                  >
                    {activeConfig.label}
                  </Label>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {activeConfig.description}
                </div>
                {activeParent && !parentEnabled && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Enable {APP_PERMISSIONS[activeParent]?.label ?? activeParent}{' '}
                    to manage this page.
                  </div>
                )}
              </div>

              {!readOnly && showResetButtons && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => handleResetScope(activeScope)}
                  disabled={isResetDisabled}
                  title="Reset scope to organization default"
                >
                  Reset
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-5">
            {(activeScope === 'dashboard' ||
              activeScope === 'orders' ||
              activeScope === 'expenses') &&
              activeIsEnabled && (
                <div className="grid gap-2 max-w-sm">
                  <Label className="text-sm font-medium">
                    {activeScope === 'dashboard'
                      ? 'Dashboard Data Duration'
                      : activeScope === 'orders'
                        ? 'Sales & Orders Data Duration'
                        : 'Expenses Data Duration'}
                  </Label>
                  <Select
                    value={serializeLookback(activeLookback)}
                    onValueChange={(value) => {
                      if (readOnly) return;
                      const scopeKey = activeScope;
                      const currentScope = permissions[scopeKey] || {
                        enabled: true,
                        actions: activeEffectiveActions,
                      };

                      if (value === 'default') {
                        const next: UserPermissions = { ...permissions };
                        const existing = next[scopeKey];
                        if (existing) {
                          const { dataAccess, ...rest } = existing;
                          next[scopeKey] = rest;
                        }
                        updatePermissions(next);
                        return;
                      }

                      const selected = lookbackOptions.find(
                        (o) => o.value === value
                      )?.lookback;

                      if (!selected) return;
                      updatePermissions({
                        ...permissions,
                        [scopeKey]: {
                          ...currentScope,
                          enabled: true,
                          actions: currentScope.actions || [],
                          dataAccess: { maxLookback: selected },
                        },
                      });
                    }}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      {lookbackOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

            {activeIsEnabled && activeAvailableActions.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-medium">Actions</div>
                <div className="space-y-2">
                  {activeAvailableActions.map((action) => {
                    const actionLabel = activeConfig.actions[action] || action;
                    const hasAction = activeEffectiveActions.includes(action);

                    return (
                      <div
                        key={`${activeScope}-${action}`}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`${activeScope}-${action}`}
                          checked={hasAction}
                          onCheckedChange={(checked) =>
                            handleActionToggle(
                              activeScope,
                              action,
                              checked === true
                            )
                          }
                          disabled={readOnly}
                        />
                        <Label
                          htmlFor={`${activeScope}-${action}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {actionLabel}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!activeIsEnabled && (
              <div className="text-sm text-muted-foreground">
                Enable this page to configure actions.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
