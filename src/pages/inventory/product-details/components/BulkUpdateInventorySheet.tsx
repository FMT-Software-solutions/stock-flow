import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useBulkUpdateInventoryEntries } from '@/hooks/useInventoryQueries';
import { useBranchContext } from '@/contexts/BranchContext';
import { Layers } from 'lucide-react';

interface BulkUpdateInventorySheetProps {
  productId: string;
  onSuccess?: () => void;
}

export function BulkUpdateInventorySheet({
  productId,
  onSuccess,
}: BulkUpdateInventorySheetProps) {
  const {
    availableBranches,
    selectedBranchIds: globalSelectedBranchIds,
  } = useBranchContext();

  // Filter available branches based on global selection
  const validBranches = useMemo(() => {
    return availableBranches.filter((b) =>
      globalSelectedBranchIds.includes(b.id)
    );
  }, [availableBranches, globalSelectedBranchIds]);

  const [open, setOpen] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);

  const [updatePrice, setUpdatePrice] = useState(false);
  const [price, setPrice] = useState<number | ''>('');

  const [updateQuantity, setUpdateQuantity] = useState(false);
  const [quantity, setQuantity] = useState<number | ''>('');

  const [updateMinStock, setUpdateMinStock] = useState(false);
  const [minStock, setMinStock] = useState<number | ''>('');

  const bulkUpdate = useBulkUpdateInventoryEntries();

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBranches(validBranches.map((b) => b.id));
    } else {
      setSelectedBranches([]);
    }
  };

  const handleBranchToggle = (branchId: string) => {
    setSelectedBranches((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId]
    );
  };

  const handleSubmit = async () => {
    if (selectedBranches.length === 0) {
      toast.error('Please select at least one branch');
      return;
    }

    if (!updatePrice && !updateQuantity && !updateMinStock) {
      toast.error('Please select at least one field to update');
      return;
    }

    const updates: any = {};
    if (updatePrice && price !== '') updates.priceOverride = Number(price);
    if (updateQuantity && quantity !== '') updates.quantity = Number(quantity);
    if (updateMinStock && minStock !== '')
      updates.minStockLevel = Number(minStock);

    if (Object.keys(updates).length === 0) {
      toast.error('Please enter values for selected fields');
      return;
    }

    try {
      await bulkUpdate.mutateAsync({
        productId,
        branchIds: selectedBranches,
        updates,
      });
      toast.success('Bulk update successful');
      setOpen(false);
      // Reset form
      setUpdatePrice(false);
      setPrice('');
      setUpdateQuantity(false);
      setQuantity('');
      setUpdateMinStock(false);
      setMinStock('');
      setSelectedBranches([]);
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error('Failed to perform bulk update');
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Layers className="mr-2 h-4 w-4" />
          Bulk Update
        </Button>
      </SheetTrigger>
      <SheetContent className="max-w-[400px] sm:max-w-[540px] p-4">
        <SheetHeader>
          <SheetTitle>Bulk Inventory Update</SheetTitle>
          <SheetDescription>
            Update price, quantity, or min stock for multiple branches at once.
            This will apply to all inventory in the selected branches.
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6 overflow-y-auto px-2">
          {/* Branch Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Select Branches</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={
                    selectedBranches.length === validBranches.length &&
                    validBranches.length > 0
                  }
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="text-sm font-normal">
                  Select All
                </Label>
              </div>
            </div>

            <ScrollArea className="h-[150px] w-full rounded-md border p-4">
              <div className="space-y-2">
                {validBranches.map((branch) => (
                  <div key={branch.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`branch-${branch.id}`}
                      checked={selectedBranches.includes(branch.id)}
                      onCheckedChange={() => handleBranchToggle(branch.id)}
                    />
                    <Label
                      htmlFor={`branch-${branch.id}`}
                      className="font-normal cursor-pointer"
                    >
                      {branch.name}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="text-xs text-muted-foreground">
              {selectedBranches.length} branches selected
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <Label className="text-base font-medium">Update Fields</Label>

            {/* Price */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="update-price"
                  checked={updatePrice}
                  onCheckedChange={(c) => setUpdatePrice(!!c)}
                />
                <Label htmlFor="update-price">Update Price Override</Label>
              </div>
              {updatePrice && (
                <Input
                  type="number"
                  placeholder="New Price"
                  value={price}
                  onChange={(e) =>
                    setPrice(e.target.value ? Number(e.target.value) : '')
                  }
                />
              )}
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="update-qty"
                  checked={updateQuantity}
                  onCheckedChange={(c) => setUpdateQuantity(!!c)}
                />
                <Label htmlFor="update-qty">Update Quantity</Label>
              </div>
              {updateQuantity && (
                <Input
                  type="number"
                  placeholder="New Quantity"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(e.target.value ? Number(e.target.value) : '')
                  }
                />
              )}
            </div>

            {/* Min Stock */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="update-min-stock"
                  checked={updateMinStock}
                  onCheckedChange={(c) => setUpdateMinStock(!!c)}
                />
                <Label htmlFor="update-min-stock">Update Min Stock Level</Label>
              </div>
              {updateMinStock && (
                <Input
                  type="number"
                  placeholder="New Min Stock Level"
                  value={minStock}
                  onChange={(e) =>
                    setMinStock(e.target.value ? Number(e.target.value) : '')
                  }
                />
              )}
            </div>
          </div>
        </div>

        <SheetFooter>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={bulkUpdate.isPending}>
              {bulkUpdate.isPending ? 'Updating...' : 'Apply Updates'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
