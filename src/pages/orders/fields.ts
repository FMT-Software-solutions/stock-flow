import type { DataTableFilterField } from '@/types/data-table';
import type { ExportField } from '@/hooks/useExport';

export const getOrderFilterFields = (
  branches: { label: string; value: string }[],
  customers: { label: string; value: string }[],
  paymentMethods: { label: string; value: string }[]
): DataTableFilterField[] => [
  {
    id: 'totalAmount',
    label: 'Total Amount',
    type: 'number',
  },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Processing', value: 'processing' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Refunded', value: 'refunded' },
    ],
  },
  {
    id: 'paymentStatus',
    label: 'Payment Status',
    type: 'select',
    options: [
        { label: 'Paid', value: 'paid' },
        { label: 'Unpaid', value: 'unpaid' },
        { label: 'Partial', value: 'partial' },
        { label: 'Refunded', value: 'refunded' },
    ],
  },
  {
    id: 'paymentMethod',
    label: 'Payment Method',
    type: 'select',
    options: paymentMethods,
  },
  {
    id: 'branchName',
    label: 'Branch',
    type: 'select',
    options: branches,
  },
  {
    id: 'customer',
    label: 'Customer',
    type: 'select',
    options: customers,
  },
  {
    id: 'date',
    label: 'Order Date',
    type: 'date-range',
  },
  {
    id: 'createdAt',
    label: 'Created Date',
    type: 'date-range',
  },
  {
    id: 'updatedAt',
    label: 'Updated Date',
    type: 'date-range',
  },
];

export const orderExportFields: ExportField[] = [
  { id: 'orderNumber', label: 'Order #', accessorFn: (row: any) => row.original.order_number },
  { id: 'date', label: 'Date', accessorFn: (row: any) => row.original.date },
  { id: 'customer', label: 'Customer', accessorFn: (row: any) => row.original.customer ? `${row.original.customer.first_name || ''} ${row.original.customer.last_name || ''}`.trim() : '' },
  { id: 'totalAmount', label: 'Total', accessorFn: (row: any) => row.original.total_amount },
  { id: 'status', label: 'Status', accessorFn: (row: any) => row.original.status },
  { id: 'paymentStatus', label: 'Payment Status', accessorFn: (row: any) => row.original.payment_status },
  { id: 'paymentMethod', label: 'Payment Method', accessorFn: (row: any) => row.original.payment_method || '' },
  { id: 'branchName', label: 'Branch', accessorFn: (row: any) => row.original.branch?.name || '' },
  { id: 'createdAt', label: 'Created At', accessorFn: (row: any) => row.original.created_at, isSelectedByDefault: false },
  { id: 'updatedAt', label: 'Updated At', accessorFn: (row: any) => row.original.updated_at, isSelectedByDefault: false },
  { id: 'notes', label: 'Notes', accessorFn: (row: any) => row.original.notes || '', isSelectedByDefault: false },
];
