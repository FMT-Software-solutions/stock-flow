import { DataTable } from "@/components/shared/data-table/data-table"
import { columns } from "./suppliers/columns"
import { mockSuppliers } from "@/data/mock-suppliers"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useNavigate } from "react-router-dom"

export function Suppliers() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground">
            Manage your product suppliers and vendors
          </p>
        </div>
        <Button onClick={() => navigate("/suppliers/new")}>
            <Plus className="mr-2 h-4 w-4" /> Add Supplier
        </Button>
      </div>
      
      <DataTable columns={columns} data={mockSuppliers} searchKey="name" />
    </div>
  )
}
