import { useState } from 'react';
import type { InventoryEntry } from '@/types/inventory';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Eye, Copy, Trash } from 'lucide-react';
import { InventoryDetailsDialog } from './InventoryDetailsDialog';
import { useDeleteInventoryEntry } from '@/hooks/useInventoryQueries';
import { useRoleCheck } from '@/components/auth/RoleGuard';

interface InventoryActionsProps {
  inventory: InventoryEntry;
}

export function InventoryActions({ inventory }: InventoryActionsProps) {
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const deleteInventory = useDeleteInventoryEntry();
  const { checkPermission } = useRoleCheck();
  const canViewInventory = checkPermission('inventory');
  const canEditInventory = checkPermission('inventory', 'edit');
  const canDeleteInventory = checkPermission('inventory', 'delete');

  const handleDelete = () => {
    if (!canDeleteInventory) return;
    if (confirm('Are you sure you want to delete this inventory item?')) {
      deleteInventory.mutate(inventory.id);
    }
  };

  return (
    <>
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
            onClick={() =>
              navigator.clipboard.writeText(inventory.inventoryNumber || '')
            }
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy Inventory Number
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {canViewInventory && (
            <DropdownMenuItem
              onClick={() => {
                if (!canViewInventory) return;
                setShowDetailsDialog(true);
              }}
              disabled={!canViewInventory}
            >
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
          )}
          {canEditInventory && (
            <DropdownMenuItem
              onClick={() => {
                if (!canEditInventory) return;
                setShowDetailsDialog(true);
              }}
              disabled={!canEditInventory}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {canDeleteInventory && (
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-red-600"
              disabled={!canDeleteInventory}
            >
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showDetailsDialog && (
        <InventoryDetailsDialog
          inventory={inventory}
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
        />
      )}
    </>
  );
}
