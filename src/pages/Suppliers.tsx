import { DataTable } from '@/components/shared/data-table/data-table';
import { columns } from './suppliers/columns';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSuppliers } from '@/hooks/useInventoryQueries';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supplierExportFields, supplierFilterFields } from './suppliers/fields';
import { cn } from '@/lib/utils';
import { useRoleCheck } from '@/components/auth/RoleGuard';

export function Suppliers() {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { data: suppliers = [], isLoading } = useSuppliers(
    currentOrganization?.id
  );
  const { checkPermission } = useRoleCheck();
  const canCreateSuppliers = checkPermission('suppliers', 'create');
  const canExportSuppliers = checkPermission('suppliers', 'export');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">
            Manage your product suppliers and vendors
          </p>
        </div>
        {canCreateSuppliers && (
          <Button
            onClick={() => navigate('/suppliers/new')}
            disabled={isLoading}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Supplier
          </Button>
        )}
      </div>

      <div
        className={cn('space-y-4', {
          'opacity-50 cursor-not-allowed': isLoading,
        })}
      >
        <DataTable
          columns={columns}
          data={suppliers}
          searchKey="search"
          filterFields={supplierFilterFields}
          exportFields={supplierExportFields}
          storageKey="suppliers-table"
          defaultColumnVisibility={{ search: false }}
          canExport={canExportSuppliers}
        />
      </div>
    </div>
  );
}
