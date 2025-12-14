import { DataTable } from "@/components/shared/data-table/data-table"
import { columns } from "./customers/columns"
import { mockCustomers } from "@/data/mock-customers"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useNavigate } from "react-router-dom"

export function Customers() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            Manage your customer base
          </p>
        </div>
        <Button onClick={() => navigate("/customers/new")}>
            <Plus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>
      
      <DataTable columns={columns} data={mockCustomers} searchKey="firstName" />
    </div>
  )
}
