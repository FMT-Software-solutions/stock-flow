import type { ExportField } from '@/hooks/useExport';
import type { Discount } from '@/types/discounts';
import { DISCOUNT_STATUS_LABEL, describeDiscountScope } from '@/lib/discounts';

type Row = { original: Discount };

const VALUE_TYPE_LABEL: Record<Discount['valueType'], string> = {
  percentage: '% off',
  fixed_amount: 'Amount off',
  fixed_price: 'Fixed price',
};

export const discountExportFields: ExportField[] = [
  { id: 'name', label: 'Name', accessorFn: (row: Row) => row.original.name },
  { id: 'method', label: 'Method', accessorFn: (row: Row) => (row.original.method === 'code' ? 'Code' : 'Automatic') },
  { id: 'code', label: 'Code', accessorFn: (row: Row) => row.original.code ?? '' },
  { id: 'type', label: 'Type', accessorFn: (row: Row) => VALUE_TYPE_LABEL[row.original.valueType] },
  { id: 'value', label: 'Value', accessorFn: (row: Row) => row.original.value },
  { id: 'scope', label: 'Applies to', accessorFn: (row: Row) => describeDiscountScope(row.original) },
  { id: 'status', label: 'Status', accessorFn: (row: Row) => DISCOUNT_STATUS_LABEL[row.original.status] },
  { id: 'uses', label: 'Uses', accessorFn: (row: Row) => row.original.uses },
  {
    id: 'usageLimit',
    label: 'Usage Limit',
    accessorFn: (row: Row) => row.original.usageLimit ?? 'Unlimited',
  },
  { id: 'amountGiven', label: 'Given', accessorFn: (row: Row) => row.original.amountGiven },
  { id: 'startsAt', label: 'Starts', accessorFn: (row: Row) => row.original.startsAt ?? '', isSelectedByDefault: false },
  { id: 'endsAt', label: 'Ends', accessorFn: (row: Row) => row.original.endsAt ?? '', isSelectedByDefault: false },
  { id: 'createdAt', label: 'Created At', accessorFn: (row: Row) => row.original.createdAt, isSelectedByDefault: false },
];
