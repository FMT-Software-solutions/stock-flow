import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type StockItem = {
  id: string;
  name: string;
  sku: string | null;
  category_name: string | null;
  quantity: number;
  min_stock_level: number;
};

interface OutOfStockTableProps {
  products: StockItem[];
  groupByCategory: boolean;
}

export function OutOfStockTable({ products, groupByCategory }: OutOfStockTableProps) {
  if (!groupByCategory) {
    return (
      <div className="max-h-100 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Min</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(products || []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.sku || '-'}</TableCell>
                <TableCell>{p.category_name || 'Uncategorized'}</TableCell>
                <TableCell>{Number(p.quantity ?? 0)}</TableCell>
                <TableCell>{Number(p.min_stock_level ?? 0)}</TableCell>
              </TableRow>
            ))}
            {(products || []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No out of stock products.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  const grouped: Record<string, StockItem[]> = {};
  for (const p of products || []) {
    const key = p.category_name || 'Uncategorized';
    grouped[key] ||= [];
    grouped[key].push(p);
  }
  const categories = Object.keys(grouped);

  if ((products || []).length === 0) {
    return (
      <div className="text-center text-muted-foreground">
        No out of stock products.
      </div>
    );
  }

  return (
    <Accordion type="multiple">
      {categories.map((category) => {
        const items = grouped[category];
        return (
          <AccordionItem key={category} value={category}>
            <AccordionTrigger>
              <div className="flex items-center justify-between w-full">
                <span className="font-medium">{category}</span>
                <Badge variant="outline">{items.length} items</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="max-h-100 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Min</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.sku || '-'}</TableCell>
                        <TableCell>{Number(p.quantity ?? 0)}</TableCell>
                        <TableCell>{Number(p.min_stock_level ?? 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

