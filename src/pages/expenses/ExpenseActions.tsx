import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Edit, MoreHorizontal, Trash, FileText, Eye } from 'lucide-react';
import type { Expense } from '@/types/expenses';
import { useDeleteExpense } from '@/hooks/useExpenseQueries';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';
import { ViewEditExpenseDialog } from './components/ViewEditExpenseDialog';
import { useRoleCheck } from '@/components/auth/RoleGuard';

interface ExpenseActionsProps {
  expense: Expense;
}

export function ExpenseActions({ expense }: ExpenseActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showViewEditDialog, setShowViewEditDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit'>('view');

  const deleteExpense = useDeleteExpense();
  const { checkPermission } = useRoleCheck();
  const canEdit = checkPermission('expenses', 'edit');
  const canDelete = checkPermission('expenses', 'delete');

  const handleDelete = () => {
    deleteExpense.mutate(expense.id, {
      onSuccess: () => {
        toast.success('Expense deleted successfully');
        setShowDeleteDialog(false);
      },
      onError: (error) => {
        toast.error(`Failed to delete expense: ${error.message}`);
      },
    });
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
            onClick={() => navigator.clipboard.writeText(expense.id)}
          >
            <FileText className="mr-2 h-4 w-4" /> Copy ID
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setDialogMode('view');
              setShowViewEditDialog(true);
            }}
          >
            <Eye className="mr-2 h-4 w-4" /> View Details
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem
              onClick={() => {
                setDialogMode('edit');
                setShowViewEditDialog(true);
              }}
            >
              <Edit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ViewEditExpenseDialog
        expense={expense}
        open={showViewEditDialog}
        onOpenChange={setShowViewEditDialog}
        initialMode={dialogMode}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              expense record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
