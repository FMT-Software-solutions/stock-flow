import type { DataTableFilterField } from '@/types/data-table';
import type { ExportField } from '@/hooks/useExport';

export const getInventoryFilterFields = (
  productNames: { label: string; value: string }[],
  categories: { label: string; value: string }[],
  branches: { label: string; value: string }[],
  locations: { label: string; value: string }[],
  creators: { label: string; value: string }[]
): DataTableFilterField[] => [
    {
      id: 'productName',
      label: 'Product',
      type: 'select',
      options: productNames,
    },
    {
      id: 'categoryName',
      label: 'Category',
      type: 'select',
      options: categories,
    },
    {
      id: 'branchName',
      label: 'Branch',
      type: 'select',
      options: branches,
    },
    {
      id: 'effectivePrice',
      label: 'Price',
      type: 'number',
    },
    {
      id: 'quantity',
      label: 'Stock',
      type: 'number',
    },
    {
      id: 'location',
      label: 'Location',
      type: 'select',
      options: locations,
    },
    {
      id: 'createdByName',
      label: 'Created By',
      type: 'select',
      options: creators,
    },
    {
      id: 'lastUpdated',
      label: 'Last Updated',
      type: 'date-range',
    },
  ];

export const inventoryExportFields: ExportField[] = [
  {
    id: 'imageUrl',
    label: 'Image',
    accessorFn: (row: any) =>
      row.original.imageUrl || row.original.productImage,
    isSelectedByDefault: false,
    type: 'image',
  },
  {
    id: 'inventoryNumber',
    label: 'Inventory Number',
    accessorFn: (row: any) => row.original.inventoryNumber,
  },
  {
    id: 'productName',
    label: 'Product',
    accessorFn: (row: any) => row.original.productName,
  },
  { id: 'sku', label: 'SKU', accessorFn: (row: any) => row.original.sku },
  {
    id: 'branchName',
    label: 'Branch',
    accessorFn: (row: any) => row.original.branchName,
  },
  {
    id: 'location',
    label: 'Location',
    accessorFn: (row: any) => row.original.location,
  },
  {
    id: 'quantity',
    label: 'Stock',
    accessorFn: (row: any) => row.original.quantity,
  },
  {
    id: 'createdByName',
    label: 'Created By',
    accessorFn: (row: any) => row.original.createdByName,
    isSelectedByDefault: false,
  },
  {
    id: 'lastUpdated',
    label: 'Last Updated Date',
    accessorFn: (row: any) => row.original.lastUpdated,
    isSelectedByDefault: false,
  },
];



