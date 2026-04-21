import { useRoleCheck } from '@/components/auth/RoleGuard';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { CreateDiscountSheet } from './inventory/components/CreateDiscountSheet';
import { DiscountManager } from './inventory/DiscountManager';

export function Discounts() {
  const { checkPermission, isOwner } = useRoleCheck();

  const [createDiscountOpen, setCreateDiscountOpen] = useState(false);

  const canViewDiscounts = checkPermission('discounts');
  const canCreateDiscount = checkPermission('discounts', 'create') || isOwner();

  if (!canViewDiscounts) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Discounts</h1>
          <p className="text-sm text-muted-foreground">
            Manage your discount rules and codes
          </p>
        </div>
        <div className="flex items-center gap-4">
          {canCreateDiscount && (
            <Button
              onClick={() => setCreateDiscountOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" /> Create Discount
            </Button>
          )}
        </div>
      </div>

      <CreateDiscountSheet
        open={createDiscountOpen}
        onOpenChange={setCreateDiscountOpen}
      />

      <DiscountManager />
    </div>
  );
}
