import { useState, useRef, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  X,
  Trash2,
  Image as ImageIcon,
  Plus,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadImageToCloudinary } from '@/utils/cloudinary';
import {
  useUpdateInventoryEntry,
  useDeleteInventoryEntry,
} from '@/hooks/useInventoryQueries';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { BulkUpdateInventorySheet } from './components/BulkUpdateInventorySheet';
import type { Product } from '@/types/inventory';
import type { GeneratedVariant } from '../components/ProductVariations';
import { useRoleCheck } from '@/components/auth/RoleGuard';

interface InventoryListProps {
  product: Product;
  variants: GeneratedVariant[];
  branchInventory: any[];
  availableBranches: any[];
  onRefresh: () => void;
}

export function InventoryList({
  product,
  variants,
  branchInventory,
  availableBranches,
  onRefresh,
}: InventoryListProps) {
  const updateInventory = useUpdateInventoryEntry();
  const deleteInventory = useDeleteInventoryEntry();
  const { checkPermission } = useRoleCheck();
  const canEditInventory = checkPermission('inventory', 'edit');
  const canDeleteInventory = checkPermission('inventory', 'delete');

  const [editingInventory, setEditingInventory] = useState<
    Record<
      string,
      {
        quantity: number;
        minStockLevel: number;
        customLabel?: string;
        priceOverride?: number;
        imageUrl?: string;
      }
    >
  >({});

  const [sortBy, setSortBy] = useState<'name' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleEditChange = (
    inventoryId: string,
    field:
      | 'quantity'
      | 'minStockLevel'
      | 'customLabel'
      | 'priceOverride'
      | 'imageUrl',
    value: any
  ) => {
    if (!canEditInventory) return;
    setEditingInventory((prev) => {
      const currentEdit = prev[inventoryId] || {};
      return {
        ...prev,
        [inventoryId]: {
          ...currentEdit,
          [field]: value,
        },
      };
    });
  };

  const ensureEditState = (inv: any) => {
    if (!canEditInventory) return;
    if (!editingInventory[inv.id]) {
      setEditingInventory((prev) => ({
        ...prev,
        [inv.id]: {
          quantity: inv.quantity,
          minStockLevel: inv.min_stock_level,
          customLabel: inv.custom_label,
          priceOverride: inv.price_override,
          imageUrl: inv.image_url,
        },
      }));
    }
  };

  const handleImageUpload = async (identifier: string, file: File) => {
    if (!canEditInventory) return;
    try {
      toast.info('Uploading image...');
      const url = await uploadImageToCloudinary(file);

      const inv = branchInventory.find((i) => i.id === identifier);
      if (inv && !editingInventory[identifier]) {
        setEditingInventory((prev) => ({
          ...prev,
          [identifier]: {
            quantity: inv.quantity,
            minStockLevel: inv.min_stock_level,
            customLabel: inv.custom_label,
            priceOverride: inv.price_override,
            imageUrl: url,
          },
        }));
      } else {
        handleEditChange(identifier, 'imageUrl', url);
      }

      toast.success('Image uploaded. Click Save to apply changes.');
    } catch (error) {
      console.error('Image upload failed:', error);
      toast.error('Image upload failed');
    }
  };

  const triggerFileInput = (identifier: string) => {
    if (!canEditInventory) return;
    if (fileInputRefs.current[identifier]) {
      fileInputRefs.current[identifier]?.click();
    }
  };

  const handleSaveEdits = async (inventoryId: string) => {
    if (!canEditInventory) return;
    const edits = editingInventory[inventoryId];
    if (!edits) return;

    try {
      await updateInventory.mutateAsync({
        id: inventoryId,
        ...edits,
      });
      toast.success('Inventory updated');
      setEditingInventory((prev) => {
        const newState = { ...prev };
        delete newState[inventoryId];
        return newState;
      });
      onRefresh();
    } catch (error) {
      console.error('Failed to update inventory:', error);
      toast.error('Failed to update inventory');
    }
  };

  const handleCancelEdit = (inventoryId: string) => {
    setEditingInventory((prev) => {
      const newState = { ...prev };
      delete newState[inventoryId];
      return newState;
    });
  };

  const handleDeleteInventory = async (inventoryId: string) => {
    if (!canDeleteInventory) return;
    if (confirm('Are you sure you want to delete this inventory item?')) {
      try {
        await deleteInventory.mutateAsync(inventoryId);
        toast.success('Inventory item deleted');
        onRefresh();
      } catch (error) {
        console.error('Failed to delete inventory:', error);
        toast.error('Failed to delete inventory item');
      }
    }
  };

  const groupedInventory = useMemo(() => {
    const groups: Record<string, any[]> = {};
    branchInventory.forEach((inv) => {
      const branchId = inv.branch_id || 'unknown';
      if (!groups[branchId]) groups[branchId] = [];
      groups[branchId].push(inv);
    });
    return groups;
  }, [branchInventory]);

  const sortedBranchIds = useMemo(() => {
    return Object.keys(groupedInventory).sort((a, b) => {
      const branchA = availableBranches.find((br) => br.id === a);
      const branchB = availableBranches.find((br) => br.id === b);

      if (!branchA && !branchB) return 0;
      if (!branchA) return 1;
      if (!branchB) return -1;

      if (sortBy === 'name') {
        return sortOrder === 'asc'
          ? branchA.name.localeCompare(branchB.name)
          : branchB.name.localeCompare(branchA.name);
      } else {
        const dateA = new Date(branchA.created_at || 0).getTime();
        const dateB = new Date(branchB.created_at || 0).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
    });
  }, [groupedInventory, availableBranches, sortBy, sortOrder]);

  const [collapsedBranches, setCollapsedBranches] = useState<
    Record<string, boolean>
  >({});
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize expansion state: expand the first branch by default
  useEffect(() => {
    if (!hasInitialized && sortedBranchIds.length > 0) {
      const initialCollapsed: Record<string, boolean> = {};
      sortedBranchIds.forEach((id, index) => {
        initialCollapsed[id] = index !== 0;
      });
      setCollapsedBranches(initialCollapsed);
      setHasInitialized(true);
    }
  }, [sortedBranchIds, hasInitialized]);

  const toggleSort = (field: 'name' | 'date') => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const toggleBranchCollapse = (branchId: string) => {
    setCollapsedBranches((prev) => ({
      ...prev,
      [branchId]: !prev[branchId],
    }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    sortedBranchIds.forEach((id) => {
      allExpanded[id] = false;
    });
    setCollapsedBranches(allExpanded);
  };

  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    sortedBranchIds.forEach((id) => {
      allCollapsed[id] = true;
    });
    setCollapsedBranches(allCollapsed);
  };

  if (branchInventory.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No inventory records found for selected branches.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
        <h3 className="font-medium text-sm text-muted-foreground">
          Inventory in Selected Branches
        </h3>
        <div className="flex items-center gap-1 flex-wrap">
          <BulkUpdateInventorySheet
            productId={product.id}
            onSuccess={onRefresh}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={expandAll}
          >
            <ChevronsDown className="h-3 w-3" />
            Expand All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={collapseAll}
          >
            <ChevronsUp className="h-3 w-3" />
            Collapse All
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                <ArrowUpDown className="h-3 w-3" />
                Sort by {sortBy === 'name' ? 'Name' : 'Date'} (
                {sortOrder === 'asc' ? 'Asc' : 'Desc'})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toggleSort('name')}>
                Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleSort('date')}>
                Date Created{' '}
                {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-3">
        {sortedBranchIds.map((branchId) => {
          const branch = availableBranches.find((b) => b.id === branchId);
          const items = groupedInventory[branchId];
          const isCollapsed = !!collapsedBranches[branchId];

          return (
            <Collapsible
              key={branchId}
              open={!isCollapsed}
              onOpenChange={() => toggleBranchCollapse(branchId)}
              className="rounded-md border overflow-hidden"
            >
              <div
                className={cn(
                  'bg-muted/50 p-2 font-medium text-sm flex justify-between items-center',
                  !isCollapsed ? 'border-b' : ''
                )}
              >
                <div className="flex items-center gap-2">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <span>{branch?.name || 'Unknown Branch'}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {items.length} items
                </span>
              </div>

              <CollapsibleContent>
                <div className="overflow-x-auto w-full max-w-[calc(100vw-4rem)] md:max-w-full">
                  <div className="min-w-150">
                    <div className="grid grid-cols-12 gap-4 p-2 text-xs font-medium border-b bg-muted/30 ">
                      <div className="col-span-1">Inv #</div>
                      <div className="col-span-4">Variant / Label</div>
                      <div className="col-span-2 text-right">Qty</div>
                      <div className="col-span-2 text-right">Min Stock</div>
                      <div className="col-span-2 text-right">Price</div>
                      <div className="col-span-1"></div>
                    </div>

                    <div className="max-h-75">
                      {items.map((inv) => {
                        const variant = variants.find(
                          (v) => v.id === inv.variant_id
                        );
                        const isEditing = !!editingInventory[inv.id];
                        const editValues = editingInventory[inv.id] || {};
                        const currentQty = isEditing
                          ? editValues.quantity
                          : inv.quantity;
                        const currentMin = isEditing
                          ? editValues.minStockLevel
                          : inv.min_stock_level;
                        const currentPrice = isEditing
                          ? editValues.priceOverride
                          : inv.price_override;
                        const currentLabel = isEditing
                          ? editValues.customLabel
                          : inv.custom_label;
                        const currentImage =
                          isEditing && editValues.imageUrl !== undefined
                            ? editValues.imageUrl
                            : inv.image_url || product.imageUrl;

                        let displayName = inv.productName || product.name;
                        if (inv.variant_id && variant) {
                          displayName = Object.entries(variant.attributes)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ');
                        } else if (inv.custom_label) {
                          displayName = inv.custom_label;
                        }

                        const fallbackPrice =
                          variant?.price ?? product.sellingPrice;

                        return (
                          <div
                            key={inv.id}
                            className="grid grid-cols-12 gap-4 p-3 text-sm items-center border-b last:border-0 hover:bg-muted/20"
                          >
                            <div className="col-span-1 text-xs font-mono text-muted-foreground flex items-center">
                              <div
                                className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors group/copy"
                                onClick={() => {
                                  if (inv.inventory_number) {
                                    navigator.clipboard.writeText(
                                      inv.inventory_number
                                    );
                                    toast.success('Copied to clipboard');
                                  }
                                }}
                                title="Click to copy"
                              >
                                {inv.inventory_number || '-'}
                                {inv.inventory_number && (
                                  <Copy className="h-3 w-3 opacity-0 group-hover/copy:opacity-100 transition-opacity" />
                                )}
                              </div>
                            </div>
                            <div className="col-span-4 flex items-center space-x-2">
                              <div
                                className="h-8 w-8 rounded-md bg-muted shrink-0 cursor-pointer overflow-hidden border relative group"
                                onClick={() => {
                                  if (canEditInventory)
                                    triggerFileInput(inv.id);
                                }}
                              >
                                {currentImage ? (
                                  <img
                                    src={currentImage}
                                    alt="Inv"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center">
                                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                                {canEditInventory && (
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Plus className="h-3 w-3 text-white" />
                                  </div>
                                )}
                              </div>
                              <input
                                type="file"
                                ref={(el) => {
                                  if (el) fileInputRefs.current[inv.id] = el;
                                }}
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(inv.id, file);
                                }}
                                disabled={!canEditInventory}
                              />

                              <div className="flex-1 min-w-0">
                                {!inv.variant_id ? (
                                  <Input
                                    className={cn(
                                      'h-8 text-xs',
                                      !isEditing &&
                                        'border-transparent bg-transparent shadow-none hover:bg-muted/50 focus:bg-background focus:border-input'
                                    )}
                                    value={currentLabel || ''}
                                    placeholder={product.name}
                                    onChange={(e) => {
                                      ensureEditState(inv);
                                      handleEditChange(
                                        inv.id,
                                        'customLabel',
                                        e.target.value
                                      );
                                    }}
                                    disabled={!canEditInventory}
                                  />
                                ) : (
                                  <div
                                    className="truncate font-medium"
                                    title={displayName}
                                  >
                                    {displayName}
                                    {inv.variant_id && (
                                      <Badge
                                        variant="outline"
                                        className="ml-2 text-[10px] h-4 px-1"
                                      >
                                        Variant
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="col-span-2">
                              <Input
                                type="number"
                                className={cn(
                                  'text-right h-8',
                                  !isEditing &&
                                    'border-transparent bg-transparent shadow-none hover:bg-muted/50 focus:bg-background focus:border-input'
                                )}
                                value={currentQty}
                                onChange={(e) => {
                                  ensureEditState(inv);
                                  handleEditChange(
                                    inv.id,
                                    'quantity',
                                    Number(e.target.value)
                                  );
                                }}
                                disabled={!canEditInventory}
                              />
                            </div>
                            <div className="col-span-2">
                              <Input
                                type="number"
                                className={cn(
                                  'text-right h-8',
                                  !isEditing &&
                                    'border-transparent bg-transparent shadow-none hover:bg-muted/50 focus:bg-background focus:border-input'
                                )}
                                value={currentMin}
                                onChange={(e) => {
                                  ensureEditState(inv);
                                  handleEditChange(
                                    inv.id,
                                    'minStockLevel',
                                    Number(e.target.value)
                                  );
                                }}
                                disabled={!canEditInventory}
                              />
                            </div>
                            <div className="col-span-2">
                              <Input
                                type="number"
                                className={cn(
                                  'text-right h-8',
                                  !isEditing &&
                                    'border-transparent bg-transparent shadow-none hover:bg-muted/50 focus:bg-background focus:border-input'
                                )}
                                placeholder={`${fallbackPrice}`}
                                value={currentPrice ?? ''}
                                onChange={(e) => {
                                  ensureEditState(inv);
                                  handleEditChange(
                                    inv.id,
                                    'priceOverride',
                                    e.target.value
                                      ? Number(e.target.value)
                                      : undefined
                                  );
                                }}
                                disabled={!canEditInventory}
                              />
                            </div>
                            <div className="col-span-1 flex justify-end gap-1">
                              {isEditing ? (
                                <>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 cursor-pointer"
                                    onClick={() => handleSaveEdits(inv.id)}
                                    disabled={!canEditInventory}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 text-gray-600 hover:text-gray-700 hover:bg-gray-50 cursor-pointer"
                                    onClick={() => handleCancelEdit(inv.id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                  onClick={() => handleDeleteInventory(inv.id)}
                                  disabled={!canDeleteInventory}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
