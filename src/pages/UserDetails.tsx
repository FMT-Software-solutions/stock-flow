import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser, useUserQueries } from '@/hooks/useUserQueries';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { type UserRole } from '@/lib/auth';
import { UserPermissionsEditor } from '@/components/user-management/UserPermissionsEditor';
import { APP_PERMISSIONS, buildUserPermissions, getAllPossiblePermissions, type UserPermissions, type PermissionScope } from '@/modules/permissions';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBranches } from '@/hooks/useBranchQueries';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import MultipleSelector, { type Option } from '@/components/ui/multiselect';
import { useRoles } from '@/hooks/useRoleQueries';

export default function UserDetails() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { checkPermission, isOwner: isCurrentUserOwner } = useRoleCheck();
  
  const { data: user, isLoading: isUserLoading, error } = useUser(userId);
  const { data: branches } = useBranches(currentOrganization?.id);
  const { roles } = useRoles();
  const { updateUser } = useUserQueries();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    role: 'read' as UserRole,
    roleId: '',
    permissions: '',
    selectedBranchIds: [] as string[],
    assignAllBranches: false
  });

  const [hasDetailsChanges, setHasDetailsChanges] = useState(false);
  const [hasPermissionsChanges, setHasPermissionsChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedRolePermissions, setSelectedRolePermissions] = useState<any>(null);

  useEffect(() => {
    if (user) {
      const userOrg = user.user_organizations?.[0];
      const userRole = (userOrg?.role || 'read') as UserRole;
      const userRoleId = userOrg?.role_id || '';
      const userPermissions = userOrg?.permissions;
      const userBranchIds = user.user_branches?.map(ub => ub.branch_id).filter(Boolean) as string[] || [];
      
      // Find the role definition to get base permissions
      let roleDef = roles?.find(r => r.id === userRoleId);
      
      // If role not found by ID, try type (for system roles)
      if (!roleDef) {
        roleDef = roles?.find(r => r.type === userRole && r.type !== 'custom');
      }

      const basePermissions = roleDef ? JSON.parse(roleDef.permissions) : buildUserPermissions(userRole);
      
      setSelectedRolePermissions(basePermissions);

      setFormData({
        firstName: user.profile.first_name || '',
        lastName: user.profile.last_name || '',
        role: userRole,
        roleId: roleDef ? roleDef.id : '', 
        // Use userPermissions directly (null/string). If null, editor shows inherited.
        permissions: userPermissions || '',
        selectedBranchIds: userBranchIds,
        assignAllBranches: false
      });
      setHasDetailsChanges(false);
      setHasPermissionsChanges(false);
    }
  }, [user, roles]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'permissions') {
      setHasPermissionsChanges(true);
    } else {
      setHasDetailsChanges(true);
    }
  };

  const handleRoleChange = (roleId: string) => {
    const selectedRole = roles?.find(r => r.id === roleId);
    if (!selectedRole) return;

    // Use permissions from the selected role definition
    const rolePermissions = JSON.parse(selectedRole.permissions);
    setSelectedRolePermissions(rolePermissions);

    setFormData(prev => ({ 
      ...prev, 
      role: selectedRole.type as UserRole, 
      roleId: selectedRole.id,
      permissions: '', // Reset to inherited
      assignAllBranches: selectedRole.type === 'owner' ? true : prev.assignAllBranches
    }));
    setHasDetailsChanges(true);
    setHasPermissionsChanges(true); // Marking permissions as changed because we reset them
  };

  const handleSaveDetails = async () => {
    if (!userId || !user) return;
    
    setIsSaving(true);
    try {
      await updateUser.mutateAsync({
        authUserId: userId,
        userData: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
          roleId: formData.roleId,
          branchIds: formData.selectedBranchIds,
          // Do NOT send permissions here
        }
      });
      
      toast.success('User details updated successfully');
      setHasDetailsChanges(false);
    } catch (error) {
      console.error('Failed to update user details', error);
      toast.error('Failed to update user details');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!userId || !user) return;
    
    setIsSaving(true);
    try {
      // Calculate sparse overrides
      let finalPermissions: string | null = null;
      
      if (formData.permissions) {
        const currentPerms = JSON.parse(formData.permissions);
        const sparsePerms: UserPermissions = {};
        let hasOverrides = false;

        Object.keys(currentPerms).forEach(key => {
          const scope = key as PermissionScope;
          const userScope = currentPerms[scope];
          const roleScope = selectedRolePermissions?.[scope];

          // Compare userScope with roleScope
          // We need to save if:
          // 1. Enabled state differs
          // 2. Actions differ
          // 3. Scope exists in user but not in role (unlikely given how editor works, but possible)
          
          if (!roleScope) {
             // If role doesn't have it, and user enabled it, save it.
             if (userScope?.enabled) {
               sparsePerms[scope] = userScope;
               hasOverrides = true;
             }
             return;
          }

          const enabledChanged = userScope.enabled !== roleScope.enabled;
          
          // Sort actions to compare arrays
          const userActions = [...(userScope.actions || [])].sort();
          const roleActions = [...(roleScope.actions || [])].sort();
          const actionsChanged = JSON.stringify(userActions) !== JSON.stringify(roleActions);

          if (enabledChanged || actionsChanged) {
            sparsePerms[scope] = userScope;
            hasOverrides = true;
          }
        });

        if (hasOverrides) {
          finalPermissions = JSON.stringify(sparsePerms);
        }
      }

      await updateUser.mutateAsync({
        authUserId: userId,
        userData: {
          // Only update permissions
          permissions: finalPermissions as string // Cast to match type, though null is valid for clearing
        }
      });
      
      toast.success('Permissions updated successfully');
      setHasPermissionsChanges(false);
      // Update local state to reflect that current permissions are now the saved overrides
      // Actually, we should reload or keep as is? 
      // If we saved sparse overrides, we should probably keep the full object in state 
      // so the editor doesn't jump, BUT the editor expects "permissionsJson" to be the overrides?
      // No, editor takes `permissionsJson` and `rolePermissions`.
      // If we pass sparse overrides to editor, it will merge them with rolePermissions for display.
      // So updating `formData.permissions` to `finalPermissions` is correct.
      setFormData(prev => ({ ...prev, permissions: finalPermissions || '' }));

    } catch (error) {
      console.error('Failed to update permissions', error);
      toast.error('Failed to update permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPermissions = async () => {
    if (!confirm('Are you sure you want to reset all permissions to the role defaults?')) return;
    
    setFormData(prev => ({ ...prev, permissions: '' }));
    setHasPermissionsChanges(true);
    // We could auto-save here or let user click save. 
    // "resetting of users overrides to organization role one" implies saving.
    // Let's just update state and let user save to be safe/consistent with "Save Permissions" button.
    // Or if the requirement implies an action: "add a reset roles button to allow resseting... this will clear the overrides"
    // I'll make it just update state for now, user hits Save.
  };

  if (isUserLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-destructive">Failed to load user details</p>
        <Button variant="outline" onClick={() => navigate('/user-management')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Users
        </Button>
      </div>
    );
  }

  const branchOptions: Option[] = (branches || [])
    .filter((b: any) => b.is_active)
    .map((b: any) => ({
      label: b.name,
      value: b.id,
    }));

  const canEdit = checkPermission('user_management', 'edit');
  
  const getVisiblePermissions = () => {
    const all = getAllPossiblePermissions();
    if (!selectedRolePermissions) return all;

    const visible: UserPermissions = {};
    Object.keys(selectedRolePermissions).forEach((key) => {
      const scope = key as keyof UserPermissions;
      // Only show permissions that are enabled in the role
      if (selectedRolePermissions[scope]?.enabled && all[scope]) {
        visible[scope] = all[scope];
      }
    });
    Object.keys(visible).forEach((key) => {
      const scope = key as keyof UserPermissions;
      const def = APP_PERMISSIONS[scope as unknown as PermissionScope];
      if (def?.parent) {
        const parentEnabled = !!selectedRolePermissions[def.parent as keyof UserPermissions]?.enabled;
        if (!parentEnabled) {
          delete visible[scope];
        }
      }
    });
    // If visible is empty (e.g. role has nothing enabled), we might want to return empty object
    // effectively showing nothing.
    return visible;
  };

  return (
    <div className="flex flex-col h-full space-y-6 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/user-management')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center space-x-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user.profile.avatar || undefined} />
              <AvatarFallback>
                {user.profile.first_name?.[0]}{user.profile.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {user.profile.first_name} {user.profile.last_name}
              </h1>
              <p className="text-sm text-muted-foreground">{user.profile.email}</p>
            </div>
          </div>
        </div>
        
        {canEdit && (
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              onClick={() => navigate('/user-management')}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveDetails} 
              disabled={!hasDetailsChanges || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - User Info & Role */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>User Details</CardTitle>
              <CardDescription>Basic information and role assignment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input 
                    id="firstName" 
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input 
                    id="lastName" 
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select 
                  value={formData.roleId} 
                  onValueChange={handleRoleChange}
                  disabled={!canEdit || (!isCurrentUserOwner() && formData.role === 'owner')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.filter(role => {
                        // Owners see all roles
                        // if (isCurrentUserOwner()) return true;
                        // Admins see all except owner
                        if (role.type === 'owner') return false;
                        return true;
                     }).map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Changing the role will reset permissions to defaults.
                </p>
              </div>

              {formData.role !== 'owner' && (
                <div className="space-y-2">
                  <Label>Assigned Branches</Label>
                  <MultipleSelector
                    value={branchOptions.filter((option) =>
                      formData.selectedBranchIds.includes(option.value)
                    )}
                    options={branchOptions}
                    onChange={(options) => {
                      handleInputChange(
                        'selectedBranchIds',
                        options.map((option) => option.value)
                      );
                    }}
                    placeholder="Select branches..."
                    emptyIndicator={
                      <p className="text-center text-sm text-gray-500">
                        No branches found.
                      </p>
                    }
                    disabled={!canEdit}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Permissions */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle>Page Access & Permissions</CardTitle>
                <CardDescription>
                  Configure detailed access rights. Uncheck to inherit from role.
                </CardDescription>
              </div>
              {canEdit && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetPermissions}
                    disabled={isSaving || !formData.permissions}
                  >
                    Reset to Defaults
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSavePermissions}
                    disabled={!hasPermissionsChanges || isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Permissions
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <UserPermissionsEditor 
                role={formData.role}
                permissionsJson={formData.permissions}
                rolePermissions={selectedRolePermissions}
                onChange={(newJson) => handleInputChange('permissions', newJson)}
                readOnly={!canEdit}
                availablePermissions={getVisiblePermissions()}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
