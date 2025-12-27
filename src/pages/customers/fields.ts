import type { DataTableFilterField } from '@/types/data-table';
import type { ExportField } from '@/hooks/useExport';

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
    id: 'totalSpent',
    label: 'Total Spent',
    type: 'number',
  },
  {
    id: 'createdAt',
    label: 'Joined Date',
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
    id: 'totalSpent',
    label: 'Total Spent',
    accessorFn: (row: any) => row.original.totalSpent,
  },
  {
    id: 'createdAt',
    label: 'Joined Date',
    accessorFn: (row: any) => row.original.createdAt,
  },
];
