import type { DateRange } from 'react-day-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/shared/data-table/data-table';
import { ExportDialog } from '@/components/shared/export/ExportDialog';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { StatCard } from './components/StatCard';
import { useReportRpc } from './useReportRpc';
import { exportField, moneyColumn, numberColumn, searchColumn, textColumn } from './reportColumns';

interface ProductSalesRow {
  product_id: string | null;
  variant_id: string | null;
  label: string | null;
  name: string;
  variant: string | null;
  category: string;
  orders: number;
  quantity: number;
  gross: number;
  discounts: number;
  net: number;
}

interface ProductSalesReport {
  totals: { orders: number; quantity: number; gross: number; discounts: number; net: number };
  products: ProductSalesRow[];
  categories: { category: string; quantity: number; net: number }[];
}

const variantOf = (r: ProductSalesRow) => [r.variant, r.label].filter(Boolean).join(' · ');

const columns = [
  searchColumn<ProductSalesRow>((r) => [r.name, r.variant, r.label, r.category]),
  textColumn<ProductSalesRow>('name', 'Product', (r) => r.name),
  textColumn<ProductSalesRow>('variant', 'Variant', variantOf),
  textColumn<ProductSalesRow>('category', 'Category', (r) => r.category),
  numberColumn<ProductSalesRow>('quantity', 'Qty Sold', (r) => r.quantity),
  numberColumn<ProductSalesRow>('orders', 'Sales', (r) => r.orders),
  moneyColumn<ProductSalesRow>('gross', 'Gross', (r) => r.gross),
  moneyColumn<ProductSalesRow>('discounts', 'Discounts', (r) => r.discounts),
  moneyColumn<ProductSalesRow>('net', 'Net', (r) => r.net),
];

const exportFields = [
  exportField<ProductSalesRow>('name', 'Product', (r) => r.name),
  exportField<ProductSalesRow>('variant', 'Variant', variantOf),
  exportField<ProductSalesRow>('category', 'Category', (r) => r.category),
  exportField<ProductSalesRow>('quantity', 'Qty Sold', (r) => Number(r.quantity), 'number'),
  exportField<ProductSalesRow>('orders', 'Sales', (r) => Number(r.orders), 'number'),
  exportField<ProductSalesRow>('gross', 'Gross', (r) => Number(r.gross), 'currency'),
  exportField<ProductSalesRow>('discounts', 'Discounts', (r) => Number(r.discounts), 'currency'),
  exportField<ProductSalesRow>('net', 'Net', (r) => Number(r.net), 'currency'),
];

/** What sold in the period, by product, variant and stock label. */
export function ProductSalesSection({
  orgId,
  branchIds,
  dateRange,
  exportOpen,
  onExportClose,
}: {
  orgId?: string;
  branchIds: string[];
  dateRange?: DateRange;
  exportOpen: boolean;
  onExportClose: () => void;
}) {
  const { data, isLoading } = useReportRpc<ProductSalesReport>(
    'get_product_sales_report',
    orgId,
    branchIds,
    dateRange
  );
  const totals = data?.totals;

  return (
    <>
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <StatCard title="Items Sold" value={Number(totals?.quantity ?? 0)} />
        <StatCard title="Sales" value={Number(totals?.orders ?? 0)} />
        <StatCard title="Gross" value={<CurrencyDisplay amount={Number(totals?.gross ?? 0)} />} />
        <StatCard
          title="Discounts"
          value={<CurrencyDisplay amount={Number(totals?.discounts ?? 0)} />}
          valueClassName="text-orange-500"
        />
        <StatCard title="Net" value={<CurrencyDisplay amount={Number(totals?.net ?? 0)} />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <DataTable
              columns={columns}
              data={data?.products ?? []}
              searchKey="searchable"
              exportFields={exportFields}
              storageKey="reports-product-sales"
              defaultColumnVisibility={{ searchable: false }}
              orgId={orgId}
              canExport={false}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y text-sm">
            {(data?.categories ?? []).map((c) => (
              <div key={c.category} className="flex items-center justify-between gap-4 py-2">
                <span className="font-medium">{c.category}</span>
                <span className="flex gap-6 tabular-nums">
                  <span className="text-muted-foreground">{Number(c.quantity)} sold</span>
                  <CurrencyDisplay amount={Number(c.net)} />
                </span>
              </div>
            ))}
            {(data?.categories ?? []).length === 0 && (
              <p className="py-4 text-center text-muted-foreground">No sales</p>
            )}
          </div>
        </CardContent>
      </Card>
      <ExportDialog
        open={exportOpen}
        onOpenChange={(open) => !open && onExportClose()}
        data={data?.products ?? []}
        fields={exportFields}
        defaultFilename="product-sales"
      />
    </>
  );
}
