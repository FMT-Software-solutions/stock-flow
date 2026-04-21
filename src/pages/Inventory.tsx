import { useRoleCheck } from '@/components/auth/RoleGuard';
import { DataTable } from '@/components/shared/data-table/data-table';
import { StatsContainer } from '@/components/shared/stats/StatsContainer';
import { Button } from '@/components/ui/button';

import { useBranchContext } from '@/contexts/BranchContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgPreference } from '@/hooks/preferences/useOrgPreference';
import { useCurrency } from '@/hooks/useCurrency';
import {
  useInventoryEntries,
  useProducts,
} from '@/hooks/useInventoryQueries';
import type { InventoryEntry } from '@/types/inventory';
import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryColumns } from './inventory/columns';
import {
  getInventoryFilterFields,
  inventoryExportFields,
} from './inventory/fields/inventoryFields';
import { getInventoryStatsGroups } from './inventory/fields/inventoryStats';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function Inventory() {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { selectedBranchIds } = useBranchContext();
  const { formatCurrency } = useCurrency();
  const { checkPermission, isOwner } = useRoleCheck();
  const { data: products = [], isLoading } = useProducts(
    currentOrganization?.id
  );
  const { data: inventoryEntries = [] } = useInventoryEntries(
    currentOrganization?.id,
    selectedBranchIds
  );

  const [openProductSearch, setOpenProductSearch] = useState(false);

  const canViewInventory = checkPermission('inventory');
  const canCreateInventory = checkPermission('inventory', 'create');
  const canExportInventory = checkPermission('inventory', 'export');

  const categories = Array.from(
    new Set(products.map((p) => p.category?.name).filter(Boolean))
  ).map((category) => ({
    label: category as string,
    value: category as string,
  }));

  const inventoryProductNames = Array.from(
    new Set(inventoryEntries.map((i) => i.productName).filter(Boolean))
  ).map((name) => ({
    label: name as string,
    value: name as string,
  }));

  const inventoryLocations = Array.from(
    new Set(inventoryEntries.map((i) => i.location).filter(Boolean))
  ).map((location) => ({
    label: location as string,
    value: location as string,
  }));

  const inventoryBranches = Array.from(
    new Set(inventoryEntries.map((i) => i.branchName).filter(Boolean))
  ).map((branch) => ({
    label: branch as string,
    value: branch as string,
  }));

  const inventoryCreators = Array.from(
    new Set(inventoryEntries.map((i) => i.createdByName).filter(Boolean))
  ).map((name) => ({
    label: name as string,
    value: name as string,
  }));

  const inventoryFilterFields = getInventoryFilterFields(
    inventoryProductNames,
    categories,
    inventoryBranches,
    inventoryLocations,
    inventoryCreators
  );

  const inventoryStatsGroups = getInventoryStatsGroups(
    formatCurrency,
    isOwner()
  );

  const [inventoryFiltered, setInventoryFiltered] = useState<InventoryEntry[]>(
    []
  );
  const [inventorySummaryMode, setInventorySummaryMode] = useOrgPreference<
    'filtered' | 'all'
  >(currentOrganization?.id, 'inventory.summaryMode', 'filtered');

  const inventorySummaryData =
    inventorySummaryMode === 'filtered' ? inventoryFiltered : inventoryEntries;

  if (!canViewInventory) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Manage your stock levels and entries
          </p>
        </div>
        <div className="flex items-center gap-4">
          {canCreateInventory && (
            <Popover
              open={openProductSearch}
              onOpenChange={setOpenProductSearch}
            >
              <PopoverTrigger asChild>
                <Button
                  role="combobox"
                  aria-expanded={openProductSearch}
                  disabled={isLoading}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Inventory
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-75 p-0">
                <Command>
                  <CommandInput placeholder="Search product..." />
                  <CommandList>
                    <CommandEmpty>No product found.</CommandEmpty>
                    <CommandGroup>
                      {products.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={product.name}
                          onSelect={() => {
                            setOpenProductSearch(false);
                            navigate(`/products/${product.id}`);
                          }}
                        >
                          <Check className={cn('mr-2 h-4 w-4 opacity-0')} />
                          {product.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <StatsContainer
          groups={inventoryStatsGroups}
          data={inventorySummaryData}
          summaryLabel="Inventory Summary"
          storageKey="stockflow-inventory-stats-container-is-open"
          orgId={currentOrganization?.id}
          summaryMode={inventorySummaryMode}
          onSummaryModeChange={setInventorySummaryMode}
        />
        <DataTable
          columns={inventoryColumns}
          data={inventoryEntries}
          searchKey="searchable"
          filterFields={inventoryFilterFields}
          exportFields={inventoryExportFields}
          storageKey="inventory-entries-table"
          defaultColumnVisibility={{
            searchable: false,
            branchName: false,
          }}
          canExport={canExportInventory}
          orgId={currentOrganization?.id}
          onFilteredDataChange={(rows) =>
            setInventoryFiltered(rows as InventoryEntry[])
          }
        />
      </div>
    </div>
  );
}
