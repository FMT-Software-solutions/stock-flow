import React, { useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useVariationTypes,
  useVariationOptions,
  useDeleteVariationType,
  useCreateVariationOption,
  useDeleteVariationOption,
} from '@/hooks/useVariationQueries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { VariationType } from '@/types/inventory';
import { useRoleCheck } from '@/components/auth/RoleGuard';

export function Variations() {
  const { currentOrganization } = useOrganization();
  const { data: variationTypes, isLoading } = useVariationTypes(
    currentOrganization?.id
  );
  const deleteType = useDeleteVariationType();
  const { checkPermission } = useRoleCheck();
  const canDeleteType = checkPermission('variations', 'delete');

  const handleDeleteType = async (id: string) => {
    if (!confirm('Are you sure? This will delete all options for this type.'))
      return;
    try {
      await deleteType.mutateAsync(id);
      toast.success('Variation type deleted');
    } catch (error) {
      toast.error('Failed to delete variation type');
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {variationTypes?.map((type) => (
          <VariationCard
            key={type.id}
            type={type}
            organizationId={currentOrganization?.id}
            onDelete={() => handleDeleteType(type.id)}
            canDeleteType={canDeleteType}
          />
        ))}
      </div>
    </div>
  );
}

function VariationCard({
  type,
  organizationId,
  onDelete,
  canDeleteType,
}: {
  type: VariationType;
  organizationId?: string;
  onDelete: () => void;
  canDeleteType: boolean;
}) {
  const { data: options, isLoading } = useVariationOptions(
    type.id,
    organizationId
  );
  const createOption = useCreateVariationOption();
  const deleteOption = useDeleteVariationOption();
  const [newOptionValue, setNewOptionValue] = useState('');
  const { checkPermission } = useRoleCheck();
  const canDeleteOption = checkPermission('variations', 'delete');
  const canCreateOption = checkPermission('variations', 'create');

  const handleAddOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !newOptionValue.trim()) return;

    try {
      await createOption.mutateAsync({
        variationTypeId: type.id,
        value: newOptionValue.trim(),
        organizationId: organizationId,
      });
      setNewOptionValue('');
      toast.success('Option added');
    } catch (error) {
      const err = error as any;
      if (err.code === '23505') {
        toast.error('Option already exists');
      } else {
        toast.error('Failed to add option');
      }
    }
  };

  const handleDeleteOption = async (id: string) => {
    try {
      await deleteOption.mutateAsync(id);
      toast.success('Option deleted');
    } catch (error) {
      toast.error('Failed to delete option');
    }
  };

  const isSystemDefault = !type.organizationId;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">
          {type.name}
          {isSystemDefault && (
            <Badge variant="outline" className="ml-2 text-xs font-normal">
              System
            </Badge>
          )}
        </CardTitle>
        {!isSystemDefault && canDeleteType && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="text-destructive hover:text-destructive/90"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">
              Loading options...
            </div>
          ) : options?.length === 0 ? (
            <div className="text-sm text-muted-foreground">No options yet.</div>
          ) : (
            options?.map((option) => {
              const isOptionSystem = !option.organizationId;
              return (
                <Badge
                  key={option.id}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {option.value}
                  {!isOptionSystem && canDeleteOption && (
                    <button
                      onClick={() => handleDeleteOption(option.id)}
                      className="ml-1 rounded-full hover:bg-muted p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              );
            })
          )}
        </div>
        {!isSystemDefault && canCreateOption && (
          <form onSubmit={handleAddOption} className="flex gap-2">
            <Input
              placeholder="Add option..."
              value={newOptionValue}
              onChange={(e) => setNewOptionValue(e.target.value)}
              className="h-8"
            />
            <Button
              type="submit"
              size="sm"
              className="h-8"
              disabled={createOption.isPending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
