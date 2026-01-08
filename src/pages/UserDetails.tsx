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
import { APP_PERMISSIONS, getAllPossiblePermissions, getAvailablePermissionsForRole, type UserPermissions, type PermissionScope, type PermissionAction } from '@/modules/permissions';
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
  const [baselineOverrides, setBaselineOverrides] = useState<UserPermissions>({});

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

      const basePermissions = roleDef ? JSON.parse(roleDef.permissions) : getAvailablePermissionsForRole(userRole);
      
      setSelectedRolePermissions(basePermissions);
      setBaselineOverrides(userPermissions ? JSON.parse(userPermissions) : {});

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

  const normalizeSparseOverrides = (currentPerms: UserPermissions, rolePerms: UserPermissions): UserPermissions => {
    const sparse: UserPermissions = {};
    (Object.keys(currentPerms) as PermissionScope[]).forEach((key) => {
      const userScope = currentPerms[key];
      const roleScope = rolePerms?.[key];
      if (!userScope) return;
      if (!roleScope) {
        if (userScope.enabled) {
          const userActions = [...(userScope.actions || [])].sort() as PermissionAction[];
          sparse[key] = { enabled: userScope.enabled, actions: userActions };
        }
        return;
      }
      const enabledChanged = userScope.enabled !== roleScope.enabled;
      const userActions = [...(userScope.actions || [])].sort();
      const roleActions = [...(roleScope.actions || [])].sort();
      const actionsChanged = JSON.stringify(userActions) !== JSON.stringify(roleActions);
      if (enabledChanged || actionsChanged) {
        sparse[key] = { enabled: userScope.enabled, actions: userActions as PermissionAction[] };
      }
    });
    return sparse;
  };

  const equalOverrides = (a: UserPermissions, b: UserPermissions): boolean => {
    const aKeys = Object.keys(a) as PermissionScope[];
    const bKeys = Object.keys(b) as PermissionScope[];
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      const aScope = a[key];
      const bScope = b[key];
      if (!bScope || !aScope) return false;
      if (!!aScope.enabled !== !!bScope.enabled) return false;
      const aActs = [...(aScope.actions || [])].sort();
      const bActs = [...(bScope.actions || [])].sort();
      if (JSON.stringify(aActs) !== JSON.stringify(bActs)) return false;
    }
    return true;
  };

  const handleInputChange = (field: string, value: any) => {
    if (field === 'permissions') {
      try {
        const raw = value ? JSON.parse(value) : {};
        const normalized = normalizeSparseOverrides(raw, selectedRolePermissions || {});
        const hasChanges = !equalOverrides(normalized, baselineOverrides);
        setFormData(prev => ({ 
          ...prev, 
          permissions: Object.keys(normalized).length ? JSON.stringify(normalized) : '' 
        }));
        setHasPermissionsChanges(hasChanges);
      } catch {
        setFormData(prev => ({ ...prev, permissions: value }));
        setHasPermissionsChanges(true);
      }
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
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
    setBaselineOverrides({});
    setHasPermissionsChanges(false);
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
      let finalPermissions: string | null = null;
      const currentPerms = formData.permissions ? JSON.parse(formData.permissions) : {};
      const sparse = normalizeSparseOverrides(currentPerms, selectedRolePermissions || {});
      if (Object.keys(sparse).length > 0) {
        finalPermissions = JSON.stringify(sparse);
      }

      await updateUser.mutateAsync({
        authUserId: userId,
        userData: {
          // Only update permissions
          permissions: finalPermissions as string // Cast to match type, though null is valid for clearing
        }
      });
      
      toast.success('Permissions updated successfully');
      setBaselineOverrides(sparse);
      setHasPermissionsChanges(false);
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

              {canEdit && (
                <div className="flex items-center justify-end space-x-2">
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
                        Update Details
                      </>
                    )}
                  </Button>
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
                <CardTitle>User Page Access & Permissions</CardTitle>
                <CardDescription>
                  Configure access rights for selected user.
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
              <div className='max-h-125 overflow-auto'>
              <UserPermissionsEditor 
                role={formData.role}
                permissionsJson={formData.permissions}
                rolePermissions={selectedRolePermissions}
                onChange={(newJson) => handleInputChange('permissions', newJson)}
                readOnly={!canEdit}
                availablePermissions={getVisiblePermissions()}
                hideTitleSection={true}
              />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
