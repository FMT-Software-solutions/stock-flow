import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import MultipleSelector, { type Option } from '@/components/ui/multiselect';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import type { UserRole } from '@/lib/auth';
import type { UserWithRelations } from '@/types/user-management';
import { useRoles } from '@/hooks/useRoleQueries';

interface Branch {
  id: string;
  name: string;
  is_active: boolean;
}

interface UserFormData {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  roleId?: string;
  permissions?: string;
  selectedBranchIds: string[];
  assignAllBranches?: boolean;
}

interface UserFormProps {
  mode: 'create' | 'edit';
  user?: UserWithRelations;
  onSubmit: (data: UserFormData) => void;
  onCancel: () => void;
  branches: Branch[];
  isLoading?: boolean;
}

export function UserForm({
  mode,
  user,
  onSubmit,
  onCancel,
  branches,
  isLoading = false,
}: UserFormProps) {
  const { canManageAllData, canManageUserData, isBranchAdmin } = useRoleCheck();
  const { roles } = useRoles();
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    firstName: '',
    lastName: '',
    role: 'read',
    roleId: '',
    permissions: '',
    selectedBranchIds: [],
    assignAllBranches: false,
  });

  useEffect(() => {
    if (mode === 'edit' && user) {
      const userBranchIds = user.user_branches?.map(ub => ub.branch_id).filter(Boolean) || [];
      const activeBranchIds = branches.filter(b => b.is_active).map(b => b.id);
      const hasAllBranches = activeBranchIds.length > 0 && 
        activeBranchIds.every(id => userBranchIds.includes(id));
      
      const userOrg = user.user_organizations?.[0];
      const userRole = userOrg?.role || 'read';
      const userRoleId = userOrg?.role_id;
      const userPermissions = userOrg?.permissions;
      
      setFormData({
        email: user.profile.email || '',
        firstName: user.profile.first_name || '',
        lastName: user.profile.last_name || '',
        role: userRole,
        roleId: userRoleId,
        permissions: userPermissions || undefined,
        selectedBranchIds: userBranchIds.filter((id): id is string => id !== null),
        assignAllBranches: hasAllBranches,
      });
    }
  }, [mode, user, branches]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that branches are selected for all roles except owner
    if (
      ['write', 'read', 'branch_admin', 'admin'].includes(formData.role) &&
      formData.selectedBranchIds.length === 0 &&
      !formData.assignAllBranches
    ) {
      return; // Form validation should handle this
    }

    onSubmit(formData);
  };

  const handleRoleChange = (roleId: string) => {
    const selectedRole = roles?.find(r => r.id === roleId);
    if (!selectedRole) return;

    setFormData((prev) => ({
      ...prev,
      role: selectedRole.type as UserRole,
      roleId: selectedRole.id,
      permissions: selectedRole.permissions,
      assignAllBranches: false,
      selectedBranchIds: prev.selectedBranchIds,
    }));
  };

  const requiresBranch = formData.role !== 'owner' && !formData.assignAllBranches;
  
  const canBeAssignedAllBranches = formData.role !== 'owner';
  
  const handleAssignAllBranchesChange = (checked: boolean) => {
    const activeBranchIds = branches.filter(b => b.is_active).map(b => b.id);
    setFormData(prev => ({
      ...prev,
      assignAllBranches: checked,
      selectedBranchIds: checked ? activeBranchIds : [],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className='space-y-1'>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, email: e.target.value }))
          }
          disabled={mode === 'edit'}
          required
          className={mode === 'edit' ? 'bg-muted' : ''}
        />
        {mode === 'edit' && (
          <p className="text-xs text-muted-foreground mt-1">
            Email cannot be changed
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className='space-y-1'>
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, firstName: e.target.value }))
            }
            required
          />
        </div>
        <div className='space-y-1'>
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, lastName: e.target.value }))
            }
            required
          />
        </div>
      </div>

      <div className='space-y-1'>
        <Label htmlFor="role">Role</Label>
        <Select key={`role-${formData.roleId}-${mode}`} value={formData.roleId} onValueChange={handleRoleChange}>
          <SelectTrigger className='w-62.5'>
            <SelectValue placeholder="Select Role" />
          </SelectTrigger>
          <SelectContent>
            {roles?.filter(role => {
               // Admins see all except owner
               if (role.type === 'owner') return false;

               if(isBranchAdmin() && (role.type === 'admin' || role.type === 'branch_admin')) return false;
               // Branch admins see write/read only
               if (!canManageAllData() && canManageUserData()) {
                 return ['custom'].includes(role.type);
               }
               return true;
            }).map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {canBeAssignedAllBranches && canManageAllData() && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-sm">
            <Checkbox
              id="assignAllBranches"
              checked={formData.assignAllBranches}
              onCheckedChange={handleAssignAllBranchesChange}
            />
            <Label htmlFor="assignAllBranches">
              Assign all branches
            </Label>
          </div>
          
         
        </div>
      )}
      
      {requiresBranch && (
        <div className='space-y-1'>
          <Label htmlFor="branches">
            Branches <span className="text-red-500">*</span>
          </Label>
          <MultipleSelector
            value={formData.selectedBranchIds.map(id => {
              const branch = branches.find(b => b.id === id);
              return { value: id, label: branch?.name || id };
            })}
            onChange={(options: Option[]) => {
              setFormData(prev => ({
                ...prev,
                selectedBranchIds: options.map(option => option.value)
              }));
            }}
            defaultOptions={branches
              .filter(branch => branch.is_active)
              .map(branch => ({
                value: branch.id,
                label: branch.name
              }))}
            placeholder="Select branches"
            emptyIndicator={<p className="text-center text-sm">No branches found</p>}
            className="w-full"
          />
        </div>
      )}

      <div className="flex space-x-2">
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading
            ? mode === 'create'
              ? 'Creating...'
              : 'Updating...'
            : mode === 'create'
            ? 'Create User'
            : 'Update User'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
