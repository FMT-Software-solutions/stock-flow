import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useInventoryEntries } from '@/hooks/useInventoryQueries';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Badge } from '@/components/ui/badge';
import { useCurrency } from '@/hooks/useCurrency';

interface InventorySelectorProps {
  value?: string;
  onChange: (value: string, price?: number) => void;
  branchId?: string;
  disabled?: boolean;
  excludeIds?: string[];
  quantityOverride?: number;
}

export function InventorySelector({
  value,
  onChange,
  branchId,
  disabled,
  excludeIds = [],
  quantityOverride,
}: InventorySelectorProps) {
  const [open, setOpen] = useState(false);
  const { currentOrganization } = useOrganization();
  const { formatCurrency } = useCurrency();

  // Fetch inventory for the specific branch if selected, otherwise all (but usually we want branch specific for orders)
  const branchIds = branchId ? [branchId] : undefined;
  const { data: inventory = [], isLoading } = useInventoryEntries(
    currentOrganization?.id,
    branchIds
  );

  const effectiveInventory = branchId ? inventory : [];
  const selectedItem = useMemo(
    () => effectiveInventory.find((item) => item.id === value),
    [effectiveInventory, value]
  );

  const displayQuantity = quantityOverride ?? selectedItem?.quantity ?? 0;
  const selectedImage = selectedItem?.imageUrl || selectedItem?.productImage;
  const selectedPrice =
    selectedItem?.priceOverride ??
    selectedItem?.variantPrice ??
    selectedItem?.productPrice ??
    0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-10 px-3 py-2 hover:bg-muted/50"
          disabled={disabled || isLoading}
        >
          {selectedItem ? (
            <div className="flex items-center gap-3 text-left w-full overflow-hidden">
              <div className="h-8 w-8 rounded-md bg-muted shrink-0 overflow-hidden border">
                {selectedImage ? (
                  <img
                    src={selectedImage}
                    alt={selectedItem.productName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex flex-col truncate">
                <span className="font-medium truncate">
                  {selectedItem.productName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {selectedItem.sku}{' '}
                  {selectedItem.inventoryNumber
                    ? `• ${selectedItem.inventoryNumber}`
                    : ''}{' '}
                  • {formatCurrency(selectedPrice)}
                </span>
              </div>
              <Badge
                variant={displayQuantity > 0 ? 'outline' : 'destructive'}
                className="ml-auto shrink-0"
              >
                {displayQuantity}
              </Badge>
            </div>
          ) : (
            <span className="text-muted-foreground">Select product...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name, SKU, or inventory #..." />
          <CommandList>
            <CommandEmpty>No inventory found.</CommandEmpty>
            <CommandGroup className="max-h-75 overflow-auto">
              {effectiveInventory
                .filter((item) => !excludeIds.includes(item.id))
                .map((item) => {
                  const image = item.imageUrl || item.productImage;
                  const isOutOfStock = (item.quantity ?? 0) <= 0;
                  const itemPrice =
                    item.priceOverride ??
                    item.variantPrice ??
                    item.productPrice ??
                    0;

                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.productName} ${item.sku} ${item.inventoryNumber || ''
                        }`}
                      disabled={isOutOfStock}
                      onSelect={() => {
                        if (isOutOfStock) return;
                        onChange(item.id, itemPrice);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === item.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <div className="h-8 w-8 rounded-md bg-muted shrink-0 overflow-hidden border">
                          {image ? (
                            <img
                              src={image}
                              alt={item.productName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col flex-1 truncate">
                          <span className="font-medium truncate">
                            {item.productName}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{item.sku}</span>
                            {item.inventoryNumber && (
                              <span>• {item.inventoryNumber}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xs text-muted-foreground font-medium">
                            {formatCurrency(itemPrice)}
                          </span>
                          <span
                            className={cn(
                              'text-xs font-medium',
                              item.quantity <= 0
                                ? 'text-destructive'
                                : 'text-green-600'
                            )}
                          >
                            {item.quantity} in stock
                          </span>

                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
