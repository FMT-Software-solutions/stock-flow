import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdjustStock, type StockAdjustment, type StockRow } from '@/hooks/useProductStock';
import type { Branch } from '@/types/branches';
import type { Product } from '@/types/inventory';
import { cellKey, splitStockRows, variantLabel, variantName } from '../product-editor/productHelpers';

interface Line {
  key: string;
  label: string;
  current: number;
  target: StockAdjustment;
}

/** Receive a delivery: several variants into one branch, one transaction. */
export function AddStockDialog({
  open,
  onOpenChange,
  product,
  branches,
  stockRows,
  defaultBranchId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  branches: Branch[];
  stockRows: StockRow[];
  defaultBranchId?: string;
}) {
  const [branchId, setBranchId] = useState(defaultBranchId ?? branches[0]?.id ?? '');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const adjustStock = useAdjustStock();

  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const hasVariants = variants.length > 0;

  const lines = useMemo<Line[]>(() => {
    if (!branchId) return [];
    const { cells, others } = splitStockRows(stockRows, variants, hasVariants);
    const main: Line[] = (hasVariants ? variants : [null]).map((v) => {
      const row = cells.get(cellKey(v?.id ?? null, branchId));
      return {
        key: v?.id ?? 'base',
        label: v ? variantName(v) : product.name,
        current: row?.quantity ?? 0,
        target: row
          ? { inventory_id: row.id }
          : { product_id: product.id, variant_id: v?.id ?? null, branch_id: branchId },
      };
    });
    const labelled: Line[] = others
      .filter((r) => r.branchId === branchId && r.label)
      .map((r) => {
        const v = variants.find((x) => x.id === r.variantId);
        return {
          key: r.id,
          label: v?.customLabel
            ? [r.label, r.inventoryNumber ? `#${r.inventoryNumber}` : null].filter(Boolean).join(' · ')
            : [v ? variantLabel(v.attributes) : null, r.label].filter(Boolean).join(' · '),
          current: r.quantity,
          target: { inventory_id: r.id },
        };
      });
    return [...main, ...labelled];
  }, [branchId, stockRows, variants, hasVariants, product]);

  const items = lines
    .map((line) => ({ line, value: Number(amounts[line.key]) }))
    .filter(({ value }) => value > 0)
    .map(({ line, value }) => ({ ...line.target, change: value }));

  const close = (o: boolean) => {
    if (!o) {
      setAmounts({});
      setNote('');
    }
    onOpenChange(o);
  };

  const submit = async () => {
    if (items.length === 0) return;
    try {
      await adjustStock.mutateAsync({ items, reason: 'received', note: note.trim() || undefined });
      toast.success('Stock added');
      close(false);
    } catch (error) {
      console.error('Adding stock failed:', error);
      toast.error((error as Error)?.message || 'Could not add stock');
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add stock</DialogTitle>
        </DialogHeader>

        {branches.length > 1 && (
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger aria-label="Branch">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="max-h-80 divide-y overflow-y-auto rounded-md border">
          {lines.map((line) => (
            <div key={line.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{line.label}</span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums text-muted-foreground">{line.current} +</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={amounts[line.key] ?? ''}
                  onChange={(e) => setAmounts((a) => ({ ...a, [line.key]: e.target.value }))}
                  className="h-8 w-20 text-right tabular-nums"
                  aria-label={`Add to ${line.label}`}
                />
              </div>
            </div>
          ))}
        </div>

        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (supplier, invoice…)" />

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={items.length === 0 || adjustStock.isPending}>
            {adjustStock.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
