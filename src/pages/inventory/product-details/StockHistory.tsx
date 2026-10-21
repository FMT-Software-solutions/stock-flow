import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useStockMovements, type StockReason, type StockRow } from '@/hooks/useProductStock';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/inventory';
import { variantLabel } from '../product-editor/productHelpers';

const REASON_LABEL: Record<StockReason, string> = {
  opening: 'Opening',
  received: 'Received',
  count: 'Count',
  damaged: 'Damaged',
  correction: 'Correction',
  return: 'Return',
  sale: 'Sale',
  sale_reversal: 'Sale undone',
  edit: 'Edited',
  other: 'Other',
};

export function StockHistory({ product, stockRows }: { product: Product; stockRows: StockRow[] }) {
  const { data: movements = [], isLoading } = useStockMovements(product.id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (movements.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No stock changes yet</p>;
  }

  const describe = (inventoryId: string, variantId: string | null) => {
    const variant = product.variants?.find((v) => v.id === variantId);
    const row = stockRows.find((r) => r.id === inventoryId);
    const name = variant ? variantLabel(variant.attributes) : variantId ? 'Removed variant' : null;
    return [name, row?.label].filter(Boolean).join(' · ') || '—';
  };

  const hasVariants = (product.variants?.length ?? 0) > 0 || movements.some((m) => m.variantId);

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">When</th>
            {hasVariants && <th className="px-3 py-2 text-left font-medium">Variant</th>}
            <th className="px-3 py-2 text-left font-medium">Branch</th>
            <th className="px-3 py-2 text-right font-medium">Change</th>
            <th className="px-3 py-2 text-right font-medium">After</th>
            <th className="px-3 py-2 text-left font-medium">Reason</th>
            <th className="px-3 py-2 text-left font-medium">By</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id} className="border-t align-top">
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                {format(new Date(m.createdAt), 'dd MMM yyyy, HH:mm')}
              </td>
              {hasVariants && <td className="whitespace-nowrap px-3 py-2">{describe(m.inventoryId, m.variantId)}</td>}
              <td className="whitespace-nowrap px-3 py-2">{m.branchName ?? '—'}</td>
              <td
                className={cn(
                  'px-3 py-2 text-right font-medium tabular-nums',
                  m.change > 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'
                )}
              >
                {m.change > 0 ? `+${m.change}` : m.change}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{m.quantityAfter}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant="outline">{REASON_LABEL[m.reason] ?? m.reason}</Badge>
                  {m.orderId && (
                    <Link to={`/orders/${m.orderId}`} className="text-xs underline-offset-2 hover:underline">
                      {m.orderNumber ?? 'Sale'}
                    </Link>
                  )}
                  {m.note && <span className="text-xs text-muted-foreground">{m.note}</span>}
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{m.createdByName || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
