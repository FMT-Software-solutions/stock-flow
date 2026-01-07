import { useState, useEffect } from 'react';
import { type Table, type Row } from '@tanstack/react-table';
import { useDebounceValue } from '@/hooks/useDebounce';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTableViewOptions } from '@/components/shared/data-table/data-table-view-options';
import { ExportDialog } from '@/components/shared/export/ExportDialog';

import type { DataTableFilterField } from '@/types/data-table';
import { DataTableFilterSheet } from './data-table-filter-sheet';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import type { ExportField } from '@/hooks/useExport';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  filterFields?: DataTableFilterField[];
  exportFields?: ExportField[];
  searchKey?: string;
  canExport?: boolean;
}

export function DataTableToolbar<TData>({
  table,
  filterFields = [],
  exportFields: customExportFields,
  searchKey,
  canExport = true,
}: DataTableToolbarProps<TData>) {
  const searchColumn = searchKey ? table.getColumn(searchKey) : undefined;
  const filterValue = (searchColumn?.getFilterValue() as string) ?? '';
  const [searchValue, setSearchValue] = useState(filterValue);
  const debouncedSearchValue = useDebounceValue(searchValue, 1000);

  useEffect(() => {
    setSearchValue(filterValue);
  }, [filterValue]);

  useEffect(() => {
    if (searchKey && debouncedSearchValue !== filterValue) {
      table.getColumn(searchKey)?.setFilterValue(debouncedSearchValue);
    }
  }, [debouncedSearchValue, table, searchKey, filterValue]);

  const isFiltered = table.getState().columnFilters.length > 0;

  const exportFields = customExportFields || table.getAllColumns()
    .filter(column => column.getIsVisible() && column.id !== 'select' && column.id !== 'actions')
    .map(column => ({
      id: column.id,
      label: column.id.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      accessorFn: (row: Row<TData>) => {
        const value = row.getValue(column.id);
        // Handle arrays (like tags or multi-select values)
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return value;
      }
    }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center space-x-2">
          {searchKey && (
            <Input
              placeholder="Search..."
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              className="h-8 w-37.5 lg:w-62.5"
            />
          )}
          {filterFields.length > 0 && (
            <DataTableFilterSheet table={table} filterFields={filterFields} />
          )}

          {isFiltered && (
            <Button
              variant="ghost"
              onClick={() => table.resetColumnFilters()}
              className="h-8 px-2 lg:px-3"
            >
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <ExportDialog 
              data={table.getFilteredRowModel().rows} 
              fields={exportFields}
            />
          )}
          <DataTableViewOptions table={table} />
        </div>
      </div>

      {/* Active Filter Badges */}
      {isFiltered && (
        <div className="flex flex-wrap gap-2">
          {table.getState().columnFilters.map((filter) => {
            const field = filterFields.find((f) => f.id === filter.id);
            if (!field) return null; // Or handle search key if it's in filters

            const value = filter.value;
            if (!value) return null;

            let label = `${field.label}: `;

            if (field.type === 'select' && Array.isArray(value)) {
              label += value
                .map(
                  (v) =>
                    field.options?.find((opt) => opt.value === v)?.label || v
                )
                .join(', ');
            } else if (field.type === 'number' && Array.isArray(value)) {
              const [min, max] = value as [
                number | undefined,
                number | undefined
              ];
              if (min !== undefined && max !== undefined)
                label += `${min} - ${max}`;
              else if (min !== undefined) label += `> ${min}`;
              else if (max !== undefined) label += `< ${max}`;
            } else if (field.type === 'date-range') {
              const range = value as DateRange;
              if (range?.from) {
                label += format(range.from, 'LLL dd, y');
                if (range.to) label += ` - ${format(range.to, 'LLL dd, y')}`;
              }
            } else {
              label += value;
            }

            return (
              <Badge
                key={filter.id}
                variant="secondary"
                className="rounded-sm px-1 font-normal"
              >
                {label}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-auto p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    table.getColumn(filter.id)?.setFilterValue(undefined);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
