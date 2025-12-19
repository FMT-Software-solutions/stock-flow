import type { DataTableFilterField } from '@/types/data-table';
import type { ExportField } from '@/hooks/useExport';

export const getExpenseFilterFields = (
  categories: { label: string; value: string }[],
  types: { label: string; value: string }[],
  branches: { label: string; value: string }[],
  creators: { label: string; value: string }[],
  paymentMethods?: { label: string; value: string }[],
  statuses?: { label: string; value: string }[]
): DataTableFilterField[] => [
  {
    id: 'date',
    label: 'Date',
    type: 'date-range',
  },
  {
    id: 'categoryName',
    label: 'Category',
    type: 'select',
    options: categories,
  },
  {
    id: 'typeName',
    label: 'Type',
    type: 'select',
    options: types,
  },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: statuses || [
      { label: 'Pending', value: 'pending' },
      { label: 'Approved', value: 'approved' },
      { label: 'Paid', value: 'paid' },
      { label: 'Rejected', value: 'rejected' },
    ],
  },
  {
    id: 'paymentMethod',
    label: 'Payment Method',
    type: 'select',
    options: paymentMethods || [
      { label: 'Cash', value: 'cash' },
      { label: 'Mobile Money', value: 'mobile_money' },
      { label: 'Credit Card', value: 'credit_card' },
      { label: 'Bank Transfer', value: 'bank_transfer' },
      { label: 'Cheque', value: 'cheque' },
      { label: 'Other', value: 'other' },
    ],
  },
  {
    id: 'amount',
    label: 'Amount',
    type: 'number',
  },
  {
    id: 'branchName',
    label: 'Branch',
    type: 'select',
    options: branches,
  },
  {
    id: 'createdByName',
    label: 'Created By',
    type: 'select',
    options: creators,
  },
];

export const expenseExportFields: ExportField[] = [
  { id: 'date', label: 'Date', accessorFn: (row: any) => row.original.date },
  { id: 'description', label: 'Description', accessorFn: (row: any) => row.original.description },
  { id: 'amount', label: 'Amount', accessorFn: (row: any) => row.original.amount },
  { id: 'categoryName', label: 'Category', accessorFn: (row: any) => row.original.categoryName },
  { id: 'typeName', label: 'Type', accessorFn: (row: any) => row.original.typeName },
  { id: 'status', label: 'Status', accessorFn: (row: any) => row.original.status },
  { id: 'paymentMethod', label: 'Payment Method', accessorFn: (row: any) => row.original.paymentMethod },
  { id: 'branchName', label: 'Branch', accessorFn: (row: any) => row.original.branchName },
  { id: 'reference', label: 'Reference', accessorFn: (row: any) => row.original.reference, isSelectedByDefault: false },
  { id: 'createdByName', label: 'Created By', accessorFn: (row: any) => row.original.createdByName, isSelectedByDefault: false },
  { id: 'attachment', label: 'Attachment', accessorFn: (row: any) => row.original.attachment, type: 'image', isSelectedByDefault: false },
];
