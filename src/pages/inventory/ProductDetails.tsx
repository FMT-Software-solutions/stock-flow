import { useParams, useNavigate } from 'react-router-dom';
import { useProduct, useUpdateProduct } from '@/hooks/useInventoryQueries';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Edit, Loader2, Plus, Trash2, Image as ImageIcon, Check, X } from 'lucide-react';
import { uploadImageToCloudinary } from '@/utils/cloudinary';
import { useRef } from 'react';
import { useUpdateInventoryEntry } from '@/hooks/useInventoryQueries';
import { ProductVariations, type GeneratedVariant } from './components/ProductVariations';
import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { useProductInventory, useCreateInventoryEntry, useDeleteInventoryEntry } from '@/hooks/useInventoryQueries';
import { useBranchContext } from '@/contexts/BranchContext';
import { Separator } from '@/components/ui/separator';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';

export function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { data: product, isLoading } = useProduct(id);
  const updateProduct = useUpdateProduct();

  const [hasVariations, setHasVariations] = useState(false);
  const [variants, setVariants] = useState<GeneratedVariant[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (product) {
      setHasVariations(!!product.hasVariations);
      setSelectedImage(product.imageUrl);
      if (product.variants) {
        // Map product variants to GeneratedVariant type if needed
        const mappedVariants: GeneratedVariant[] = product.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          price: v.price,
          quantity: v.quantity || 0,
          attributes: v.attributes,
        }));
        setVariants(mappedVariants);
      }
    }
  }, [product]);

  const handleSaveVariations = async () => {
    if (!product || !currentOrganization) return;
    
    if (hasVariations && variants.length === 0) {
      toast.error('Please configure at least one variation or disable variations');
      return;
    }

    try {
      setIsSaving(true);
      await updateProduct.mutateAsync({
        id: product.id,
        updates: {
          hasVariations,
          variants: hasVariations ? variants as any : [], // Cast to any to match expected input if types are slightly off
          organizationId: currentOrganization.id,
        },
      });
      toast.success('Variations updated successfully');
    } catch (error) {
      console.error('Failed to update variations:', error);
      toast.error('Failed to update variations');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!product) {
    return <div className="p-8 text-center">Product not found</div>;
  }

  const allImages = [product.imageUrl, ...(product.additionalImages || [])].filter(Boolean) as string[];

  const projectedProfit = product.sellingPrice - product.costPrice;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/inventory')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-muted-foreground">{product.sku}</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(`/inventory/${product.id}/edit`)}
        >
          <Edit className="mr-2 h-4 w-4" /> Edit Product
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Product Details */}
        <div className="space-y-6 md:col-span-1">
          <Card>
            <CardHeader >
              <div className='flex justify-between items-center'>
              <CardTitle>Details</CardTitle>
              <Badge variant={product.status === 'published' ? 'default' : 'secondary'}>
                {product.status}
              </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="aspect-square w-full overflow-hidden rounded-lg border bg-muted">
                  {selectedImage ? (
                    <img
                      src={selectedImage}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      No Image
                    </div>
                  )}
                </div>
                {allImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {allImages.map((img, idx) => (
                      <button
                        key={idx}
                        className={cn(
                          "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border",
                          selectedImage === img && "ring-2 ring-primary"
                        )}
                        onClick={() => setSelectedImage(img)}
                      >
                        <img
                          src={img}
                          alt={`Thumbnail ${idx}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-medium text-muted-foreground">Price</div>
                <div className='font-bold'><CurrencyDisplay amount={product.sellingPrice} /></div>
                
                <div className="font-medium text-muted-foreground">Cost</div>
                <div className='font-bold'><CurrencyDisplay amount={product.costPrice} /></div>

                <div className="font-medium text-muted-foreground">Projected Profit</div>
                <div className='font-bold'><CurrencyDisplay className={cn( projectedProfit > 0 ? 'text-primary' : 'text-red-500')} amount={projectedProfit} /></div>
              </div>
              
                <Separator />

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-medium text-muted-foreground">Category</div>
                <div>{product.category?.name || '-'}</div>

                <div className="font-medium text-muted-foreground">Supplier</div>
                <div>{product.supplier?.name || '-'}</div>
              </div>
             

              {product.description && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {product.description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Variations & Inventory */}
        <div className="space-y-6 md:col-span-2">
          <Tabs defaultValue="inventory" className="space-y-4">
            <TabsList>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="variants">Variants</TabsTrigger>
            </TabsList>

            <TabsContent value="variants" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Variant Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="has-variations"
                      checked={hasVariations}
                      onCheckedChange={setHasVariations}
                    />
                    <Label htmlFor="has-variations">This product has variations</Label>
                  </div>

                  {hasVariations ? (
                    <>
                      <ProductVariations
                        basePrice={product.sellingPrice}
                        baseSku={product.sku}
                        onChange={setVariants}
                        initialVariants={variants}
                      />
                      <div className="flex justify-end">
                        <Button 
                          onClick={handleSaveVariations} 
                          disabled={isSaving || updateProduct.isPending}
                        >
                          {(isSaving || updateProduct.isPending) && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Save Variations
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
                      Variations are disabled for this product. 
                      <br />
                      Enable them to configure attributes like Color, Size, etc.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Inventory Management</CardTitle>
                  <CardDescription>
                    Manage stock levels for each branch.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                   <ProductInventoryList 
                      product={product}
                      variants={variants} 
                      currentOrganizationId={currentOrganization?.id || ''}
                   />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

import MultipleSelector, { type Option } from '@/components/ui/multiselect';
import type { Product } from '@/types/inventory';

function ProductInventoryList({
  product,
  variants,
  currentOrganizationId,
}: {
  product: Product;
  variants: GeneratedVariant[];
  currentOrganizationId: string;
}) {
  const { availableBranches, selectedBranchIds: globalSelectedBranchIds } = useBranchContext();
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const createInventory = useCreateInventoryEntry();
  const updateInventory = useUpdateInventoryEntry();
  const deleteInventory = useDeleteInventoryEntry();
  
  // Calculate valid branches based on global selection
  const validBranches = useMemo(() => {
    const hasSingleGlobalSelection = globalSelectedBranchIds.length === 1;
    return hasSingleGlobalSelection
      ? availableBranches.filter((b) => globalSelectedBranchIds.includes(b.id))
      : availableBranches;
  }, [availableBranches, globalSelectedBranchIds]);

  // Convert to options for MultiSelector
  const branchOptions: Option[] = useMemo(() => 
    validBranches.map(b => ({ value: b.id, label: b.name })),
    [validBranches]
  );

  // Auto-select valid branches if current selection is invalid or empty
  useEffect(() => {
    if (validBranches.length > 0) {
       // If no local selection yet, sync with global or select all valid
       if (selectedBranchIds.length === 0) {
          setSelectedBranchIds(validBranches.map(b => b.id));
       } else {
          // Filter out any selected IDs that are no longer valid
          const validIds = validBranches.map(b => b.id);
          const newSelection = selectedBranchIds.filter(id => validIds.includes(id));
          if (newSelection.length !== selectedBranchIds.length) {
             setSelectedBranchIds(newSelection);
          }
       }
    }
  }, [validBranches]);

  // Fetch existing inventory for this product
  const { data: existingInventory = [], refetch: refetchInventory } = useProductInventory(product.id);

  // Filter inventory for selected branches
  const branchInventory = existingInventory.filter(inv => selectedBranchIds.includes(inv.branch_id || ''));

  // Calculate available variants (those that don't have inventory in ALL selected branches)
  // Logic: A variant is available to add IF it is missing in AT LEAST ONE selected branch.
  // Actually, simplified logic: Show all variants. If already exists in some branch, we just skip creation for that branch or handle upsert?
  // User wants to "create inventory for multiple branches".
  // If I select Branch A and Branch B.
  // Variant 1 exists in A but not B.
  // If I fill details for Variant 1 and click Save.
  // It should probably create for B. Update A? Or just create missing?
  // User said: "save entry for all branches". Implies overwriting or setting.
  // Safest: "Generate New Inventory" usually implies creating missing records.
  // If I select "Select All", I want to create inventory for all branches.
  // Let's assume we show variants that are missing in ANY of the selected branches?
  // Or just show all variants and let backend handle "already exists"?
  // `useCreateInventoryEntry` uses `.insert()`. It will fail if unique constraint (product_id, variant_id, branch_id) exists.
  // We should filter out variants that exist in ALL selected branches.
  
  const availableVariants = variants.filter(v => {
      // Check if this variant exists in ALL selected branches
      const branchesWithVariant = existingInventory
          .filter(inv => inv.variant_id === v.id)
          .map(inv => inv.branch_id);
      
      // If every selected branch already has this variant, then it's not "available" for creation
      const allSelectedHaveIt = selectedBranchIds.every(id => branchesWithVariant.includes(id));
      return !allSelectedHaveIt;
  });

  // Local state for new inventory entries being created
  const [newEntries, setNewEntries] = useState<{
    variantId?: string; // Optional for custom
    quantity: number;
    minStockLevel: number;
    customLabel?: string; // For custom entries
    priceOverride?: number; // Optional price override
    imageUrl?: string; // Optional image
  }[]>([]);

  // State for tracking edits to existing inventory
  const [editingInventory, setEditingInventory] = useState<Record<string, {
    quantity: number;
    minStockLevel: number;
    customLabel?: string;
    priceOverride?: number;
    imageUrl?: string;
  }>>({});

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Reset new entries when branch selection changes drastically? 
  // Maybe not needed if we handle the save logic robustly.

  const handleToggleVariant = (variantId: string, checked: boolean) => {
    if (checked) {
      setNewEntries(prev => [...prev, { variantId, quantity: 0, minStockLevel: 0, priceOverride: undefined, imageUrl: undefined }]);
    } else {
      setNewEntries(prev => prev.filter(e => e.variantId !== variantId));
    }
  };

  const handleEntryChange = (identifier: string, field: 'quantity' | 'minStockLevel' | 'customLabel' | 'priceOverride' | 'imageUrl', value: any) => {
    setNewEntries(prev => prev.map(e => {
        if (e.variantId === identifier) return { ...e, [field]: value };
        return e;
    }));
  };

  const handleEditChange = (inventoryId: string, field: 'quantity' | 'minStockLevel' | 'customLabel' | 'priceOverride' | 'imageUrl', value: any) => {
    setEditingInventory(prev => {
      const currentEdit = prev[inventoryId] || {};
      return {
        ...prev,
        [inventoryId]: {
          ...currentEdit,
          [field]: value
        }
      };
    });
  };

  // Helper to initialize edit state for a row if not present
  const ensureEditState = (inv: any) => {
     if (!editingInventory[inv.id]) {
       setEditingInventory(prev => ({
         ...prev,
         [inv.id]: {
           quantity: inv.quantity,
           minStockLevel: inv.min_stock_level,
           customLabel: inv.custom_label,
           priceOverride: inv.price_override,
           imageUrl: inv.image_url
         }
       }));
     }
  };

  const handleImageUpload = async (identifier: string, file: File, isExisting: boolean) => {
    try {
      toast.info('Uploading image...');
      const url = await uploadImageToCloudinary(file);
      
      if (isExisting) {
        // Identifier is inventoryId
        const inv = branchInventory.find(i => i.id === identifier);
        if (inv && !editingInventory[identifier]) {
           setEditingInventory(prev => ({
             ...prev,
             [identifier]: {
               quantity: inv.quantity,
               minStockLevel: inv.min_stock_level,
               customLabel: inv.custom_label,
               priceOverride: inv.price_override,
               imageUrl: url // Set new URL
             }
           }));
        } else {
           handleEditChange(identifier, 'imageUrl', url);
        }
        
        toast.success('Image uploaded. Click Save to apply changes.');
      } else {
        // Identifier is variantId (temp or real)
        handleEntryChange(identifier, 'imageUrl', url);
        toast.success('Image uploaded.');
      }
    } catch (error) {
      console.error('Image upload failed:', error);
      toast.error('Image upload failed');
    }
  };

  const triggerFileInput = (identifier: string) => {
    if (fileInputRefs.current[identifier]) {
      fileInputRefs.current[identifier]?.click();
    }
  };
  
  // Custom Entry Handling
  const addCustomEntry = () => {
      // Use a temporary ID for the key
      const tempId = `custom-${Date.now()}`;
      setNewEntries(prev => [...prev, { variantId: tempId, quantity: 0, minStockLevel: 0, customLabel: '', priceOverride: undefined, imageUrl: undefined }]);
  };

  const removeCustomEntry = (identifier: string) => {
      setNewEntries(prev => prev.filter(e => e.variantId !== identifier));
  };

  const handleSave = async () => {
    if (selectedBranchIds.length === 0 || newEntries.length === 0) return;

    try {
      const promises: Promise<any>[] = [];
      
      for (const branchId of selectedBranchIds) {
          for (const entry of newEntries) {
            // Check if this variant already exists in this branch
            const exists = existingInventory.some(inv => 
                inv.branch_id === branchId && 
                inv.variant_id === entry.variantId
            );
            
            // Skip if exists (or we could update? let's stick to creating new for now)
            if (exists && !entry.variantId?.startsWith('custom-')) continue;

            const isCustom = entry.variantId?.startsWith('custom-');
            
            promises.push(createInventory.mutateAsync({
              productId: product.id,
              variantId: isCustom ? undefined : entry.variantId,
              branchId: branchId,
              quantity: entry.quantity,
              minStockLevel: entry.minStockLevel,
              organizationId: currentOrganizationId,
              customLabel: entry.customLabel,
              priceOverride: entry.priceOverride,
              imageUrl: entry.imageUrl,
              type: isCustom ? 'custom' : 'variant',
            }));
          }
      }

      await Promise.all(promises);
      toast.success('Inventory generated successfully');
      setNewEntries([]);
      refetchInventory();
    } catch (error) {
      console.error('Failed to generate inventory:', error);
      toast.error('Failed to generate inventory');
    }
  };

  const handleSaveEdits = async (inventoryId: string) => {
    const edits = editingInventory[inventoryId];
    if (!edits) return;

    try {
      await updateInventory.mutateAsync({
        id: inventoryId,
        ...edits
      });
      toast.success('Inventory updated');
      // Clear edit state for this item
      setEditingInventory(prev => {
        const newState = { ...prev };
        delete newState[inventoryId];
        return newState;
      });
      refetchInventory();
    } catch (error) {
      console.error('Failed to update inventory:', error);
      toast.error('Failed to update inventory');
    }
  };

  const handleCancelEdit = (inventoryId: string) => {
    setEditingInventory(prev => {
      const newState = { ...prev };
      delete newState[inventoryId];
      return newState;
    });
  };

  const handleDeleteInventory = async (inventoryId: string) => {
    if (confirm('Are you sure you want to delete this inventory item?')) {
        try {
            await deleteInventory.mutateAsync(inventoryId);
            toast.success('Inventory item deleted');
            refetchInventory();
        } catch (error) {
            console.error('Failed to delete inventory:', error);
            toast.error('Failed to delete inventory item');
        }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <div className="w-full space-y-2">
          <Label>Select Branches</Label>
           <MultipleSelector
              value={branchOptions.filter(o => selectedBranchIds.includes(o.value))}
              onChange={(options) => setSelectedBranchIds(options.map(o => o.value))}
              defaultOptions={branchOptions}
              placeholder="Select branches to manage inventory"
              emptyIndicator={
                <p className="text-center text-lg leading-10 text-gray-600 dark:text-gray-400">
                  no results found.
                </p>
              }
            />
        </div>
      </div>

      {selectedBranchIds.length === 0 ? (
        <div className="text-center p-8 border rounded-md border-dashed text-muted-foreground">
          Select at least one branch to view and manage inventory.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Existing Inventory */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-muted-foreground">Existing Inventory in Selected Branches</h3>
            {branchInventory.length === 0 ? (
               <p className="text-sm text-muted-foreground italic">No inventory records found for selected branches.</p>
            ) : (
              <div className="rounded-md border">
                 <div className="grid grid-cols-12 gap-4 p-3 text-xs font-medium border-b bg-muted/50">
                    <div className="col-span-2">Branch</div>
                    <div className="col-span-3">Variant / Label</div>
                    <div className="col-span-2 text-right">Qty</div>
                    <div className="col-span-2 text-right">Min Stock</div>
                    <div className="col-span-2 text-right">Price</div>
                    <div className="col-span-1"></div>
                 </div>
                 <div className="max-h-[300px] overflow-y-auto">
                   {branchInventory.map((inv: any) => {
                     const variant = variants.find(v => v.id === inv.variant_id);
                     const isEditing = !!editingInventory[inv.id];
                     const editValues = editingInventory[inv.id] || {};
                     const currentQty = isEditing ? editValues.quantity : inv.quantity;
                     const currentMin = isEditing ? editValues.minStockLevel : inv.min_stock_level;
                     const currentPrice = isEditing ? editValues.priceOverride : inv.price_override;
                     const currentLabel = isEditing ? editValues.customLabel : inv.custom_label;
                     const currentImage = isEditing && editValues.imageUrl !== undefined ? editValues.imageUrl : (inv.image_url || product.imageUrl);

                     // Determine display name
                     let displayName = inv.productName || product.name;
                     if (inv.variant_id && variant) {
                        displayName = Object.entries(variant.attributes).map(([k,v]) => `${k}: ${v}`).join(', ');
                     } else if (inv.custom_label) {
                        displayName = inv.custom_label;
                     }
                     
                     // Branch Name
                     const branchName = validBranches.find(b => b.id === inv.branch_id)?.name || 'Unknown';
                     
                     // Fallback Price Logic
                     const fallbackPrice = variant?.price ?? product.sellingPrice;

                     return (
                       <div key={inv.id} className="grid grid-cols-12 gap-4 p-3 text-sm items-center border-b last:border-0 hover:bg-muted/20">
                          <div className="col-span-2 truncate text-xs text-muted-foreground" title={branchName}>
                             {branchName}
                          </div>
                          <div className="col-span-3 flex items-center space-x-2">
                             <div 
                               className="h-8 w-8 rounded-md bg-muted shrink-0 cursor-pointer overflow-hidden border relative group"
                               onClick={() => triggerFileInput(inv.id)}
                             >
                               {currentImage ? (
                                 <img src={currentImage} alt="Inv" className="h-full w-full object-cover" />
                               ) : (
                                 <div className="flex h-full w-full items-center justify-center">
                                   <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                 </div>
                               )}
                               <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Plus className="h-3 w-3 text-white" />
                               </div>
                             </div>
                             <input 
                              type="file" 
                              ref={el => {
                                if (el) fileInputRefs.current[inv.id] = el;
                              }}
                              className="hidden"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(inv.id, file, true);
                              }}
                            />

                             <div className="flex-1 min-w-0">
                               {!inv.variant_id ? (
                                 <Input 
                                   className={cn("h-8 text-xs", !isEditing && "border-transparent bg-transparent shadow-none hover:bg-muted/50 focus:bg-background focus:border-input")}
                                   value={currentLabel || ''} 
                                   placeholder={product.name}
                                   onChange={(e) => {
                                     ensureEditState(inv);
                                     handleEditChange(inv.id, 'customLabel', e.target.value);
                                   }}
                                 />
                               ) : (
                                 <div className="truncate font-medium" title={displayName}>
                                   {displayName}
                                   {inv.variant_id && (
                                     <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">Variant</Badge>
                                   )}
                                 </div>
                               )}
                             </div>
                          </div>
                          <div className="col-span-2">
                             <Input 
                                type="number"
                                className={cn("text-right h-8", !isEditing && "border-transparent bg-transparent shadow-none hover:bg-muted/50 focus:bg-background focus:border-input")}
                                value={currentQty}
                                onChange={(e) => {
                                  ensureEditState(inv);
                                  handleEditChange(inv.id, 'quantity', Number(e.target.value));
                                }}
                             />
                          </div>
                          <div className="col-span-2">
                             <Input 
                                type="number"
                                className={cn("text-right h-8", !isEditing && "border-transparent bg-transparent shadow-none hover:bg-muted/50 focus:bg-background focus:border-input")}
                                value={currentMin}
                                onChange={(e) => {
                                  ensureEditState(inv);
                                  handleEditChange(inv.id, 'minStockLevel', Number(e.target.value));
                                }}
                             />
                          </div>
                          <div className="col-span-2">
                             <Input 
                                type="number"
                                className={cn("text-right h-8", !isEditing && "border-transparent bg-transparent shadow-none hover:bg-muted/50 focus:bg-background focus:border-input")}
                                placeholder={`${fallbackPrice}`}
                                value={currentPrice ?? ''}
                                onChange={(e) => {
                                  ensureEditState(inv);
                                  handleEditChange(inv.id, 'priceOverride', e.target.value ? Number(e.target.value) : undefined);
                                }}
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
            )}
          </div>

          <Separator />

          {/* Generate New Inventory */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <h3 className="font-medium text-sm text-muted-foreground">Generate New Inventory</h3>
               {availableVariants.length > 0 && (
                 <Button size="sm" variant="outline" onClick={() => {
                    if (newEntries.length === availableVariants.length) {
                      setNewEntries([]);
                    } else {
                      setNewEntries(availableVariants.map(v => ({ variantId: v.id!, quantity: 0, minStockLevel: 0 })));
                    }
                 }}>
                   {newEntries.length === availableVariants.length ? 'Deselect All' : 'Select All'}
                 </Button>
               )}
            </div>
            
            {availableVariants.length === 0 && newEntries.length === 0 ? (
               <p className="text-sm text-muted-foreground italic">
                 All variants have inventory records in all selected branches. You can add custom inventory below.
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
                     const isSelected = newEntries.some(e => e.variantId === variant.id);
                     const entry = newEntries.find(e => e.variantId === variant.id);
                     
                     // Fallback Price Logic for New Entry
                     const fallbackPrice = variant.price ?? product.sellingPrice;

                     return (
                       <div key={variant.id} className={cn("grid grid-cols-12 gap-4 p-3 text-sm items-center border-b last:border-0 transition-colors", isSelected && "bg-muted/30")}>
                          <div className="col-span-1 flex justify-center">
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={(checked) => handleToggleVariant(variant.id!, !!checked)}
                            />
                          </div>
                          <div className="col-span-4 flex items-center space-x-2">
                               <div 
                                 className="h-8 w-8 rounded-md bg-muted shrink-0 cursor-pointer overflow-hidden border relative group"
                                 onClick={() => isSelected && triggerFileInput(variant.id!)}
                               >
                                 {entry?.imageUrl ? (
                                   <img src={entry.imageUrl} alt="Var" className="h-full w-full object-cover" />
                                 ) : (
                                   <div className="flex h-full w-full items-center justify-center">
                                     <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                   </div>
                                 )}
                                 {isSelected && (
                                   <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                     <Plus className="h-3 w-3 text-white" />
                                   </div>
                                 )}
                               </div>
                               <input 
                                  type="file" 
                                  ref={el => {
                                    if (el && variant.id) fileInputRefs.current[variant.id] = el;
                                  }}
                                  className="hidden"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file && variant.id) handleImageUpload(variant.id, file, false);
                                  }}
                                  disabled={!isSelected}
                                />
                               <div className="flex flex-wrap gap-1">
                                 {Object.entries(variant.attributes).map(([key, value]) => (
                                   <Badge key={key} variant="outline" className="text-[10px] px-1 py-0 h-5">
                                     {key}: {value}
                                   </Badge>
                                 ))}
                               </div>
                          </div>
                          <div className="col-span-2">
                             <Input 
                                type="number"
                                className="text-right h-8"
                                value={entry?.quantity || 0}
                                disabled={!isSelected}
                                onChange={(e) => handleEntryChange(variant.id!, 'quantity', Number(e.target.value))}
                             />
                          </div>
                          <div className="col-span-2">
                             <Input 
                                type="number"
                                className="text-right h-8"
                                value={entry?.minStockLevel || 0}
                                disabled={!isSelected}
                                onChange={(e) => handleEntryChange(variant.id!, 'minStockLevel', Number(e.target.value))}
                             />
                          </div>
                          <div className="col-span-3">
                             <Input 
                                type="number"
                                className="text-right h-8"
                                placeholder={`Default: ${fallbackPrice}`}
                                value={entry?.priceOverride ?? ''}
                                disabled={!isSelected}
                                onChange={(e) => handleEntryChange(variant.id!, 'priceOverride', e.target.value ? Number(e.target.value) : undefined)}
                             />
                          </div>
                       </div>
                     );
                   })}

                   {/* Custom Entries */}
                   {newEntries.filter(e => e.variantId?.startsWith('custom-')).map((entry) => (
                     <div key={entry.variantId} className="grid grid-cols-12 gap-4 p-3 text-sm items-center border-b last:border-0 bg-blue-50/50">
                        <div className="col-span-1 flex justify-center">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-100"
                            onClick={() => removeCustomEntry(entry.variantId!)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="col-span-4 flex items-center space-x-2">
                             <div 
                               className="h-8 w-8 rounded-md bg-muted shrink-0 cursor-pointer overflow-hidden border relative group"
                               onClick={() => triggerFileInput(entry.variantId!)}
                             >
                               {entry.imageUrl ? (
                                 <img src={entry.imageUrl} alt="Cust" className="h-full w-full object-cover" />
                               ) : (
                                 <div className="flex h-full w-full items-center justify-center">
                                   <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                 </div>
                               )}
                               <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Plus className="h-3 w-3 text-white" />
                               </div>
                             </div>
                             <input 
                                type="file" 
                                ref={el => {
                                  if (el && entry.variantId) fileInputRefs.current[entry.variantId] = el;
                                }}
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file && entry.variantId) handleImageUpload(entry.variantId, file, false);
                                }}
                              />
                             <Input 
                                placeholder="Custom Label (e.g. Used, Damaged)"
                                className="h-8 text-xs flex-1"
                                value={entry.customLabel}
                                onChange={(e) => handleEntryChange(entry.variantId!, 'customLabel', e.target.value)}
                             />
                        </div>
                        <div className="col-span-2">
                           <Input 
                              type="number"
                              className="text-right h-8"
                              value={entry.quantity}
                              onChange={(e) => handleEntryChange(entry.variantId!, 'quantity', Number(e.target.value))}
                           />
                        </div>
                        <div className="col-span-2">
                           <Input 
                              type="number"
                              className="text-right h-8"
                              value={entry.minStockLevel}
                              onChange={(e) => handleEntryChange(entry.variantId!, 'minStockLevel', Number(e.target.value))}
                           />
                        </div>
                        <div className="col-span-3">
                           <Input 
                              type="number"
                              className="text-right h-8"
                              placeholder={`Default: ${product.sellingPrice}`}
                              value={entry.priceOverride ?? ''}
                              onChange={(e) => handleEntryChange(entry.variantId!, 'priceOverride', e.target.value ? Number(e.target.value) : undefined)}
                           />
                        </div>
                     </div>
                   ))}
                 </div>
              </div>
            )}
            
            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" size="sm" onClick={addCustomEntry}>
                <Plus className="mr-2 h-3 w-3" /> Add Custom Inventory
              </Button>

              {newEntries.length > 0 && (
                <Button onClick={handleSave} disabled={createInventory.isPending}>
                  {createInventory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate Inventory for {selectedBranchIds.length} Branch{selectedBranchIds.length !== 1 ? 'es' : ''}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
