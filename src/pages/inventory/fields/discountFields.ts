import type { ExportField } from '@/hooks/useExport';

export const discountExportFields: ExportField[] = [
    { id: 'name', label: 'Name', accessorFn: (row: any) => row.original.name },
    { id: 'code', label: 'Code', accessorFn: (row: any) => row.original.code },
    { id: 'type', label: 'Type', accessorFn: (row: any) => row.original.type },
    {
        id: 'value',
        label: 'Value',
        accessorFn: (row: any) =>
            row.original.type === 'percentage'
                ? `${row.original.value}%`
                : row.original.value,
    },
    {
        id: 'isActive',
        label: 'Status',
        accessorFn: (row: any) => (row.original.isActive ? 'Active' : 'Inactive'),
    },
    {
        id: 'description',
        label: 'Description',
        accessorFn: (row: any) => row.original.description,
        isSelectedByDefault: false,
    },
    {
        id: 'startAt',
        label: 'Start Date',
        accessorFn: (row: any) => row.original.startAt,
        isSelectedByDefault: false,
    },
    {
        id: 'expiresAt',
        label: 'End Date',
        accessorFn: (row: any) => row.original.expiresAt,
        isSelectedByDefault: false,
    },
    {
        id: 'createdAt',
        label: 'Created At',
        accessorFn: (row: any) => row.original.createdAt,
        isSelectedByDefault: false,
    },
    {
        id: 'updatedAt',
        label: 'Updated At',
        accessorFn: (row: any) => row.original.updatedAt,
        isSelectedByDefault: false,
    },
    {
        id: 'usageMode',
        label: 'Mode',
        accessorFn: (row: any) =>
            (row.original.usageMode ?? 'manual') === 'automatic' ? 'Automatic' : 'Manual',
    },
    {
        id: 'usageLimit',
        label: 'Usage Limit',
        accessorFn: (row: any) =>
            row.original.usageLimit != null ? row.original.usageLimit : 'Unlimited',
    },
];
