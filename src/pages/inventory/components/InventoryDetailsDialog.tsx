import { useState, useRef } from 'react';
import type { InventoryEntry } from '@/types/inventory';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Link } from 'react-router-dom';
import {
  Edit,
  Image as ImageIcon,
  Loader2,
  ExternalLink,
  Upload,
  Copy,
} from 'lucide-react';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { useUpdateInventoryEntry } from '@/hooks/useInventoryQueries';
import { uploadImageToCloudinary } from '@/utils/cloudinary';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface InventoryDetailsDialogProps {
  inventory: InventoryEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InventoryDetailsDialog({
  inventory,
  open,
  onOpenChange,
}: InventoryDetailsDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    quantity: inventory.quantity,
    minStockLevel: inventory.minStockLevel,
    location: inventory.location || '',
    customLabel: inventory.customLabel || '',
    priceOverride: inventory.priceOverride,
    imageUrl: inventory.imageUrl,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateInventory = useUpdateInventoryEntry();

  const handleEditToggle = () => {
    if (isEditing) {
      // Reset form data on cancel
      setFormData({
        quantity: inventory.quantity,
        minStockLevel: inventory.minStockLevel,
        location: inventory.location || '',
        customLabel: inventory.customLabel || '',
        priceOverride: inventory.priceOverride,
        imageUrl: inventory.imageUrl,
      });
    }
    setIsEditing(!isEditing);
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      await updateInventory.mutateAsync({
        id: inventory.id,
        quantity: formData.quantity,
        minStockLevel: formData.minStockLevel,
        location: formData.location,
        customLabel:
          inventory.type === 'custom' || !inventory.variantId
            ? formData.customLabel
            : undefined,
        priceOverride: formData.priceOverride,
        imageUrl: formData.imageUrl,
      });
      toast.success('Inventory updated successfully');
      setIsEditing(false);
    } catch (error) {
      toast.error('Failed to update inventory');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const url = await uploadImageToCloudinary(file);
      setFormData((prev) => ({ ...prev, imageUrl: url }));
      toast.success('Image uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload image');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const displayImage = isEditing
    ? formData.imageUrl || inventory.productImage
    : inventory.imageUrl || inventory.productImage;

  const fallbackPrice = inventory.variantPrice ?? inventory.productPrice;
  const displayPrice = inventory.priceOverride ?? fallbackPrice;

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) setIsEditing(false);
      }}
    >
      <DialogContent className="sm:max-w-150">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? 'Edit Inventory' : 'Inventory Details'}
            {!isEditing && (
              <Badge variant="outline" className="ml-2">
                {inventory.type === 'variant' ? 'Variant' : 'Custom'}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Header Section with Image and Basic Info */}
          <div className="flex gap-4">
            <div
              className={cn(
                'h-24 w-24 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0 relative group',
                isEditing && 'cursor-pointer hover:opacity-90'
              )}
              onClick={() => isEditing && fileInputRef.current?.click()}
            >
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={inventory.productName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}

              {isEditing && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload className="h-6 w-6 text-white" />
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={!isEditing || isLoading}
              />
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg leading-none tracking-tight">
                    <Link
                      to={`/inventory/${inventory.productId}`}
                      className="hover:underline flex items-center gap-1 text-primary"
                    >
                      {inventory.productName}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    SKU: {inventory.sku}
                  </p>
                  <p
                    className="text-sm text-muted-foreground flex items-center gap-2 group/copy cursor-pointer w-fit"
                    onClick={() => {
                      if (inventory.inventoryNumber) {
                        navigator.clipboard.writeText(
                          inventory.inventoryNumber
                        );
                        toast.success('Copied!');
                      }
                    }}
                  >
                    Inv #: {inventory.inventoryNumber || '-'}
                    {inventory.inventoryNumber && (
                      <Copy className="h-3 w-3 opacity-0 group-hover/copy:opacity-100 transition-opacity" />
                    )}
                  </p>
                </div>
                {!isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEditToggle}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>

              {!isEditing && (
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary" className="font-normal">
                    {inventory.branchName || 'No Branch'}
                  </Badge>
                  {inventory.location && (
                    <Badge variant="outline" className="font-normal">
                      Loc: {inventory.location}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Details / Form Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              {isEditing ? (
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      quantity: Number(e.target.value),
                    }))
                  }
                />
              ) : (
                <div className="text-sm font-medium">
                  {inventory.quantity} {inventory.unit}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Min Stock Level</Label>
              {isEditing ? (
                <Input
                  type="number"
                  value={formData.minStockLevel}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      minStockLevel: Number(e.target.value),
                    }))
                  }
                />
              ) : (
                <div className="text-sm font-medium">
                  {inventory.minStockLevel} {inventory.unit}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Selling Price</Label>
              {isEditing ? (
                <Input
                  type="number"
                  placeholder={`Default: ${fallbackPrice}`}
                  value={formData.priceOverride ?? ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      priceOverride: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    }))
                  }
                />
              ) : (
                <div className="text-sm font-medium">
                  {displayPrice !== undefined ? (
                    <div className="flex items-center gap-2">
                      <CurrencyDisplay amount={displayPrice} />
                      {inventory.priceOverride && (
                        <Badge variant="secondary" className="text-[10px] h-5">
                          Override
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">
                      Not set
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              {isEditing ? (
                <Input
                  value={formData.location}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      location: e.target.value,
                    }))
                  }
                  placeholder="Shelf A, Bin 2..."
                />
              ) : (
                <div className="text-sm font-medium">
                  {inventory.location || (
                    <span className="text-muted-foreground italic">
                      Not specified
                    </span>
                  )}
                </div>
              )}
            </div>

            {(inventory.type === 'custom' || !inventory.variantId) && (
              <div className="col-span-2 space-y-2">
                <Label>Custom Label</Label>
                {isEditing ? (
                  <Input
                    value={formData.customLabel}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        customLabel: e.target.value,
                      }))
                    }
                    placeholder="e.g. Display Unit"
                  />
                ) : (
                  <div className="text-sm font-medium">
                    {inventory.customLabel || (
                      <span className="text-muted-foreground italic">None</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {!isEditing && (
            <div className="text-xs text-muted-foreground flex justify-between pt-2">
              <span>Created by: {inventory.createdByName || 'Unknown'}</span>
              <span>
                Last updated:{' '}
                {new Date(inventory.lastUpdated).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {isEditing && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleEditToggle}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
