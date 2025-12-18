import type { DataTableFilterField } from '@/types/data-table';
import type { ExportField } from '@/hooks/useExport';

export const getProductFilterFields = (
  categories: { label: string; value: string }[],
  statuses: { label: string; value: string }[],
  productCreators: { label: string; value: string }[]
): DataTableFilterField[] => [
  {
    id: 'category',
    label: 'Category',
    type: 'select',
    options: categories,
  },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: statuses,
  },
  {
    id: 'sellingPrice',
    label: 'Price',
    type: 'number',
  },
  {
    id: 'quantity',
    label: 'Stock',
    type: 'number',
  },
  {
    id: 'createdByName',
    label: 'Created By',
    type: 'select',
    options: productCreators,
  },
  {
    id: 'createdAt',
    label: 'Created At',
    type: 'date-range',
  },
];

export const productExportFields: ExportField[] = [
  {
    id: 'imageUrl',
    label: 'Image',
    accessorFn: (row: any) => row.original.imageUrl,
    isSelectedByDefault: false,
    type: 'image',
  },
  { id: 'name', label: 'Name', accessorFn: (row: any) => row.original.name },
  { id: 'sku', label: 'SKU', accessorFn: (row: any) => row.original.sku },
  {
    id: 'category',
    label: 'Category',
    accessorFn: (row: any) => row.original.category?.name,
  },
  {
    id: 'sellingPrice',
    label: 'Price',
    accessorFn: (row: any) => row.original.sellingPrice,
  },
  {
    id: 'quantity',
    label: 'Stock',
    accessorFn: (row: any) => row.original.quantity,
  },
  {
    id: 'status',
    label: 'Status',
    accessorFn: (row: any) => row.original.status,
  },
  {
    id: 'createdByName',
    label: 'Created By',
    accessorFn: (row: any) => row.original.createdByName,
    isSelectedByDefault: false,
  },
  {
    id: 'createdAt',
    label: 'Created At',
    accessorFn: (row: any) => row.original.createdAt,
    isSelectedByDefault: false,
  },
];
