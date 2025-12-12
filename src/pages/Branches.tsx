import { useState, useMemo } from 'react';
import { useBranches } from '@/hooks/queries';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { BranchForm } from '@/components/forms/BranchForm';
import { BranchGrid } from '@/components/branches/BranchGrid';
import { BranchTable } from '@/components/branches/BranchTable';
import { BranchDisplayControls } from '@/components/branches/BranchDisplayControls';
import { BranchPagination } from '@/components/branches/BranchPagination';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Branch } from '@/types';
import { useBranchesPreferences } from '@/hooks/useBranchesPreferences';
import { useBranchContext } from '@/contexts/BranchContext';
import { useRoleCheck } from '@/components/auth/RoleGuard';

export function Branches() {
  const { checkPermission } = useRoleCheck();
  const canView = checkPermission('branch_management', 'view');
  const canCreate = checkPermission('branch_management', 'create');
  const canEdit = checkPermission('branch_management', 'edit');
  const canDelete = checkPermission('branch_management', 'delete');

  const { currentOrganization } = useOrganization();
  const { data: branches = [], isLoading } = useBranches(
    currentOrganization?.id
  );
  const { selectedBranchIds } = useBranchContext();
  const [selectedBranch, setSelectedBranch] = useState<Branch | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all');
  const {
    displayMode,
    setDisplayMode,
    pageSize,
    setPageSize,
  } = useBranchesPreferences();
  const [currentPage, setCurrentPage] = useState(1);

  const handleSuccess = () => {
    setIsDialogOpen(false);
    setSelectedBranch(undefined);
  };

  const handleCreate = () => {
    setSelectedBranch(undefined);
    setIsDialogOpen(true);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Filter and paginate branches
  const { filteredBranches, paginatedBranches, totalPages } = useMemo(() => {
    const filtered = branches.filter((branch) => {
      const matchesSearch =
        branch.name.toLowerCase().includes(search.toLowerCase()) ||
        (branch.description?.toLowerCase().includes(search.toLowerCase()) ??
          false) ||
        branch.location.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && branch.is_active) ||
        (statusFilter === 'inactive' && !branch.is_active);
      return matchesSearch && matchesStatus;
    });

    const totalPages = Math.ceil(filtered.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);

    return {
      filteredBranches: filtered,
      paginatedBranches: paginated,
      totalPages,
    };
  }, [
    branches,
    search,
    statusFilter,
    currentPage,
    pageSize,
    selectedBranchIds,
  ]);

  // Reset to first page when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: 'all' | 'active' | 'inactive') => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">
            Branch Management
          </h1>
        </div>
        {displayMode === 'grid' ? (
          <BranchGrid branches={[]} isLoading={true} />
        ) : (
          <BranchTable branches={[]} isLoading={true} />
        )}
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access branch management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0 flex-wrap space-y-4">
        <div className="mb-4 md:mb-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Branch Management
          </h1>
          <p className="text-muted-foreground">
            Manage your branches and locations
          </p>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 flex-wrap">
          <Input
            type="text"
            placeholder="Search branches..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full md:w-64"
          />
          <div className="flex items-center gap-2 mt-2 md:mt-0">
            <Tabs
              value={statusFilter}
              onValueChange={(v) =>
                handleStatusFilterChange(v as 'all' | 'active' | 'inactive')
              }
            >
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="inactive">Inactive</TabsTrigger>
              </TabsList>
            </Tabs>
            <BranchDisplayControls
              displayMode={displayMode}
              onDisplayModeChange={setDisplayMode}
            />
            {canCreate && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleCreate}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>
                      {selectedBranch ? 'Edit Branch' : 'Create New Branch'}
                    </DialogTitle>
                    <DialogDescription>
                      {selectedBranch
                        ? 'Update the branch information below.'
                        : 'Fill in the details to create a new branch.'}
                    </DialogDescription>
                  </DialogHeader>
                  <BranchForm
                    branch={selectedBranch}
                    onSuccess={handleSuccess}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {displayMode === 'grid' ? (
          <BranchGrid
            branches={paginatedBranches}
            isLoading={isLoading}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ) : (
          <BranchTable
            branches={paginatedBranches}
            isLoading={isLoading}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        )}

        {filteredBranches.length > 0 && (
          <BranchPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredBranches.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>

      {filteredBranches.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto max-w-md">
            <h3 className="text-lg font-medium mb-2">No branches found</h3>
            <p className="text-gray-500 mb-6 text-sm">
              Try adjusting your search or filter options.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create New Branch
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
