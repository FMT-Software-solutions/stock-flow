import * as React from "react"
import { type Table } from "@tanstack/react-table"
import { Filter } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type DataTableFilterField } from "@/types/data-table"
import { DatePickerWithRange } from "@/components/shared/date-range-picker"
import MultipleSelector, { type Option } from "@/components/ui/multiselect"
import { type DateRange } from "react-day-picker"

interface DataTableFilterSheetProps<TData> {
  table: Table<TData>
  filterFields: DataTableFilterField[]
}

export function DataTableFilterSheet<TData>({
  table,
  filterFields,
}: DataTableFilterSheetProps<TData>) {
  const [open, setOpen] = React.useState(false)
  const [localFilters, setLocalFilters] = React.useState<
    { id: string; value: any }[]
  >([])

  // Initialize local filters from table state when sheet opens
  React.useEffect(() => {
    if (open) {
      setLocalFilters(
        table.getState().columnFilters.map((filter) => ({
          id: filter.id,
          value: filter.value,
        }))
      )
    }
  }, [open, table])

  const handleApply = () => {
    table.setColumnFilters(localFilters)
    setOpen(false)
  }

  const handleClear = () => {
    setLocalFilters([])
  }

  const updateFilter = (id: string, value: any) => {
    setLocalFilters((prev) => {
      const existing = prev.find((f) => f.id === id)
      if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
        return prev.filter((f) => f.id !== id)
      }
      if (existing) {
        return prev.map((f) => (f.id === id ? { ...f, value } : f))
      }
      return [...prev, { id, value }]
    })
  }

  const getFilterValue = (id: string) => {
    return localFilters.find((f) => f.id === id)?.value
  }

  // Count active filters (excluding search)
  const activeFilterCount = table.getState().columnFilters.length

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <Filter className="mr-2 h-4 w-4" />
          Filter
          {activeFilterCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-2 rounded-sm px-1 font-normal lg:hidden"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-100 sm:w-135 px-4">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Apply filters to narrow down the data.
          </SheetDescription>
        </SheetHeader>
        <Separator className="mb-2" />
        <ScrollArea className="h-[calc(100vh-220px)] pr-4">
          <div className="space-y-4">
            {filterFields.map((field) => {
              const column = table.getColumn(field.id)
              if (!column) return null

              // if (!column.getIsVisible()) return null

              const value = getFilterValue(field.id)

              return (
                <div key={field.id} className="space-y-2">
                  <Label>{field.label}</Label>
                  
                  {field.type === "text" && (
                    <Input
                      placeholder={field.placeholder || "Filter..."}
                      value={(value as string) || ""}
                      onChange={(e) => updateFilter(field.id, e.target.value)}
                    />
                  )}

                  {field.type === "number" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={(value as [number, number])?.[0] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : undefined
                          const currentMax = (value as [number, number])?.[1]
                          updateFilter(field.id, [val, currentMax])
                        }}
                      />
                      <span>-</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={(value as [number, number])?.[1] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : undefined
                          const currentMin = (value as [number, number])?.[0]
                          updateFilter(field.id, [currentMin, val])
                        }}
                      />
                    </div>
                  )}

                  {field.type === "select" && field.options && (
                     <MultipleSelector
                        defaultOptions={field.options as Option[]}
                        placeholder="Select options..."
                        value={(field.options as Option[]).filter((option) =>
                            (value as string[])?.includes(option.value)
                        )}
                        onChange={(options) => {
                            updateFilter(
                                field.id,
                                options.map((option) => option.value)
                            )
                        }}
                        badgeClassName="bg-secondary text-secondary-foreground"
                        
                     />
                  )}

                  {field.type === "date-range" && (
                     <DatePickerWithRange
                        date={value as DateRange}
                        setDate={(date) => updateFilter(field.id, date)}
                     />
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
        <SheetFooter className="mt-2 border-t">
          <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClear}>
            Clear filters
          </Button>
          <Button onClick={handleApply}>Apply filters</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
