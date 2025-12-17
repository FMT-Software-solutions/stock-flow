import { useState } from 'react';
import { useBranchContext } from '@/contexts/BranchContext';
import { Label } from '@/components/ui/label';
import { BranchMultiSelector } from '@/components/shared/BranchMultiSelector';
import { Separator } from '@/components/ui/separator';
import { useProductInventory } from '@/hooks/useInventoryQueries';
import { InventoryList } from './InventoryList';
import { InventoryGenerator } from './InventoryGenerator';
import type { Product } from '@/types/inventory';
import type { GeneratedVariant } from '../components/ProductVariations';

interface ProductInventoryManagerProps {
  product: Product;
  variants: GeneratedVariant[];
  currentOrganizationId: string;
}

export function ProductInventoryManager({
  product,
  variants,
  currentOrganizationId,
}: ProductInventoryManagerProps) {
  const { availableBranches } = useBranchContext();
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);

  // Fetch existing inventory
  const {
    data: existingInventory = [],
    refetch: refetchInventory,
  } = useProductInventory(product.id);

  // Filter inventory for selected branches
  const branchInventory = existingInventory.filter((inv) =>
    selectedBranchIds.includes(inv.branch_id || '')
  );

  // Calculate available variants
  const availableVariants = variants.filter((v) => {
    // Check if this variant exists in ALL selected branches
    const branchesWithVariant = existingInventory
      .filter((inv) => inv.variant_id === v.id)
      .map((inv) => inv.branch_id);

    const allSelectedHaveIt =
      selectedBranchIds.length > 0 &&
      selectedBranchIds.every((id) => branchesWithVariant.includes(id));
    return !allSelectedHaveIt;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <div className="w-full space-y-2">
          <Label>Select Branches</Label>
          <BranchMultiSelector
            value={selectedBranchIds}
            onChange={setSelectedBranchIds}
            placeholder="Select branches to manage inventory"
          />
        </div>
      </div>

      {selectedBranchIds.length === 0 ? (
        <div className="text-center p-8 border rounded-md border-dashed text-muted-foreground">
          Select at least one branch to view and manage inventory.
        </div>
      ) : (
        <div className="space-y-6">
          <InventoryList
            product={product}
            variants={variants}
            branchInventory={branchInventory}
            availableBranches={availableBranches}
            onRefresh={refetchInventory}
          />

          <Separator />

          <InventoryGenerator
            product={product}
            availableVariants={availableVariants}
            selectedBranchIds={selectedBranchIds}
            currentOrganizationId={currentOrganizationId}
            existingInventory={existingInventory}
            onSuccess={refetchInventory}
          />
        </div>
      )}
    </div>
  );
}
