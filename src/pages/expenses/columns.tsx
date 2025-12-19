import { type ColumnDef } from "@tanstack/react-table"
import { type Expense } from "@/types/expenses"
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay"
import { format } from "date-fns"
import { ExpenseActions } from "./ExpenseActions"

export const columns: ColumnDef<Expense>[] = [
  {
    accessorKey: "date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => {
      const date = row.getValue("date") as string
      return <div>{format(new Date(date), "MMM dd, yyyy")}</div>
    },
    filterFn: (row, id, value) => {
        const rowDate = new Date(row.getValue(id))
        const { from, to } = value
        if (!from) return true
        if (to && rowDate > to) return false
        if (rowDate < from) return false
        return true
    },
  },
  {
    accessorKey: "description",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Description" />
    ),
  },
  {
    accessorKey: "categoryName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Category" />
    ),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "typeName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => row.getValue("typeName") || "-",
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      let variant: "default" | "secondary" | "destructive" | "outline" = "outline"

      switch (status) {
        case "paid":
          variant = "default"
          break
        case "approved":
          variant = "secondary"
          break
        case "rejected":
          variant = "destructive"
          break
        default:
          variant = "outline"
      }

      return (
        <Badge variant={variant} className="capitalize">
          {status}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"))
      return (
        <div className="font-medium">
          <CurrencyDisplay amount={amount} />
        </div>
      )
    },
    filterFn: (row, id, value) => {
        const val = row.getValue(id) as number
        const [min, max] = value as [number, number]
        if (min !== undefined && val < min) return false
        if (max !== undefined && val > max) return false
        return true
    },
  },
  {
    accessorKey: "paymentMethod",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Payment" />
    ),
    cell: ({ row }) => {
      const method = row.getValue("paymentMethod") as string
      return <div className="capitalize">{method.replace("_", " ")}</div>
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "branchName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Branch" />
    ),
    cell: ({ row }) => row.getValue("branchName") || "All Branches",
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "createdByName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created By" />
    ),
    cell: ({ row }) => <div className="text-muted-foreground">{row.getValue("createdByName") || "Unknown"}</div>,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <ExpenseActions expense={row.original} />,
  },
]
