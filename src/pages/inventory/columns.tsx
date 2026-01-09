import { type ColumnDef } from "@tanstack/react-table"
import { type Product, type InventoryEntry } from "@/types/inventory"
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay"
import { InventoryActions } from "./components/InventoryActions"
import { ProductActions } from "./components/ProductActions"

import { Link } from "react-router-dom"
import { Copy } from "lucide-react"
import { toast } from "sonner"
import { ImagePreview } from "@/components/shared/ImagePreview"
import { isDateInRange } from "@/lib/utils"

const formatDateTime = (value: string) => {
  const date = new Date(value)
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`
}

const formatRelativeTime = (value: string) => {
  const now = new Date().getTime()
  const then = new Date(value).getTime()
  const diffMs = now - then
  const diffSeconds = Math.floor(diffMs / 1000)
  if (diffSeconds < 5) return 'Just now'
  if (diffSeconds < 60) return `${diffSeconds}s ago`
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}min ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}hr${diffHours > 1 ? 's' : ''} ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export const columns: ColumnDef<Product>[] = [
  {
    id: "searchable",
    accessorFn: (row) =>
      `${row.name} ${row.sku || ""} ${row.category?.name || ""}`.trim(),
    enableHiding: true,
    enableSorting: false,
    header: () => null,
    cell: () => null,
  },
  // We do not use the select column at the moment, we will enable it back when we need it
  // {
  //   id: "select",
  //   header: ({ table }) => (
  //     <Checkbox
  //       checked={
  //         table.getIsAllPageRowsSelected() ||
  //         (table.getIsSomePageRowsSelected() && "indeterminate")
  //       }
  //       onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
  //       aria-label="Select all"
  //     />
  //   ),
  //   cell: ({ row }) => (
  //     <Checkbox
  //       checked={row.getIsSelected()}
  //       onCheckedChange={(value) => row.toggleSelected(!!value)}
  //       aria-label="Select row"
  //     />
  //   ),
  //   enableSorting: false,
  //   enableHiding: false,
  // },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Product Name" />
    ),
    cell: ({ row }) => {
        return (
            <div className="flex items-center space-x-2">
                {row.original.imageUrl && (
                    <ImagePreview src={row.original.imageUrl} alt={row.getValue("name")} className="h-8 w-8 rounded-md object-cover" />
                )}
                <div className="flex flex-col">
                    <Link to={`/inventory/${row.original.id}`} className="font-medium hover:underline">
                        {row.getValue("name")}
                    </Link>
                    <span className="text-xs text-muted-foreground">{row.original.sku}</span>
                </div>
            </div>
        )
    }
  },
  {
    id: "category",
    accessorFn: (row) => row.category?.name || "Uncategorized",
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
    accessorKey: "createdByName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created By" />
    ),
    cell: ({ row }) => {
      return <div className="text-muted-foreground">{row.getValue("createdByName") || "Unknown"}</div>
    },
    filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created At" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("createdAt") as string
      return (
        <div className="flex flex-col text-xs">
          <span>{formatDateTime(value)}</span>
          <span className="text-muted-foreground">
            {formatRelativeTime(value)}
          </span>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return isDateInRange(row.getValue(id), value)
    },
    enableHiding: true,
  },
  {
    id: "actions",
    cell: ({ row }) => <ProductActions product={row.original} />,
  },
]

export const inventoryColumns: ColumnDef<InventoryEntry>[] = [
  {
    id: "searchable",
    accessorFn: (row) => `${row.productName} ${row.sku} ${row.inventoryNumber || ''} ${row.categoryName || ""} ${row.branchName || ''}`.trim(),
    enableHiding: true,
    enableSorting: false,
    header: () => null,
    cell: () => null,
  },
  {
    accessorKey: "inventoryNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Inv #" />
    ),
    cell: ({ row }) => (
      <div 
        className="font-mono text-xs text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors group/copy w-fit"
        onClick={() => {
            if (row.original.inventoryNumber) {
                navigator.clipboard.writeText(row.original.inventoryNumber)
                toast.success("Copied to clipboard")
            }
        }}
        title="Click to copy"
      >
        {row.original.inventoryNumber || '-'}
        {row.original.inventoryNumber && <Copy className="h-3 w-3 opacity-0 group-hover/copy:opacity-100 transition-opacity" />}
      </div>
    ),
  },
  {
    accessorKey: "productName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Product" />
    ),
    filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
    },
    cell: ({ row }) => {
      const sku = row.original.sku
      const branchName = row.original.branchName
      const imageUrl = row.original.imageUrl || row.original.productImage
      
      return (
        <div className="flex items-center space-x-2">
          {imageUrl && (
            <ImagePreview 
              src={imageUrl} 
              alt={row.original.productName} 
              className="h-8 w-8 rounded-md object-cover" 
            />
          )}
          <div className="flex flex-col">
            <Link to={`/inventory/entry/${row.original.id}`} className="font-medium hover:underline">
                {row.original.productName}
            </Link>
            <span className="text-xs text-muted-foreground">
              {sku}
              {branchName ? ` • ${branchName}` : ''}
            </span>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "categoryName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Category" />
    ),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    enableHiding: true,
  },
  {
    accessorKey: "branchName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Branch" />
    ),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    enableHiding: true,
  },
  {
    id: "effectivePrice",
    accessorFn: (row) => row.priceOverride ?? row.productPrice,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Price" />
    ),
    cell: ({ row }) => {
      const priceOverride = row.original.priceOverride
      const displayPrice = priceOverride ?? row.original.productPrice
      
      return (
        <div className="font-medium">
          {displayPrice !== undefined ? (
            <CurrencyDisplay amount={displayPrice} />
          ) : (
            <span className="text-muted-foreground text-xs italic">-</span>
          )}
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
    accessorKey: "quantity",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Stock" />
    ),
    cell: ({ row }) => {
      const quantity = row.getValue("quantity") as number
      const minStock = row.original.minStockLevel
      let color =
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
      if (quantity <= 0) {
        color =
          "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
      } else if (quantity <= minStock) {
        color =
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
      }
      return (
        <Badge variant="outline" className={color}>
          {quantity} {row.original.unit}
        </Badge>
      )
    },
  },
  {
    accessorKey: "location",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Location" />
    ),
  },
  {
    accessorKey: "createdByName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created By" />
    ),
    cell: ({ row }) => {
      return <div className="text-muted-foreground">{row.getValue("createdByName") || "Unknown"}</div>
    },
  },
  {
    accessorKey: "lastUpdated",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Updated" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("lastUpdated") as string
      return (
        <div className="flex flex-col text-xs">
          <span>{formatDateTime(value)}</span>
          <span className="text-muted-foreground">
            {formatRelativeTime(value)}
          </span>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return isDateInRange(row.getValue(id), value)
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <InventoryActions inventory={row.original} />,
  },
]
