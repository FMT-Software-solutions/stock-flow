import type { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/shared/data-table/data-table';
import { ExportDialog } from '@/components/shared/export/ExportDialog';
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header';
import type { ColumnDef } from '@tanstack/react-table';
import { StatCard } from './components/StatCard';
import { useReportRpc } from './useReportRpc';
import { exportField, numberColumn, searchColumn, textColumn } from './reportColumns';

type Reason =
  | 'opening'
  | 'received'
  | 'count'
  | 'damaged'
  | 'correction'
  | 'return'
  | 'sale'
  | 'sale_reversal'
  | 'edit'
  | 'other';

const REASON_LABEL: Record<Reason, string> = {
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

interface ActivityItem {
  inventory_id: string;
  name: string;
  variant: string | null;
  label: string | null;
  branch_name: string | null;
  received: number | null;
  sold: number | null;
  returned: number | null;
  damaged: number | null;
  adjusted: number | null;
  net_change: number;
  closing: number;
}

interface ActivityMove {
  id: string;
  created_at: string;
  name: string;
  variant: string | null;
  label: string | null;
  branch_name: string | null;
  reason: Reason;
  change: number;
  quantity_after: number;
  note: string | null;
  order_number: string | null;
  created_by_name: string | null;
}

interface StockActivityReport {
  by_reason: Partial<Record<Reason, number>>;
  items: ActivityItem[];
  recent: ActivityMove[];
}

const variantOf = (r: { variant: string | null; label: string | null }) =>
  [r.variant, r.label].filter(Boolean).join(' · ');

const itemColumns = [
  searchColumn<ActivityItem>((r) => [r.name, r.variant, r.label, r.branch_name]),
  textColumn<ActivityItem>('name', 'Product', (r) => r.name),
  textColumn<ActivityItem>('variant', 'Variant', variantOf),
  textColumn<ActivityItem>('branch', 'Branch', (r) => r.branch_name),
  numberColumn<ActivityItem>('received', 'Received', (r) => r.received),
  numberColumn<ActivityItem>('sold', 'Sold', (r) => r.sold),
  numberColumn<ActivityItem>('returned', 'Returned', (r) => r.returned),
  numberColumn<ActivityItem>('damaged', 'Damaged', (r) => r.damaged),
  numberColumn<ActivityItem>('adjusted', 'Adjusted', (r) => r.adjusted, { signed: true }),
  numberColumn<ActivityItem>('net_change', 'Net Change', (r) => r.net_change, { signed: true }),
  numberColumn<ActivityItem>('closing', 'Closing', (r) => r.closing),
];

const itemExportFields = [
  exportField<ActivityItem>('name', 'Product', (r) => r.name),
  exportField<ActivityItem>('variant', 'Variant', variantOf),
  exportField<ActivityItem>('branch', 'Branch', (r) => r.branch_name ?? ''),
  exportField<ActivityItem>('received', 'Received', (r) => Number(r.received ?? 0), 'number'),
  exportField<ActivityItem>('sold', 'Sold', (r) => Number(r.sold ?? 0), 'number'),
  exportField<ActivityItem>('returned', 'Returned', (r) => Number(r.returned ?? 0), 'number'),
  exportField<ActivityItem>('damaged', 'Damaged', (r) => Number(r.damaged ?? 0), 'number'),
  exportField<ActivityItem>('adjusted', 'Adjusted', (r) => Number(r.adjusted ?? 0), 'number'),
  exportField<ActivityItem>('net_change', 'Net Change', (r) => Number(r.net_change), 'number'),
  exportField<ActivityItem>('closing', 'Closing', (r) => Number(r.closing), 'number'),
];

const moveColumns: ColumnDef<ActivityMove>[] = [
  searchColumn<ActivityMove>((r) => [r.name, r.variant, r.label, r.branch_name, r.note, r.order_number, r.created_by_name]),
  {
    id: 'created_at',
    accessorFn: (r) => r.created_at,
    header: ({ column }) => <DataTableColumnHeader column={column} title="When" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {format(new Date(row.original.created_at), 'dd MMM yyyy, HH:mm')}
      </span>
    ),
  },
  textColumn<ActivityMove>('name', 'Product', (r) => r.name),
  textColumn<ActivityMove>('variant', 'Variant', variantOf),
  textColumn<ActivityMove>('branch', 'Branch', (r) => r.branch_name),
  {
    id: 'reason',
    accessorFn: (r) => REASON_LABEL[r.reason] ?? r.reason,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Reason" />,
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1">
        <Badge variant="outline">{REASON_LABEL[row.original.reason] ?? row.original.reason}</Badge>
        {row.original.order_number && <span className="text-xs">{row.original.order_number}</span>}
      </div>
    ),
  },
  numberColumn<ActivityMove>('change', 'Change', (r) => r.change, { signed: true }),
  numberColumn<ActivityMove>('quantity_after', 'After', (r) => r.quantity_after),
  textColumn<ActivityMove>('note', 'Note', (r) => r.note),
  textColumn<ActivityMove>('by', 'By', (r) => r.created_by_name),
];

const moveExportFields = [
  exportField<ActivityMove>('created_at', 'When', (r) => format(new Date(r.created_at), 'yyyy-MM-dd HH:mm')),
  exportField<ActivityMove>('name', 'Product', (r) => r.name),
  exportField<ActivityMove>('variant', 'Variant', variantOf),
  exportField<ActivityMove>('branch', 'Branch', (r) => r.branch_name ?? ''),
  exportField<ActivityMove>('reason', 'Reason', (r) => REASON_LABEL[r.reason as Reason] ?? r.reason),
  exportField<ActivityMove>('order', 'Sale', (r) => r.order_number ?? ''),
  exportField<ActivityMove>('change', 'Change', (r) => Number(r.change), 'number'),
  exportField<ActivityMove>('quantity_after', 'After', (r) => Number(r.quantity_after), 'number'),
  exportField<ActivityMove>('note', 'Note', (r) => r.note ?? ''),
  exportField<ActivityMove>('by', 'By', (r) => r.created_by_name ?? ''),
];

/** Stock in and out over the period, from the stock history. */
export function StockActivitySection({
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
  const { data, isLoading } = useReportRpc<StockActivityReport>(
    'get_stock_activity_report',
    orgId,
    branchIds,
    dateRange
  );
  const r = data?.by_reason ?? {};
  const sum = (...keys: Reason[]) => keys.reduce((total, k) => total + Number(r[k] ?? 0), 0);

  return (
    <>
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <StatCard title="Received" value={sum('opening', 'received')} valueClassName="text-green-600" />
        <StatCard title="Sold" value={-sum('sale', 'sale_reversal')} />
        <StatCard title="Returned" value={sum('return')} />
        <StatCard title="Damaged" value={-sum('damaged')} valueClassName="text-red-500" />
        <StatCard title="Adjusted" value={sum('count', 'correction', 'edit', 'other')} valueClassName="text-orange-500" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By Item</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <DataTable
              columns={itemColumns}
              data={data?.items ?? []}
              searchKey="searchable"
              exportFields={itemExportFields}
              storageKey="reports-stock-activity-items"
              defaultColumnVisibility={{ searchable: false }}
              orgId={orgId}
              canExport={false}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Changes</CardTitle>
        </CardHeader>
        <CardContent>
          {!isLoading && (
            <DataTable
              columns={moveColumns}
              data={data?.recent ?? []}
              searchKey="searchable"
              exportFields={moveExportFields}
              storageKey="reports-stock-activity-changes"
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
        data={data?.items ?? []}
        fields={itemExportFields}
        defaultFilename="stock-activity"
      />
    </>
  );
}
