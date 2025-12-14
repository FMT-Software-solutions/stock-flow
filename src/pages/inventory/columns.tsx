import { type ColumnDef } from "@tanstack/react-table"
import { type Product } from "@/types/inventory"
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Edit, Trash, Eye } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay"

import { Link } from "react-router-dom"

export const columns: ColumnDef<Product>[] = [
  {

    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Product Name" />
    ),
    cell: ({ row }) => {
        return (
            <div className="flex items-center space-x-2">
                {row.original.imageUrl && (
                    <img src={row.original.imageUrl} alt={row.getValue("name")} className="h-8 w-8 rounded-md object-cover" />
                )}
                <div className="flex flex-col">
                    <span className="font-medium">{row.getValue("name")}</span>
                    <span className="text-xs text-muted-foreground">{row.original.sku}</span>
                </div>
            </div>
        )
    }
  },
  {
    accessorKey: "category",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Category" />
    ),
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
      return (
        <Badge variant="outline" className="capitalize">
          {status}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "sellingPrice",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Price" />
    ),
    cell: ({ row }) => {
      const price = parseFloat(row.getValue("sellingPrice"))
      return <div className="font-medium"><CurrencyDisplay amount={price} /></div>
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
    accessorKey: "quantity",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Stock" />
    ),
    cell: ({ row }) => {
        const quantity = row.getValue("quantity") as number
        const minStock = row.original.minStockLevel
        
        let color = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
        if (quantity <= 0) {
            color = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
        } else if (quantity <= minStock) {
            color = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
        }

        return (
            <Badge variant="outline" className={color}>
                {quantity} {row.original.unit}
            </Badge>
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
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created At" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue("createdAt"))
      return <div className="text-muted-foreground">{date.toLocaleDateString()}</div>
    },
    filterFn: (row, id, value) => {
        const rowDate = new Date(row.getValue(id))
        const { from, to } = value
        if (!from) return true
        if (to && rowDate > to) return false
        if (rowDate < from) return false
        return true
    },
    enableHiding: true,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const product = row.original
 
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(product.id)}
            >
              Copy Product ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
                <Link to={`/inventory/${product.id}`} className="flex items-center">
                    <Eye className="mr-2 h-4 w-4" /> View Details
                </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
                <Link to={`/inventory/${product.id}`} className="flex items-center">
                    <Edit className="mr-2 h-4 w-4" /> Edit
                </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600">

                <Trash className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
