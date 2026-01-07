import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadImageToCloudinary } from '@/utils/cloudinary';
import { useCreateInventoryEntry } from '@/hooks/useInventoryQueries';
import type { Product } from '@/types/inventory';
import type { GeneratedVariant } from '../components/ProductVariations';
import { useRoleCheck } from '@/components/auth/RoleGuard';

interface InventoryGeneratorProps {
  product: Product;
  availableVariants: GeneratedVariant[];
  selectedBranchIds: string[];
  currentOrganizationId: string;
  existingInventory: any[];
  onSuccess: () => void;
}

export function InventoryGenerator({
  product,
  availableVariants,
  selectedBranchIds,
  currentOrganizationId,
  existingInventory,
  onSuccess,
}: InventoryGeneratorProps) {
  const createInventory = useCreateInventoryEntry();
  const { checkPermission } = useRoleCheck();
  const canCreateInventory = checkPermission('inventory', 'create');
  const [newEntries, setNewEntries] = useState<
    {
      variantId?: string;
      quantity: number;
      minStockLevel: number;
      customLabel?: string;
      priceOverride?: number;
      imageUrl?: string;
    }[]
  >([]);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleToggleVariant = (variantId: string, checked: boolean) => {
    if (!canCreateInventory) return;
    if (checked) {
      setNewEntries((prev) => [
        ...prev,
        {
          variantId,
          quantity: 0,
          minStockLevel: 0,
          priceOverride: undefined,
          imageUrl: undefined,
        },
      ]);
    } else {
      setNewEntries((prev) => prev.filter((e) => e.variantId !== variantId));
    }
  };

  const handleEntryChange = (
    identifier: string,
    field:
      | 'quantity'
      | 'minStockLevel'
      | 'customLabel'
      | 'priceOverride'
      | 'imageUrl',
    value: any
  ) => {
    if (!canCreateInventory) return;
    setNewEntries((prev) =>
      prev.map((e) => {
        if (e.variantId === identifier) return { ...e, [field]: value };
        return e;
      })
    );
  };

  const handleImageUpload = async (identifier: string, file: File) => {
    if (!canCreateInventory) return;
    try {
      toast.info('Uploading image...');
      const url = await uploadImageToCloudinary(file);
      handleEntryChange(identifier, 'imageUrl', url);
      toast.success('Image uploaded.');
    } catch (error) {
      console.error('Image upload failed:', error);
      toast.error('Image upload failed');
    }
  };

  const triggerFileInput = (identifier: string) => {
    if (!canCreateInventory) return;
    if (fileInputRefs.current[identifier]) {
      fileInputRefs.current[identifier]?.click();
    }
  };

  const addCustomEntry = () => {
    if (!canCreateInventory) return;
    const tempId = `custom-${Date.now()}`;
    setNewEntries((prev) => [
      ...prev,
      {
        variantId: tempId,
        quantity: 0,
        minStockLevel: 0,
        customLabel: '',
        priceOverride: undefined,
        imageUrl: undefined,
      },
    ]);
  };

  const removeCustomEntry = (identifier: string) => {
    setNewEntries((prev) => prev.filter((e) => e.variantId !== identifier));
  };

  const handleSave = async () => {
    if (!canCreateInventory) {
      toast.error('You do not have permission to create inventory');
      return;
    }
    if (selectedBranchIds.length === 0 || newEntries.length === 0) return;

    // Validation: Quantity >= 1
    const invalidEntries = newEntries.filter((e) => e.quantity < 1);
    if (invalidEntries.length > 0) {
      toast.error('All inventory items must have a quantity of at least 1');
      return;
    }

    try {
      const promises: Promise<any>[] = [];

      for (const branchId of selectedBranchIds) {
        for (const entry of newEntries) {
          // Check if this variant already exists in this branch
          const exists = existingInventory.some(
            (inv) =>
              inv.branch_id === branchId && inv.variant_id === entry.variantId
          );

          if (exists && !entry.variantId?.startsWith('custom-')) continue;

          const isCustom = entry.variantId?.startsWith('custom-');

          // Price Logic: Use default if 0 or undefined
          const variant = availableVariants.find(
            (v) => v.id === entry.variantId
          );
          const defaultPrice = variant?.price ?? product.sellingPrice;
          const finalPrice =
            entry.priceOverride && entry.priceOverride > 0
              ? entry.priceOverride
              : defaultPrice;

          promises.push(
            createInventory.mutateAsync({
              productId: product.id,
              variantId: isCustom ? undefined : entry.variantId,
              branchId: branchId,
              quantity: entry.quantity,
              minStockLevel: entry.minStockLevel,
              organizationId: currentOrganizationId,
              customLabel: entry.customLabel,
              priceOverride: finalPrice,
              imageUrl: entry.imageUrl,
              type: isCustom ? 'custom' : 'variant',
            })
          );
        }
      }

      await Promise.all(promises);
      toast.success('Inventory generated successfully');
      setNewEntries([]);
      onSuccess();
    } catch (error) {
      console.error('Failed to generate inventory:', error);
      toast.error('Failed to generate inventory');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm text-muted-foreground">
          Generate New Inventory
        </h3>
        {availableVariants.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!canCreateInventory) return;
              if (newEntries.length === availableVariants.length) {
                setNewEntries([]);
              } else {
                setNewEntries(
                  availableVariants.map((v) => ({
                    variantId: v.id!,
                    quantity: 0,
                    minStockLevel: 0,
                  }))
                );
              }
            }}
            disabled={!canCreateInventory}
          >
            {newEntries.length === availableVariants.length
              ? 'Deselect All'
              : 'Select All'}
          </Button>
        )}
      </div>

      {availableVariants.length === 0 && newEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          All variants have inventory records in all selected branches. You can
          add custom inventory below.
        </p>
      ) : (
        <div className="rounded-md border">
          <div className="grid grid-cols-12 gap-4 p-3 text-xs font-medium border-b bg-muted/50">
            <div className="col-span-1"></div>
            <div className="col-span-4">Variant / Label</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-2 text-right">Min Stock</div>
            <div className="col-span-3 text-right">Price</div>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {/* Standard Variants */}
            {availableVariants.map((variant) => {
              const isSelected = newEntries.some(
                (e) => e.variantId === variant.id
              );
              const entry = newEntries.find((e) => e.variantId === variant.id);

              const fallbackPrice = variant.price ?? product.sellingPrice;

              return (
                <div
                  key={variant.id}
                  className={cn(
                    'grid grid-cols-12 gap-4 p-3 text-sm items-center border-b last:border-0 transition-colors',
                    isSelected && 'bg-muted/30'
                  )}
                >
                  <div className="col-span-1 flex justify-center">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleToggleVariant(variant.id!, !!checked)
                      }
                      disabled={!canCreateInventory}
                    />
                  </div>
                  <div className="col-span-4 flex items-center space-x-2">
                    <div
                      className="h-8 w-8 rounded-md bg-muted shrink-0 cursor-pointer overflow-hidden border relative group"
                      onClick={() =>
                        isSelected && canCreateInventory && triggerFileInput(variant.id!)
                      }
                    >
                      {entry?.imageUrl ? (
                        <img
                          src={entry.imageUrl}
                          alt="Var"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      {isSelected && canCreateInventory && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      ref={(el) => {
                        if (el && variant.id)
                          fileInputRefs.current[variant.id] = el;
                      }}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && variant.id)
                          handleImageUpload(variant.id, file);
                      }}
                      disabled={!isSelected || !canCreateInventory}
                    />
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(variant.attributes).map(
                        ([key, value]) => (
                          <Badge
                            key={key}
                            variant="outline"
                            className="text-[10px] px-1 py-0 h-5"
                          >
                            {key}: {String(value)}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      className="text-right h-8"
                      value={entry?.quantity || 0}
                      disabled={!isSelected || !canCreateInventory}
                      onChange={(e) =>
                        handleEntryChange(
                          variant.id!,
                          'quantity',
                          Number(e.target.value)
                        )
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      className="text-right h-8"
                      value={entry?.minStockLevel || 0}
                      disabled={!isSelected || !canCreateInventory}
                      onChange={(e) =>
                        handleEntryChange(
                          variant.id!,
                          'minStockLevel',
                          Number(e.target.value)
                        )
                      }
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      className="text-right h-8"
                      placeholder={`Default: ${fallbackPrice}`}
                      value={entry?.priceOverride ?? ''}
                      disabled={!isSelected || !canCreateInventory}
                      onChange={(e) =>
                        handleEntryChange(
                          variant.id!,
                          'priceOverride',
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                    />
                  </div>
                </div>
              );
            })}

            {/* Custom Entries */}
            {newEntries
              .filter((e) => e.variantId?.startsWith('custom-'))
              .map((entry) => (
                <div
                  key={entry.variantId}
                  className="grid grid-cols-12 gap-4 p-3 text-sm items-center border-b last:border-0 bg-blue-50/50"
                >
                <div className="col-span-1 flex justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-100"
                    onClick={() => removeCustomEntry(entry.variantId!)}
                    disabled={!canCreateInventory}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="col-span-4 flex items-center space-x-2">
                  <div
                    className="h-8 w-8 rounded-md bg-muted shrink-0 cursor-pointer overflow-hidden border relative group"
                    onClick={() => canCreateInventory && triggerFileInput(entry.variantId!)}
                  >
                    {entry.imageUrl ? (
                      <img
                        src={entry.imageUrl}
                        alt="Cust"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    {canCreateInventory && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={(el) => {
                      if (el && entry.variantId)
                        fileInputRefs.current[entry.variantId] = el;
                    }}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && entry.variantId)
                        handleImageUpload(entry.variantId, file);
                    }}
                    disabled={!canCreateInventory}
                  />
                  <Input
                    placeholder="Custom Label (e.g. Used, Damaged)"
                    className="h-8 text-xs flex-1"
                    value={entry.customLabel}
                    onChange={(e) =>
                      handleEntryChange(
                        entry.variantId!,
                        'customLabel',
                        e.target.value
                      )
                    }
                    disabled={!canCreateInventory}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    className="text-right h-8"
                    value={entry.quantity}
                    onChange={(e) =>
                      handleEntryChange(
                        entry.variantId!,
                        'quantity',
                        Number(e.target.value)
                      )
                    }
                    disabled={!canCreateInventory}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    className="text-right h-8"
                    value={entry.minStockLevel}
                    onChange={(e) =>
                      handleEntryChange(
                        entry.variantId!,
                        'minStockLevel',
                        Number(e.target.value)
                      )
                    }
                    disabled={!canCreateInventory}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    className="text-right h-8"
                    placeholder={`Default: ${product.sellingPrice}`}
                    value={entry.priceOverride ?? ''}
                    onChange={(e) =>
                      handleEntryChange(
                        entry.variantId!,
                        'priceOverride',
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    disabled={!canCreateInventory}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-2">
        <Button variant="outline" size="sm" onClick={addCustomEntry} disabled={!canCreateInventory}>
          <Plus className="mr-2 h-3 w-3" /> Add Custom Inventory
        </Button>

        {newEntries.length > 0 && (
          <Button onClick={handleSave} disabled={createInventory.isPending || !canCreateInventory}>
            {createInventory.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Generate Inventory for {selectedBranchIds.length} Branch
            {selectedBranchIds.length !== 1 ? 'es' : ''}
          </Button>
        )}
      </div>
    </div>
  );
}
