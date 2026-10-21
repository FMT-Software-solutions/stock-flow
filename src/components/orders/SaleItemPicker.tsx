import { useState } from 'react';
import { Check, ChevronsUpDown, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useSellableProducts, type SellableOption, type SellableProduct } from '@/hooks/useSellableProducts';
import { cn } from '@/lib/utils';

interface SaleItemPickerProps {
  /** Sale line key (see lib/saleLines) */
  value?: string;
  onChange: (key: string, price: number) => void;
  branchId?: string;
  disabled?: boolean;
  /** Keys already on other lines */
  excludeKeys?: string[];
  /** Stock left after this sale, for the selected line */
  quantityOverride?: number;
}

/**
 * Product search for sale lines: one entry per product, its variants and
 * labelled stock listed beneath it, stock shown for the sale's branch.
 */
export function SaleItemPicker({
  value,
  onChange,
  branchId,
  disabled,
  excludeKeys = [],
  quantityOverride,
}: SaleItemPickerProps) {
  const [open, setOpen] = useState(false);
  const { currentOrganization } = useOrganization();
  const { formatCurrency } = useCurrency();
  const { products, optionByKey, isLoading } = useSellableProducts(currentOrganization?.id, branchId);

  const selected = value ? optionByKey.get(value) : undefined;
  const selectedProduct = selected ? products.find((p) => p.productId === selected.productId) : undefined;
  const selectedStock = selected?.stock === null ? null : quantityOverride ?? selected?.stock ?? 0;

  const pick = (option: SellableOption) => {
    onChange(option.key, option.price);
    setOpen(false);
  };

  // cmdk identifies items by value, so the line key is appended to keep
  // same-named products distinct.
  const searchValue = (product: SellableProduct, option?: SellableOption) =>
    [product.name, option?.label, option?.sku, option?.inventoryNumber, option?.key ?? product.productId]
      .filter(Boolean)
      .join(' ');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-10 w-full justify-between px-3 py-2 hover:bg-muted/50"
          disabled={disabled || isLoading}
        >
          {selected && selectedProduct ? (
            <div className="flex w-full items-center gap-3 overflow-hidden text-left">
              <Thumb src={selectedProduct.imageUrl} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">
                  {selectedProduct.name}
                  {selected.label && <span className="text-muted-foreground"> · {selected.label}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{formatCurrency(selected.price)}</span>
              </div>
              {selectedStock !== null && (
                <span
                  className={cn(
                    'ml-auto shrink-0 text-xs font-medium tabular-nums',
                    selectedStock <= 0 ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  {selectedStock} left
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">Select product…</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search name, SKU or #…" />
          <CommandList className="max-h-80">
            <CommandEmpty>No products</CommandEmpty>
            {products.map((product) => {
              const options = product.options.filter((o) => o.key === value || !excludeKeys.includes(o.key));
              const single = options.length === 1 && !options[0].label ? options[0] : null;

              if (single || options.length === 0) {
                return (
                  <CommandGroup key={product.productId}>
                    <OptionItem
                      product={product}
                      option={single}
                      selected={!!single && single.key === value}
                      value={searchValue(product, single ?? undefined)}
                      onPick={pick}
                      formatCurrency={formatCurrency}
                    />
                  </CommandGroup>
                );
              }

              return (
                <CommandGroup
                  key={product.productId}
                  heading={
                    <span className="flex items-center gap-2 text-foreground">
                      <Thumb src={product.imageUrl} small />
                      {product.name}
                    </span>
                  }
                >
                  {options.map((option) => (
                    <OptionItem
                      key={option.key}
                      product={product}
                      option={option}
                      selected={option.key === value}
                      value={searchValue(product, option)}
                      onPick={pick}
                      formatCurrency={formatCurrency}
                      nested
                    />
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function OptionItem({
  product,
  option,
  selected,
  value,
  onPick,
  formatCurrency,
  nested,
}: {
  product: SellableProduct;
  /** null: a tracked product with no stock row in this branch */
  option: SellableOption | null;
  selected: boolean;
  value: string;
  onPick: (option: SellableOption) => void;
  formatCurrency: (amount: number) => string;
  nested?: boolean;
}) {
  const stock = option ? option.stock : 0;
  const outOfStock = stock !== null && stock <= 0;

  return (
    <CommandItem
      value={value}
      disabled={!option || outOfStock}
      onSelect={() => option && !outOfStock && onPick(option)}
      className={cn(nested && 'pl-9')}
    >
      <Check className={cn('mr-2 h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
      {!nested && <Thumb src={product.imageUrl} />}
      <span className={cn('min-w-0 flex-1 truncate', !nested && 'ml-2 font-medium')}>
        {nested ? option?.label : product.name}
      </span>
      <span className="ml-2 flex shrink-0 items-center gap-3 text-xs tabular-nums">
        {option && <span className="text-muted-foreground">{formatCurrency(option.price)}</span>}
        {stock !== null && (
          <span className={cn('w-12 text-right', outOfStock ? 'text-destructive' : 'text-green-600 dark:text-green-400')}>
            {stock} here
          </span>
        )}
      </span>
    </CommandItem>
  );
}

function Thumb({ src, small }: { src?: string; small?: boolean }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded border bg-muted',
        small ? 'h-5 w-5' : 'h-8 w-8'
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <Package className={cn('text-muted-foreground', small ? 'h-3 w-3' : 'h-4 w-4')} />
      )}
    </span>
  );
}
