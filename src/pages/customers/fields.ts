import type { DataTableFilterField } from '@/types/data-table';
import type { ExportField } from '@/hooks/useExport';
import { orderStatuses } from '@/constants/order-statuses';
import { paymentStatuses } from '@/constants/payment-statuses';

export const getCustomerFilterFields = (
  branches: { label: string; value: string }[]
): DataTableFilterField[] => [
    {
      id: 'email',
      label: 'Email',
      type: 'text',
      placeholder: 'Filter by email...',
    },
    {
      id: 'phone',
      label: 'Phone',
      type: 'text',
      placeholder: 'Filter by phone...',
    },
    {
      id: 'branchName',
      label: 'Branch',
      type: 'select',
      options: branches,
    },
    {
      id: 'totalOrders',
      label: 'Total Orders',
      type: 'number',
    },
    {
      id: 'createdAt',
      label: 'Created Date',
      type: 'date-range',
    },
  ];

export const customerExportFields: ExportField[] = [
  {
    id: 'firstName',
    label: 'First Name',
    accessorFn: (row: any) => row.original.firstName,
  },
  {
    id: 'lastName',
    label: 'Last Name',
    accessorFn: (row: any) => row.original.lastName,
  },
  {
    id: 'email',
    label: 'Email',
    accessorFn: (row: any) => row.original.email,
  },
  {
    id: 'phone',
    label: 'Phone',
    accessorFn: (row: any) => row.original.phone,
  },
  {
    id: 'branchName',
    label: 'Branch',
    accessorFn: (row: any) => row.original.branchName,
  },
  {
    id: 'totalOrders',
    label: 'Total Orders',
    accessorFn: (row: any) => row.original.totalOrders,
  },
  {
    id: 'createdAt',
    label: 'Created Date',
    accessorFn: (row: any) => row.original.createdAt,
  },
];


export const getCustomerOrderFilterFields = (
  branches: { label: string; value: string }[],
  paymentMethods: { label: string; value: string }[]
): DataTableFilterField[] => [
    {
      id: 'orderNumber',
      label: 'Order Number',
      type: 'text',
      placeholder: 'Filter by order number...',
    },
    {
      id: 'date',
      label: 'Order Date',
      type: 'date-range',
    },
    {
      id: 'totalAmount',
      label: 'Total Amount',
      type: 'number',
    },

    {
      id: 'branchName',
      label: 'Branch',
      type: 'select',
      options: branches,
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
  ];
