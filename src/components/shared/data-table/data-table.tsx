import * as React from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataTablePagination } from "./data-table-pagination"
import { DataTableToolbar } from "./data-table-toolbar"
import { type DataTableFilterField } from "@/types/data-table"
import type { ExportField } from "@/hooks/useExport"
import { useOrgTablePreferences } from "@/hooks/preferences/useOrgTablePreferences"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  filterFields?: DataTableFilterField[]
  exportFields?: ExportField[]
  onRowClick?: (row: TData) => void
  storageKey?: string
  defaultColumnVisibility?: VisibilityState
  defaultColumnFilters?: ColumnFiltersState
  canExport?: boolean
  onFilteredDataChange?: (rows: TData[]) => void
  onSelectionChange?: (rows: TData[]) => void
  toolbarActions?: React.ReactNode
  orgId?: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  filterFields,
  exportFields,
  onRowClick,
  storageKey,
  defaultColumnVisibility = {},
  defaultColumnFilters,
  canExport = true,
  onFilteredDataChange,
  onSelectionChange,
  toolbarActions,
  orgId,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(() => defaultColumnFilters ?? [])
  const { columnVisibility, setColumnVisibility, pageSize, setPageSize } =
    useOrgTablePreferences(orgId, storageKey, defaultColumnVisibility, 10)
  const [rowSelection, setRowSelection] = React.useState({})
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize })
  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageSize }))
  }, [pageSize])
  React.useEffect(() => {
    setPageSize(pagination.pageSize)
  }, [pagination.pageSize])

  // Wrap columns to inject our custom search filter function for the searchKey
  const tableColumns = React.useMemo(() => {
    if (!searchKey) return columns;
    return columns.map(col => {
      // Handle both string ids and object properties
      const colId = typeof col === 'string' ? col : col.id || (col as any).accessorKey;
      if (colId === searchKey) {
        return {
          ...col,
          filterFn: ((row: any, columnId: string, filterValue: any) => {
            const rowValue = String(row.getValue(columnId) || "");
            const searchTerms = String(filterValue || "");
            const normalize = (str: string) => str.replace(/[\s\-_]/g, "").toLowerCase();
            return normalize(rowValue).includes(normalize(searchTerms));
          }) as any
        } as ColumnDef<TData, TValue>;
      }
      return col;
    });
  }, [columns, searchKey]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      columnVisibility: {
        ...columnVisibility,
        search: false,
        searchable: false,
      },
      rowSelection,
      pagination,
    },
  })

  React.useEffect(() => {
    if (!onFilteredDataChange) return
    const filtered = table.getFilteredRowModel().rows
    onFilteredDataChange(filtered.map((r) => r.original as TData))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnFilters, data])

  React.useEffect(() => {
    if (!onSelectionChange) return
    const selected = table.getSelectedRowModel().rows.map((r) => r.original as TData)
    onSelectionChange(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection, data])

  const shouldTriggerRowClick = React.useCallback((target: HTMLElement | null) => {
    if (!target) return true;
    if (target.closest('[data-no-row-click="true"]')) return false;
    if (target.closest('[data-row-click="true"]')) return true;
    if (
      target.closest(
        'button, a, input, textarea, select, label, [role="button"], [role="menuitem"], [aria-haspopup]'
      )
    ) {
      return false;
    }
    return true;
  }, []);

  return (
    <div className="space-y-4">
      <DataTableToolbar
        table={table}
        searchKey={searchKey}
        filterFields={filterFields}
        exportFields={exportFields}
        canExport={canExport}
        toolbarActions={toolbarActions}
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className={(header.column.columnDef as any)?.meta?.headerClassName}
                      style={(header.column.columnDef as any)?.meta?.headerStyle}
                      data-no-row-click={
                        (header.column.columnDef as any)?.meta?.noRowClick ? 'true' : undefined
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={(e) => {
                    if (!onRowClick) return;
                    const target = e.target as HTMLElement | null;
                    if (!shouldTriggerRowClick(target)) return;
                    onRowClick(row.original);
                  }}
                  className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={(cell.column.columnDef as any)?.meta?.cellClassName}
                      style={(cell.column.columnDef as any)?.meta?.cellStyle}
                      data-no-row-click={
                        (cell.column.columnDef as any)?.meta?.noRowClick ? 'true' : undefined
                      }
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  )
}
