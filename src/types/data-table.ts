export type FilterType = "select" | "text" | "number" | "date-range" | "date"

export interface DataTableFilterOption {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
}

export interface DataTableFilterField {
  id: string
  label: string
  type: FilterType
  options?: DataTableFilterOption[]
  placeholder?: string
  minDate?: Date
  maxDate?: Date
  defaultValue?: unknown
}
