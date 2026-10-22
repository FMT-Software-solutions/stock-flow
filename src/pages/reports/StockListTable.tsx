import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { stockItemVariant, type StockListItem } from './stockItems';

interface StockListTableProps {
  products: StockListItem[];
  groupByCategory: boolean;
  emptyText: string;
}

/** Low / out-of-stock list, optionally grouped by category. */
export function StockListTable({ products, groupByCategory, emptyText }: StockListTableProps) {
  const rows = products || [];
  const showVariant = rows.some((p) => p.variant || p.label);
  const showBranch = rows.some((p) => p.branch_name);

  const renderTable = (items: StockListItem[], withCategory: boolean) => (
    <div className="max-h-100 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            {showVariant && <TableHead>Variant</TableHead>}
            {showBranch && <TableHead>Branch</TableHead>}
            <TableHead>SKU</TableHead>
            {withCategory && <TableHead>Category</TableHead>}
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Min</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.name}</TableCell>
              {showVariant && <TableCell>{stockItemVariant(p) || '-'}</TableCell>}
              {showBranch && <TableCell>{p.branch_name || '-'}</TableCell>}
              <TableCell>{p.sku || '-'}</TableCell>
              {withCategory && <TableCell>{p.category_name || 'Uncategorized'}</TableCell>}
              <TableCell className="text-right tabular-nums">{Number(p.quantity ?? 0)}</TableCell>
              <TableCell className="text-right tabular-nums">{Number(p.min_stock_level ?? 0)}</TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {emptyText}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  if (!groupByCategory) return renderTable(rows, true);

  if (rows.length === 0) {
    return <div className="text-center text-muted-foreground">{emptyText}</div>;
  }

  const grouped: Record<string, StockListItem[]> = {};
  for (const p of rows) {
    const key = p.category_name || 'Uncategorized';
    grouped[key] ||= [];
    grouped[key].push(p);
  }

  return (
    <Accordion type="multiple">
      {Object.entries(grouped).map(([category, items]) => (
        <AccordionItem key={category} value={category}>
          <AccordionTrigger>
            <div className="flex w-full items-center justify-between">
              <span className="font-medium">{category}</span>
              <Badge variant="outline">{items.length} items</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>{renderTable(items, false)}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
