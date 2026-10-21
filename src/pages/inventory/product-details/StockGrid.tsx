import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAdjustStock, type StockAdjustment, type StockRow } from '@/hooks/useProductStock';
import { cn } from '@/lib/utils';
import type { Branch } from '@/types/branches';
import type { Product } from '@/types/inventory';
import {
  cellKey,
  otherStockLabel,
  splitStockRows,
  stockTone,
  variantLabel,
} from '../product-editor/productHelpers';

interface GridRow {
  key: string;
  label: string;
  variantId: string | null;
  stockLabel: string | null;
  cells: Map<string, StockRow>; // by branch id
  /** Whether a branch without a row can be stocked from this line. */
  fillsEmpty: boolean;
}

/** Variant × branch stock with click-to-adjust cells. */
export function StockGrid({
  product,
  branches,
  stockRows,
  canAdjust,
}: {
  product: Product;
  branches: Branch[];
  stockRows: StockRow[];
  canAdjust: boolean;
}) {
  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const hasVariants = variants.length > 0;

  const { rows, others } = useMemo(() => {
    const { cells, others: rest } = splitStockRows(stockRows, new Set(variants.map((v) => v.id)), hasVariants);
    const byBranch = (variantId: string | null) =>
      new Map(branches.flatMap((b) => {
        const row = cells.get(cellKey(variantId, b.id));
        return row ? [[b.id, row] as const] : [];
      }));

    const main: GridRow[] = hasVariants
      ? variants.map((v) => ({
          key: v.id,
          label: variantLabel(v.attributes),
          variantId: v.id,
          stockLabel: null,
          cells: byBranch(v.id),
          fillsEmpty: true,
        }))
      : [{ key: 'base', label: 'Stock', variantId: null, stockLabel: null, cells: byBranch(null), fillsEmpty: true }];

    // Rows with the same variant and label line up across branches. For
    // unlabelled rows only the first per branch joins that line (e.g. "No
    // variant" stock from before options were added); true duplicates each
    // get their own line so every row stays reachable.
    const grouped = new Map<string, GridRow>();
    const placed = new Set<string>();
    rest.forEach((row) => {
      const variant = variants.find((v) => v.id === row.variantId);
      const lineKey = `${row.variantId ?? ''}|${row.label ?? ''}`;
      const slot = `${lineKey}|${row.branchId}`;
      const noVariantStock = hasVariants && !row.variantId && !row.label && !placed.has(slot);
      const key = row.label || noVariantStock ? lineKey : row.id;
      if (noVariantStock) placed.add(slot);
      const entry = grouped.get(key) ?? {
        key,
        label: noVariantStock
          ? 'No variant'
          : otherStockLabel(row, variant ? variantLabel(variant.attributes) : undefined, hasVariants),
        variantId: row.variantId,
        stockLabel: row.label,
        cells: new Map<string, StockRow>(),
        // An unlabelled duplicate is one specific row; an empty branch would
        // resolve to the main cell instead, so it isn't offered.
        fillsEmpty: !!row.label,
      };
      if (row.branchId) entry.cells.set(row.branchId, row);
      grouped.set(key, entry);
    });

    return { rows: main, others: [...grouped.values()] };
  }, [stockRows, variants, hasVariants, branches]);

  const total = (row: GridRow) => [...row.cells.values()].reduce((sum, r) => sum + r.quantity, 0);

  const renderRow = (row: GridRow) => (
    <tr key={row.key} className="border-t">
      <td className="whitespace-nowrap px-3 py-2">{row.label}</td>
      {branches.map((branch) => (
        <td key={branch.id} className="px-1 py-1 text-right">
          <StockCell
            product={product}
            branch={branch}
            gridRow={row}
            stockRow={row.cells.get(branch.id)}
            canAdjust={canAdjust}
          />
        </td>
      ))}
      <td className="px-3 py-2 text-right font-medium tabular-nums">{total(row)}</td>
    </tr>
  );

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{hasVariants ? 'Variant' : ''}</th>
            {branches.map((b) => (
              <th key={b.id} className="whitespace-nowrap px-3 py-2 text-right font-medium">
                {b.name}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(renderRow)}
          {others.length > 0 && (
            <tr className="border-t bg-muted/30">
              <td colSpan={branches.length + 2} className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                Other stock
              </td>
            </tr>
          )}
          {others.map(renderRow)}
        </tbody>
      </table>
    </div>
  );
}

type Mode = 'add' | 'remove' | 'count';
const REASONS: Record<Mode, { value: 'received' | 'return' | 'damaged' | 'correction' | 'other' | 'count'; label: string }[]> = {
  add: [
    { value: 'received', label: 'Received' },
    { value: 'return', label: 'Return' },
    { value: 'correction', label: 'Correction' },
  ],
  remove: [
    { value: 'damaged', label: 'Damaged' },
    { value: 'correction', label: 'Correction' },
    { value: 'other', label: 'Other' },
  ],
  count: [{ value: 'count', label: 'Count' }],
};

function StockCell({
  product,
  branch,
  gridRow,
  stockRow,
  canAdjust,
}: {
  product: Product;
  branch: Branch;
  gridRow: GridRow;
  stockRow?: StockRow;
  canAdjust: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState(REASONS.add[0].value);
  const [note, setNote] = useState('');
  const adjustStock = useAdjustStock();

  const quantity = stockRow?.quantity ?? 0;
  const tone = stockRow ? stockTone(quantity, stockRow.minStockLevel) : null;
  const value = amount === '' ? NaN : Number(amount);
  const next =
    Number.isNaN(value) ? null : mode === 'add' ? quantity + value : mode === 'remove' ? quantity - value : value;
  const invalid = next === null || next < 0 || (mode !== 'count' && value <= 0);

  if (!stockRow && !gridRow.fillsEmpty) {
    return <span className="px-2 text-muted-foreground">–</span>;
  }

  const display = (
    <span
      className={cn(
        'tabular-nums',
        !stockRow && 'text-muted-foreground',
        tone === 'out' && 'font-medium text-destructive',
        tone === 'low' && 'font-medium text-amber-600 dark:text-amber-400'
      )}
    >
      {stockRow ? quantity : '–'}
    </span>
  );

  if (!canAdjust) return <span className="px-2">{display}</span>;

  const reset = (nextMode: Mode) => {
    setMode(nextMode);
    setReason(REASONS[nextMode][0].value);
    setAmount('');
  };

  const submit = async () => {
    if (invalid) return;
    const target: StockAdjustment = stockRow
      ? { inventory_id: stockRow.id }
      : { product_id: product.id, variant_id: gridRow.variantId, branch_id: branch.id, label: gridRow.stockLabel };
    try {
      await adjustStock.mutateAsync({
        items: [{ ...target, ...(mode === 'count' ? { quantity: value } : { change: mode === 'add' ? value : -value }) }],
        reason,
        note: note.trim() || undefined,
      });
      toast.success(`${gridRow.label} · ${branch.name}: ${next}`);
      setOpen(false);
      setAmount('');
      setNote('');
    } catch (error) {
      console.error('Stock adjustment failed:', error);
      toast.error((error as Error)?.message || 'Could not update stock');
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset('add');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full rounded px-2 py-1 text-right hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${gridRow.label} in ${branch.name}: ${stockRow ? quantity : 'no stock'}`}
        >
          {display}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{gridRow.label}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{branch.name}</span>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
          {(['add', 'remove', 'count'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => reset(m)}
              className={cn(
                'rounded px-2 py-1 text-xs font-medium capitalize',
                mode === m ? 'bg-background shadow-sm' : 'text-muted-foreground'
              )}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="tabular-nums text-muted-foreground">{quantity}</span>
          <span className="text-muted-foreground">{mode === 'add' ? '+' : mode === 'remove' ? '−' : '→'}</span>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="h-8 w-20 text-right tabular-nums"
            autoFocus
            aria-label={mode === 'count' ? 'Counted quantity' : 'Quantity'}
          />
          {mode !== 'count' && next !== null && (
            <span className={cn('tabular-nums', next < 0 ? 'text-destructive' : 'text-muted-foreground')}>= {next}</span>
          )}
        </div>

        {REASONS[mode].length > 1 && (
          <div className="flex flex-wrap gap-1">
            {REASONS[mode].map((r) => (
              <Badge
                key={r.value}
                asChild
                variant={reason === r.value ? 'default' : 'outline'}
                className="cursor-pointer"
              >
                <button type="button" onClick={() => setReason(r.value)} aria-pressed={reason === r.value}>
                  {r.label}
                </button>
              </Badge>
            ))}
          </div>
        )}

        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className="h-8 text-sm" />

        <div className="flex items-center justify-between">
          {stockRow ? (
            <Link to={`/inventory/entry/${stockRow.id}`} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
              #{stockRow.inventoryNumber ?? 'details'}
            </Link>
          ) : (
            <span />
          )}
          <Button size="sm" onClick={submit} disabled={invalid || adjustStock.isPending}>
            {adjustStock.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
