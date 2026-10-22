import type { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/shared/data-table/data-table';
import { ExportDialog } from '@/components/shared/export/ExportDialog';
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { StatCard } from './components/StatCard';
import { useReportRpc } from './useReportRpc';
import { exportField, moneyColumn, numberColumn, searchColumn, textColumn } from './reportColumns';

type Kind = 'automatic' | 'code' | 'manual';

const KIND_LABEL: Record<Kind, string> = {
  automatic: 'Automatic',
  code: 'Code',
  manual: 'Manual',
};

interface DiscountRow {
  discount_id: string | null;
  kind: Kind;
  name: string;
  code: string | null;
  given_by: string | null;
  orders: number;
  amount: number;
  sales: number;
  last_used: string;
}

interface DiscountsReport {
  totals: { amount: number; orders: number; automatic: number; code: number; manual: number };
  discounts: DiscountRow[];
}

const discountName = (r: DiscountRow) => (r.kind === 'manual' && r.given_by ? `${r.name} · ${r.given_by}` : r.name);

const columns: ColumnDef<DiscountRow>[] = [
  searchColumn<DiscountRow>((r) => [r.name, r.code, r.given_by, KIND_LABEL[r.kind]]),
  textColumn<DiscountRow>('name', 'Discount', discountName),
  {
    id: 'kind',
    accessorFn: (r) => KIND_LABEL[r.kind] ?? r.kind,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    cell: ({ getValue }) => <Badge variant="outline">{getValue() as string}</Badge>,
  },
  textColumn<DiscountRow>('code', 'Code', (r) => r.code),
  numberColumn<DiscountRow>('orders', 'Uses', (r) => r.orders),
  moneyColumn<DiscountRow>('amount', 'Given', (r) => r.amount),
  moneyColumn<DiscountRow>('sales', 'Sales', (r) => r.sales),
  {
    id: 'last_used',
    accessorFn: (r) => r.last_used,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last Used" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {format(new Date(row.original.last_used), 'dd MMM yyyy')}
      </span>
    ),
  },
];

const exportFields = [
  exportField<DiscountRow>('name', 'Discount', discountName),
  exportField<DiscountRow>('kind', 'Type', (r) => KIND_LABEL[r.kind as Kind] ?? r.kind),
  exportField<DiscountRow>('code', 'Code', (r) => r.code ?? ''),
  exportField<DiscountRow>('orders', 'Uses', (r) => Number(r.orders), 'number'),
  exportField<DiscountRow>('amount', 'Given', (r) => Number(r.amount), 'currency'),
  exportField<DiscountRow>('sales', 'Sales', (r) => Number(r.sales), 'currency'),
  exportField<DiscountRow>('last_used', 'Last Used', (r) => format(new Date(r.last_used), 'yyyy-MM-dd')),
];

/** What each discount gave away in the period. */
export function DiscountsSection({
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
  const { data, isLoading } = useReportRpc<DiscountsReport>('get_discounts_report', orgId, branchIds, dateRange);
  const totals = data?.totals;

  return (
    <>
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <StatCard
          title="Discounts Given"
          value={<CurrencyDisplay amount={Number(totals?.amount ?? 0)} />}
          valueClassName="text-orange-500"
        />
        <StatCard title="Sales with Discount" value={Number(totals?.orders ?? 0)} />
        <StatCard title="Automatic" value={<CurrencyDisplay amount={Number(totals?.automatic ?? 0)} />} />
        <StatCard title="Codes" value={<CurrencyDisplay amount={Number(totals?.code ?? 0)} />} />
        <StatCard title="Manual" value={<CurrencyDisplay amount={Number(totals?.manual ?? 0)} />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Discounts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <DataTable
              columns={columns}
              data={data?.discounts ?? []}
              searchKey="searchable"
              exportFields={exportFields}
              storageKey="reports-discounts"
              defaultColumnVisibility={{ searchable: false }}
              orgId={orgId}
              canExport={false}
            />
          )}
        </CardContent>
      </Card>
      <ExportDialog
        open={exportOpen}
        onOpenChange={(open) => !open && onExportClose()}
        data={data?.discounts ?? []}
        fields={exportFields}
        defaultFilename="discounts"
      />
    </>
  );
}
