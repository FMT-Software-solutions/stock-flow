import * as React from "react"
import { useRef } from "react"
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

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  filterFields?: DataTableFilterField[]
  exportFields?: ExportField[]
  onRowClick?: (row: TData) => void
  storageKey?: string
  defaultColumnVisibility?: VisibilityState
  canExport?: boolean
  onFilteredDataChange?: (rows: TData[]) => void
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
  canExport = true,
  onFilteredDataChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(() => {
      if (storageKey) {
        try {
          const item = window.localStorage.getItem(`${storageKey}-visibility`)
          return item ? { ...defaultColumnVisibility, ...JSON.parse(item) } : defaultColumnVisibility
        } catch (e) {
          return defaultColumnVisibility
        }
      }
      return defaultColumnVisibility
    })
  const [rowSelection, setRowSelection] = React.useState({})
  const [pagination, setPagination] = React.useState<PaginationState>(() => {
    if (storageKey) {
      try {
        const item = window.localStorage.getItem(`${storageKey}-pagination`)
        if (item) {
          const parsed = JSON.parse(item)
          return { pageIndex: 0, pageSize: parsed.pageSize || 10 }
        }
      } catch (e) {
        // ignore
      }
    }
    return { pageIndex: 0, pageSize: 10 }
  })

  React.useEffect(() => {
    if (storageKey) {
      window.localStorage.setItem(
        `${storageKey}-visibility`,
        JSON.stringify(columnVisibility)
      )
    }
  }, [columnVisibility, storageKey])

  React.useEffect(() => {
    if (storageKey) {
      window.localStorage.setItem(
        `${storageKey}-pagination`,
        JSON.stringify({ pageSize: pagination.pageSize })
      )
    }
  }, [pagination.pageSize, storageKey])

  const table = useReactTable({
    data,
    columns,
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
      columnVisibility,
      rowSelection,
      pagination,
    },
  })

  const prevSignatureRef = useRef<string | null>(null)
  React.useEffect(() => {
    if (!onFilteredDataChange) return
    const filtered = table.getFilteredRowModel().rows
    const signature =
      `${filtered.length}:` +
      filtered.slice(0, 20).map((r) => (r.original as any)?.id ?? '').join(',')
    if (prevSignatureRef.current !== signature) {
      prevSignatureRef.current = signature
      onFilteredDataChange(filtered.map((r) => r.original as TData))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnFilters, data])

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
