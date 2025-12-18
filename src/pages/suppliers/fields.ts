import type { DataTableFilterField } from '@/types/data-table';
import type { ExportField } from '@/hooks/useExport';

export const supplierFilterFields: DataTableFilterField[] = [
  {
    id: 'contactPerson',
    label: 'Contact Person',
    type: 'text',
    placeholder: 'Filter by contact person...',
  },
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
      id: 'website',
      label: 'Website',
      type: 'text',
      placeholder: 'Filter by website...'
  }
];

export const supplierExportFields: ExportField[] = [
  {
    id: 'name',
    label: 'Company Name',
    accessorFn: (row: any) => row.original.name,
  },
  {
    id: 'contactPerson',
    label: 'Contact Person',
    accessorFn: (row: any) => row.original.contactPerson,
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
    id: 'address',
    label: 'Address',
    accessorFn: (row: any) => row.original.address,
    isSelectedByDefault: false,
  },
  {
    id: 'website',
    label: 'Website',
    accessorFn: (row: any) => row.original.website,
    isSelectedByDefault: false,
  },
];
