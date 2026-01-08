import { type ColumnDef } from "@tanstack/react-table"
import { type Expense } from "@/types/expenses"
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay"
import { format } from "date-fns"
import { isDateInRange } from "@/lib/utils"
import { ExpenseActions } from "./ExpenseActions"

export const columns: ColumnDef<Expense>[] = [
  {
    id: "search",
    accessorFn: (row) =>
      [
        row.description || "",
        row.categoryName || "Uncategorized",
        row.typeName || "Unknown Type",
      ]
        .join(" ")
        .trim(),
    enableHiding: false,
  },
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
      return isDateInRange(row.getValue(id), value)
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
    cell: ({ row }) => row.getValue("categoryName") || "Uncategorized",
    filterFn: (row, id, value) => {
      const v = (row.getValue(id) as string) || "Uncategorized"
      return value.includes(v)
    },
  },
  {
    accessorKey: "typeName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => row.getValue("typeName") || "Unknown Type",
    filterFn: (row, id, value) => {
      const v = (row.getValue(id) as string) || "Unknown Type"
      return value.includes(v)
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
