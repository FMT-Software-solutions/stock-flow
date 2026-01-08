import type { Product } from '@/types/inventory';
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
import { Link } from 'react-router-dom';
import { useDeleteProduct } from '@/hooks/useInventoryQueries';
import { useRoleCheck } from '@/components/auth/RoleGuard';

interface ProductActionsProps {
  product: Product;
}

export function ProductActions({ product }: ProductActionsProps) {
  const deleteProduct = useDeleteProduct();
  const { checkPermission } = useRoleCheck();
  const canViewProducts = checkPermission('products');
  const canEditProducts = checkPermission('products', 'edit');
  const canDeleteProducts = checkPermission('products', 'delete');

  const handleDelete = () => {
    if (!canDeleteProducts) return;
    if (
      confirm(
        'Are you sure you want to delete this product? This will also delete related inventory items.'
      )
    ) {
      deleteProduct.mutate({ id: product.id, imageUrl: product.imageUrl });
    }
  };

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
          <Copy className="mr-2 h-4 w-4" /> Copy Product ID
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {canViewProducts && (
          <DropdownMenuItem asChild>
            <Link to={`/inventory/${product.id}`} className="flex items-center">
              <Eye className="mr-2 h-4 w-4" /> View Details
            </Link>
          </DropdownMenuItem>
        )}
        {canEditProducts && (
          <DropdownMenuItem asChild>
            <Link
              to={`/inventory/${product.id}/edit`}
              className="flex items-center"
            >
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Link>
          </DropdownMenuItem>
        )}
        {canDeleteProducts && (
          <DropdownMenuItem
            onClick={handleDelete}
            className="text-red-600"
            disabled={!canDeleteProducts}
          >
            <Trash className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
