import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUpdateExpense } from '@/hooks/useExpenseQueries';
import type { Expense, ExpenseInput } from '@/types/expenses';
import { format } from 'date-fns';
import {
  Edit,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Paperclip,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { openExternalUrl } from '@/utils/external-url';
import { ExpenseForm } from './ExpenseForm';

interface ViewEditExpenseDialogProps {
  expense: Expense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: 'view' | 'edit';
}

export function ViewEditExpenseDialog({
  expense,
  open,
  onOpenChange,
  initialMode = 'view',
}: ViewEditExpenseDialogProps) {
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const updateExpense = useUpdateExpense();

  useEffect(() => {
    if (open) {
      setMode(initialMode);
    }
  }, [open, initialMode]);

  const handleSubmit = async (data: ExpenseInput) => {
    try {
      await updateExpense.mutateAsync({ id: expense.id, updates: data });
      toast.success('Expense updated successfully');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update expense:', error);
      toast.error('Failed to update expense');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getAttachmentType = (url: string) => {
    const extension = url.split('.').pop()?.toLowerCase();
    if (
      ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(
        extension || ''
      )
    )
      return 'image';
    if (extension === 'pdf') return 'pdf';

    // Check for Cloudinary resource types in URL if extension is missing or generic
    if (url.includes('/image/upload/')) return 'image';

    return 'file';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-150 max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{mode === 'edit' ? 'Edit Expense' : 'Expense Details'}</span>
            {mode === 'view' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode('edit')}
              >
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {mode === 'edit' ? (
          <ExpenseForm
            initialData={expense}
            onSubmit={handleSubmit}
            onCancel={() => setMode('view')}
            isSubmitting={updateExpense.isPending}
          />
        ) : (
          <div className="space-y-4 py-4">
            {/* Status Badge */}
            <div className="flex justify-end">
              <Badge
                variant="outline"
                className={getStatusColor(expense.status)}
              >
                {expense.status.charAt(0).toUpperCase() +
                  expense.status.slice(1)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  Date
                </h4>
                <p className="text-sm font-medium">
                  {format(new Date(expense.date), 'MMMM dd, yyyy')}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  Amount
                </h4>
                <p className="text-xl font-bold">
                  ${expense.amount.toFixed(2)}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  Category
                </h4>
                <p className="text-sm">{expense.categoryName || '-'}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  Type
                </h4>
                <p className="text-sm">{expense.typeName || '-'}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  Branch
                </h4>
                <p className="text-sm">{expense.branchName || '-'}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  Payment Method
                </h4>
                <p className="text-sm capitalize">
                  {expense.paymentMethod?.replace('_', ' ') || '-'}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  Reference
                </h4>
                <p className="text-sm">{expense.reference || '-'}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  Created By
                </h4>
                <p className="text-sm">{expense.createdByName || '-'}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Description
              </h4>
              <div className="bg-muted/30 p-3 rounded-md text-sm whitespace-pre-wrap">
                {expense.description}
              </div>
            </div>

            {expense.attachmentUrl && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Attachment
                </h4>
                <div className="border rounded-md overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-muted/20 border-b">
                    <div className="flex items-center gap-2">
                      {getAttachmentType(expense.attachmentUrl) === 'pdf' ? (
                        <FileText className="h-4 w-4 text-red-500" />
                      ) : getAttachmentType(expense.attachmentUrl) ===
                        'image' ? (
                        <ImageIcon className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">Attachment</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => openExternalUrl(expense.attachmentUrl!)}
                    >
                      <ExternalLink className="mr-2 h-3 w-3" />
                      Open
                    </Button>
                  </div>

                  <div className="p-4 flex justify-center bg-muted/5">
                    {getAttachmentType(expense.attachmentUrl) === 'image' ? (
                      <img
                        src={expense.attachmentUrl}
                        alt="Expense Attachment"
                        className="max-h-75 w-full object-contain rounded shadow-sm bg-white"
                      />
                    ) : getAttachmentType(expense.attachmentUrl) === 'pdf' ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <FileText className="h-16 w-16 mb-2 opacity-20" />
                        <p className="text-sm mb-4">PDF Document</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openExternalUrl(expense.attachmentUrl!)
                          }
                        >
                          View PDF
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <Paperclip className="h-16 w-16 mb-2 opacity-20" />
                        <p className="text-sm">Attachment available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
