import React, { useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCreateVariationType } from '@/hooks/useVariationQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface VariationTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VariationTypeDialog({ open, onOpenChange }: VariationTypeDialogProps) {
  const { currentOrganization } = useOrganization();
  const createType = useCreateVariationType();
  const [newTypeName, setNewTypeName] = useState('');

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization) return;

    try {
      await createType.mutateAsync({
        name: newTypeName,
        organizationId: currentOrganization.id,
      });
      setNewTypeName('');
      onOpenChange(false);
      toast.success('Variation type created');
    } catch (error) {
      const err = error as any;
      // Supabase error for unique violation
      if (err.code === '23505') {
        toast.error('Variation type already exists');
      } else {
        toast.error('Failed to create variation type');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Variation Type</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreateType} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g. Color, Size, Material"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={createType.isPending}
          >
            {createType.isPending ? 'Creating...' : 'Create Type'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
