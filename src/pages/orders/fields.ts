import type { DataTableFilterField } from '@/types/data-table';
import type { ExportField } from '@/hooks/useExport';
import type { StatsGroup } from '@/types/stats';
import type { Order } from '@/types/orders';
import { orderStatuses } from '@/constants/order-statuses';
import { paymentStatuses } from '@/constants/payment-statuses';
import { ShoppingCart, DollarSign, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

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

export const getOrderStatsGroups = (
  formatCurrency: (amount: number) => string
): StatsGroup<Order>[] => [
    {
      id: 'orders_overview',
      title: 'Orders Overview',
      icon: ShoppingCart,
      fields: [
        {
          id: 'total_orders',
          label: 'Total Orders',
          calculate: (data) => ({ value: data.length }),
        },
        {
          id: 'completed_orders',
          label: 'Completed',
          calculate: (data) => {
            const completed = data.filter(
              (o) => String(o.status || '').toLowerCase() === 'completed'
            ).length;
            const pct = `${(
              (completed / (data.length || 1)) *
              100
            ).toFixed(0)}%`;
            return { value: completed, subValue: pct };
          },
          className: 'text-green-600',
        },
        {
          id: 'pending_processing',
          label: 'Pending / Processing',
          calculate: (data) => ({
            value: data.filter((o) => {
              const s = String(o.status || '').toLowerCase();
              return s === 'pending' || s === 'processing';
            }).length,
          }),
        },
        {
          id: 'cancelled_refunded',
          label: 'Cancelled / Refunded',
          calculate: (data) => ({
            value: data.filter((o) => {
              const s = String(o.status || '').toLowerCase();
              return s === 'cancelled' || s === 'canceled' || s === 'refunded';
            }).length,
          }),
          className: 'text-red-600',
        },
      ],
    },
    {
      id: 'revenue',
      title: 'Revenue',
      icon: DollarSign,
      fields: [
        {
          id: 'paid_revenue',
          label: 'Revenue',
          calculate: (data) => {
            const total = data.reduce((sum, o) => {
              const val = o.paid_amount as unknown as number | string | undefined;
              const amount = typeof val === 'string' ? parseFloat(val) : val ?? 0;
              return sum + (isNaN(Number(amount)) ? 0 : Number(amount));
            }, 0);
            const paidCount = data.filter(
              (o) => Number(o.paid_amount ?? 0) > 0
            ).length;
            return {
              value: formatCurrency(total),
              subValue: `${paidCount} orders`,
            };
          },
        },
        {
          id: 'owings',
          label: 'Owings',
          calculate: (data) => {
            const totalOwings = data.reduce((sum, o) => {
              const paymentStatus = String(o.payment_status || '').toLowerCase();
              const status = String(o.status || '').toLowerCase();
              if (paymentStatus === 'refunded' || status === 'cancelled') return sum;
              const totalVal = o.total_amount as unknown as number | string | undefined;
              const paidVal = o.paid_amount as unknown as number | string | undefined;
              const totalAmt = typeof totalVal === 'string' ? parseFloat(totalVal) : totalVal ?? 0;
              const paidAmt = typeof paidVal === 'string' ? parseFloat(paidVal) : paidVal ?? 0;
              const diff = Number(totalAmt) - Number(paidAmt);
              return sum + (diff > 0 ? diff : 0);
            }, 0);
            return { value: formatCurrency(totalOwings) };
          },
          className: 'text-amber-600',
        },
        {
          id: 'refunds',
          label: 'Refunds',
          calculate: (data) => {
            const totalRefunds = data.reduce((sum, o) => {
              const paymentStatus = String(o.payment_status || '').toLowerCase();
              if (paymentStatus !== 'refunded') return sum;
              const val = o.total_amount as unknown as number | string | undefined;
              const amount = typeof val === 'string' ? parseFloat(val) : val ?? 0;
              return sum + (isNaN(Number(amount)) ? 0 : Number(amount));
            }, 0);
            return { value: formatCurrency(totalRefunds) };
          },
          className: 'text-red-600',
        },
        {
          id: 'avg_order_value',
          label: 'Avg Order Value',
          calculate: (data) => {
            const completed = data.filter(
              (o) => String(o.status || '').toLowerCase() === 'completed'
            );
            const sum = completed.reduce((acc, o) => {
              const val = o.total_amount as unknown as number | string | undefined;
              const amount =
                typeof val === 'string' ? parseFloat(val) : val ?? 0;
              return acc + (isNaN(Number(amount)) ? 0 : Number(amount));
            }, 0);
            const avg = completed.length ? sum / completed.length : 0;
            return { value: formatCurrency(avg) };
          },
        },
      ],
    },
    {
      id: 'recent',
      title: 'Recent Activity',
      icon: Clock,
      fields: [
        {
          id: 'last_order',
          label: 'Last Order Entry',
          calculate: (data) => {
            if (data.length === 0) return { value: '-' };
            const timestamps = data
              .map((o) => new Date(o.date).getTime())
              .filter((t) => !Number.isNaN(t));
            if (timestamps.length === 0) return { value: '-' };
            const lastTs = Math.max(...timestamps);
            const lastDate = new Date(lastTs);
            const formatted = format(lastDate, 'MMM dd, yyyy h:mm a');
            let rel = formatDistanceToNow(lastDate, { addSuffix: true });
            if (
              rel === 'in less than a minute' ||
              rel === 'less than a minute ago'
            ) {
              rel = 'now';
            }
            return { value: formatted, subValue: rel };
          },
        },
      ],
    },
  ];
