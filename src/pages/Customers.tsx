import { DataTable } from '@/components/shared/data-table/data-table';
import { columns } from './customers/columns';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCustomers } from '@/hooks/useCustomerQueries';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBranchContext } from '@/contexts/BranchContext';
import {
  customerExportFields,
  getCustomerFilterFields,
} from './customers/fields';
import { cn } from '@/lib/utils';
import { useRoleCheck } from '@/components/auth/RoleGuard';

export function Customers() {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { availableBranches } = useBranchContext();
  const { data: customers = [], isLoading } = useCustomers(
    currentOrganization?.id
  );
  const { checkPermission } = useRoleCheck();
  const canCreateCustomers = checkPermission('customers', 'create');
  const canExportCustomers = checkPermission('customers', 'export');

  const filterFields = getCustomerFilterFields(
    availableBranches.map((branch) => ({
      label: branch.name,
      value: branch.name,
    }))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Manage your customer base
          </p>
        </div>
        {canCreateCustomers && (
          <Button onClick={() => navigate('/customers/new')} disabled={isLoading}>
            <Plus className="mr-2 h-4 w-4" /> Add Customer
          </Button>
        )}
      </div>

      <div className={cn(isLoading ? 'opacity-50' : '')}>
        <DataTable
          columns={columns}
          data={customers}
          searchKey="search"
          filterFields={filterFields}
          exportFields={customerExportFields}
          defaultColumnVisibility={{ search: false }}
          canExport={canExportCustomers}
        />
      </div>
    </div>
  );
}
