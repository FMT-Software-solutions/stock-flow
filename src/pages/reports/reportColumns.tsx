import type { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import type { ExportField } from '@/hooks/useExport';

// Column builders for the report tables, so every report reads the same:
// text left, numbers and money right-aligned with tabular figures.

export function textColumn<T>(id: string, title: string, get: (row: T) => string | null | undefined): ColumnDef<T> {
  return {
    id,
    accessorFn: (row) => get(row) ?? '',
    header: ({ column }) => <DataTableColumnHeader column={column} title={title} />,
    cell: ({ getValue }) => (getValue() as string) || '-',
  };
}

export function numberColumn<T>(
  id: string,
  title: string,
  get: (row: T) => number | null | undefined,
  options: { signed?: boolean } = {}
): ColumnDef<T> {
  return {
    id,
    accessorFn: (row) => Number(get(row) ?? 0),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={title} className="justify-end" />
    ),
    cell: ({ getValue }) => {
      const value = getValue() as number;
      return (
        <div className="text-right tabular-nums">
          {options.signed && value > 0 ? `+${value}` : value}
        </div>
      );
    },
  };
}

export function moneyColumn<T>(id: string, title: string, get: (row: T) => number | null | undefined): ColumnDef<T> {
  return {
    id,
    accessorFn: (row) => Number(get(row) ?? 0),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={title} className="justify-end" />
    ),
    cell: ({ getValue }) => (
      <div className="text-right tabular-nums">
        <CurrencyDisplay amount={getValue() as number} />
      </div>
    ),
  };
}

/**
 * Column the table's search box filters on; hide it with
 * defaultColumnVisibility={{ searchable: false }}, as the other tables do.
 */
export function searchColumn<T>(get: (row: T) => (string | null | undefined)[]): ColumnDef<T> {
  return {
    id: 'searchable',
    accessorFn: (row) => get(row).filter(Boolean).join(' '),
    enableHiding: true,
    enableSorting: false,
    header: () => null,
    cell: () => null,
  };
}

export function exportField<T>(
  id: string,
  label: string,
  accessorFn: (row: T) => unknown,
  type: ExportField['type'] = 'text'
): ExportField {
  return { id, label, accessorFn: accessorFn as ExportField['accessorFn'], type };
}
