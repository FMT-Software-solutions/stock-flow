import type { DataTableFilterField } from '@/types/data-table';
import type { ExportField } from '@/hooks/useExport';
import { orderStatuses } from '@/constants/order-statuses';
import { paymentStatuses } from '@/constants/payment-statuses';
import type { DateRange } from 'react-day-picker';

export const getOrderFilterFields = (
  branches: { label: string; value: string }[],
  customers: { label: string; value: string }[],
  paymentMethods: { label: string; value: string }[],
  dateConstraints?: { minDate?: Date; maxDate?: Date; defaultValue?: DateRange }
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
      options: orderStatuses,
    },
    {
      id: 'paymentStatus',
      label: 'Payment Status',
      type: 'select',
      options: paymentStatuses,
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
      minDate: dateConstraints?.minDate,
      maxDate: dateConstraints?.maxDate,
      defaultValue: dateConstraints?.defaultValue,
    },
    {
      id: 'createdAt',
      label: 'Created Date',
      type: 'date-range',
      minDate: dateConstraints?.minDate,
      maxDate: dateConstraints?.maxDate,
    },
    {
      id: 'updatedAt',
      label: 'Updated Date',
      type: 'date-range',
      minDate: dateConstraints?.minDate,
      maxDate: dateConstraints?.maxDate,
    },
  ];

export const orderExportFields: ExportField[] = [
  { id: 'orderNumber', label: 'Order No.', accessorFn: (row: any) => row.original.order_number },
  { id: 'date', label: 'Date', accessorFn: (row: any) => row.original.date },
  {
    id: 'items',
    label: 'Items',
    accessorFn: (row: any) => {
      const items = row.original.items || [];
      if (!Array.isArray(items) || items.length === 0) return '';
      return items
        .map((i: any) => {
          const qty = i.quantity ?? 0;
          const unit = i.unit_price ?? 0;
          const name = i.product_name ?? '';
          return `${name} x ${qty} @ ${unit}`;
        })
        .join(' | ');
    }
  },
  { id: 'customer', label: 'Customer', accessorFn: (row: any) => row.original.customer ? `${row.original.customer.first_name || ''} ${row.original.customer.last_name || ''}`.trim() : '' },
  { id: 'totalAmount', label: 'Total', accessorFn: (row: any) => row.original.total_amount },
  { id: 'status', label: 'Order Status', accessorFn: (row: any) => row.original.status, isSelectedByDefault: false },
  { id: 'paymentStatus', label: 'Payment Status', accessorFn: (row: any) => row.original.payment_status },
  { id: 'paymentMethod', label: 'Payment Method', accessorFn: (row: any) => row.original.payment_method || '', isSelectedByDefault: false },
  { id: 'branchName', label: 'Branch', accessorFn: (row: any) => row.original.branch?.name || '' },
  { id: 'createdAt', label: 'Created At', accessorFn: (row: any) => row.original.created_at, isSelectedByDefault: false },
  { id: 'updatedAt', label: 'Updated At', accessorFn: (row: any) => row.original.updated_at, isSelectedByDefault: false },
  { id: 'notes', label: 'Notes', accessorFn: (row: any) => row.original.notes || '', isSelectedByDefault: false },
];

export const customerOrderExportFields: ExportField[] = [
  { id: 'orderNumber', label: 'Order No.', accessorFn: (row: any) => row.original.order_number },
  { id: 'date', label: 'Date', accessorFn: (row: any) => row.original.date },
  {
    id: 'items',
    label: 'Items',
    accessorFn: (row: any) => {
      const items = row.original.items || [];
      if (!Array.isArray(items) || items.length === 0) return '';
      return items
        .map((i: any) => {
          const qty = i.quantity ?? 0;
          const unit = i.unit_price ?? 0;
          const name = i.product_name ?? '';
          return `${name} x ${qty} @ ${unit}`;
        })
        .join(' | ');
    }
  },

  { id: 'totalAmount', label: 'Total', accessorFn: (row: any) => row.original.total_amount },
  { id: 'status', label: 'Order Status', accessorFn: (row: any) => row.original.status, isSelectedByDefault: false },
  { id: 'paymentStatus', label: 'Payment Status', accessorFn: (row: any) => row.original.payment_status },
  { id: 'paymentMethod', label: 'Payment Method', accessorFn: (row: any) => row.original.payment_method || '', isSelectedByDefault: false },
];
