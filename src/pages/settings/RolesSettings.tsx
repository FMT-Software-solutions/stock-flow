import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPermissionsEditor } from '@/components/user-management/UserPermissionsEditor';
import { useRoles } from '@/hooks/useRoleQueries';
import { getAllPossiblePermissions } from '@/modules/permissions';
import type { OrganizationRoleEntity } from '@/types/organizations';
import { Loader2, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function RolesSettings() {
  const { roles, isLoading, createRole, updateRole, deleteRole } = useRoles();
  const [editingRole, setEditingRole] = useState<OrganizationRoleEntity | null>(
    null
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [
    roleToDelete,
    setRoleToDelete,
  ] = useState<OrganizationRoleEntity | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: '{}',
  });

  const handleOpenCreate = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      permissions: '{}',
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (role: OrganizationRoleEntity) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Role name is required');
      return;
    }

    try {
      if (editingRole) {
        await updateRole.mutateAsync({
          id: editingRole.id,
          name: formData.name,
          description: formData.description,
          permissions: formData.permissions,
        });
      } else {
        await createRole.mutateAsync({
          name: formData.name,
          description: formData.description,
          permissions: formData.permissions,
          type: 'custom',
        });
      }
      setIsDialogOpen(false);
    } catch (e) {
      // handled by mutation
    }
  };

  const handleDelete = async () => {
    if (roleToDelete) {
      await deleteRole.mutateAsync(roleToDelete.id);
      setRoleToDelete(null);
    }
  };

  const allPossiblePermissions = getAllPossiblePermissions();

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium">Roles & Permissions</h2>
          <p className="text-sm text-muted-foreground">
            Manage roles and their access levels within your organization.
          </p>
        </div>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Create New Role
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles
          ?.sort(
            (a, b) =>
              (a.type === 'custom' ? 1 : 0) - (b.type === 'custom' ? 1 : 0)
          )
          .map((role) => (
            <Card key={role.id} className="relative overflow-hidden">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {role.name}
                      {role.type !== 'custom' && (
                        <Badge
                          variant="secondary"
                          className="text-xs font-normal"
                        >
                          System
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 min-h-5">
                      {role.description || ''}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-xs text-muted-foreground">
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    Access Configured
                  </div>
                  <div className="flex gap-1">
                    {role.type !== 'owner' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenEdit(role)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {role.type === 'custom' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setRoleToDelete(role)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole
                ? editingRole.type === 'owner'
                  ? 'View Role'
                  : 'Edit Role'
                : 'Create New Role'}
            </DialogTitle>
            <DialogDescription>
              Define the name and permissions for this role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roleName">Role Name</Label>
                <Input
                  id="roleName"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Shift Manager"
                  disabled={
                    editingRole?.type === 'owner' ||
                    editingRole?.type === 'admin' ||
                    editingRole?.type === 'branch_admin'
                  }
                />
                {editingRole?.type !== 'custom' && (
                  <p className="text-xs text-muted-foreground">
                    System role names cannot be changed.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="roleDesc">Description</Label>
                <Input
                  id="roleDesc"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Description of the role's responsibilities"
                  disabled={editingRole?.type === 'owner'}
                />
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-muted/20">
              <UserPermissionsEditor
                permissionsJson={formData.permissions}
                onChange={(json) =>
                  setFormData((prev) => ({ ...prev, permissions: json }))
                }
                availablePermissions={allPossiblePermissions}
                readOnly={editingRole?.type === 'owner'}
                showResetButtons={false}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {editingRole?.type === 'owner' ? 'Close' : 'Cancel'}
            </Button>
            {editingRole?.type !== 'owner' && (
              <Button onClick={handleSave}>Save Role</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!roleToDelete}
        onOpenChange={(open) => !open && setRoleToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              role "{roleToDelete?.name}". Users assigned to this role may lose
              access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
