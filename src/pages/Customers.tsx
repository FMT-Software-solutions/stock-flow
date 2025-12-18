import { DataTable } from '@/components/shared/data-table/data-table';
import { columns } from './customers/columns';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCustomers } from '@/hooks/useCustomerQueries';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBranchContext } from '@/contexts/BranchContext';
import { getCustomerFilterFields } from './customers/fields';

export function Customers() {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { availableBranches } = useBranchContext();
  const { data: customers = [], isLoading } = useCustomers(
    currentOrganization?.id
  );

  const filterFields = getCustomerFilterFields(
    availableBranches.map((branch) => ({
      label: branch.name,
      value: branch.name,
    }))
  );

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage your customer base</p>
        </div>
        <Button onClick={() => navigate('/customers/new')}>
          <Plus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={customers}
        searchKey="firstName"
        filterFields={filterFields}
      />
    </div>
  );
}
