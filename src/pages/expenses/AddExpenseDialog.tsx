import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBranchContext } from '@/contexts/BranchContext';
import {
  useExpenseCategories,
  useExpenseTypes,
  useBulkCreateExpenses,
} from '@/hooks/useExpenseQueries';
import { toast } from 'sonner';
import type { ExpenseInput } from '@/types/expenses';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatePicker } from '@/components/shared/DatePicker';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { ModernFileUpload } from '@/components/shared/ModernFileUpload';
import { uploadAttachment } from '@/utils/attachment-upload';

interface AddExpenseDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ExpenseItem extends Partial<ExpenseInput> {
  tempId: string;
  attachmentFile?: File;
  isCollapsed?: boolean;
}

export function AddExpenseDialog({
  children,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: AddExpenseDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;

  const { currentOrganization } = useOrganization();
  const { selectedBranchIds, availableBranches } = useBranchContext();

  const organizationId = currentOrganization?.id;
  const defaultBranchId =
    selectedBranchIds.length === 1
      ? selectedBranchIds[0]
      : availableBranches[0]?.id;

  const { data: categories = [] } = useExpenseCategories(organizationId);
  const { data: allTypes = [] } = useExpenseTypes(organizationId);
  const bulkCreate = useBulkCreateExpenses();

  const createEmptyItem = (): ExpenseItem => ({
    tempId: Math.random().toString(36).substring(7),
    date: new Date().toISOString().split('T')[0],
    amount: undefined,
    categoryId: '',
    description: '',
    paymentMethod: 'cash',
    status: 'pending',
    branchId: defaultBranchId,
    organizationId,
  });

  const [items, setItems] = useState<ExpenseItem[]>([createEmptyItem()]);

  // Reset items when dialog opens
  useEffect(() => {
    if (open) {
      setItems([createEmptyItem()]);
    }
  }, [open]);

  const handleAddItem = () => {
    const lastItem = items[items.length - 1];
    const newItem = createEmptyItem();

    // Smart copy from previous item for faster entry
    if (lastItem) {
      newItem.date = lastItem.date;
      newItem.paymentMethod = lastItem.paymentMethod;
      newItem.branchId = lastItem.branchId;
      // We don't copy amount/desc/category usually as they vary, but maybe status
      newItem.status = lastItem.status;
    }

    // Collapse all existing items and add new one expanded
    setItems([...items.map((i) => ({ ...i, isCollapsed: true })), newItem]);
  };

  const toggleCollapse = (tempId: string) => {
    setItems(
      items.map((item) =>
        item.tempId === tempId
          ? { ...item, isCollapsed: !item.isCollapsed }
          : item
      )
    );
  };

  const handleRemoveItem = (tempId: string) => {
    if (items.length === 1) {
      // Don't remove the last item, just clear it? Or allow removing but show empty state?
      // Better to keep at least one
      return;
    }
    setItems(items.filter((i) => i.tempId !== tempId));
  };

  const updateItem = (tempId: string, field: keyof ExpenseItem, value: any) => {
    setItems(
      items.map((item) => {
        if (item.tempId === tempId) {
          const updated = { ...item, [field]: value };
          // Clear type if category changes
          if (field === 'categoryId') {
            updated.typeId = undefined;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleSave = async () => {
    if (!organizationId) return;

    // Validation
    const invalidItems = items.filter(
      (item) =>
        !item.amount || !item.categoryId || !item.description || !item.date
    );

    if (invalidItems.length > 0) {
      toast.error(
        `Please fill in all required fields for all ${items.length} items.`
      );
      return;
    }

    setIsUploading(true);

    try {
      const itemsWithAttachments = await Promise.all(
        items.map(async (item) => {
          let attachmentUrl = item.attachmentUrl;
          if (item.attachmentFile) {
            try {
              const result = await uploadAttachment(
                item.attachmentFile,
                organizationId
              );
              attachmentUrl = result.url;
            } catch (error) {
              console.error('Failed to upload attachment:', error);
              throw new Error(
                `Failed to upload attachment for item: ${item.description}`
              );
            }
          }
          return { ...item, attachmentUrl };
        })
      );

      const expensesToSave: ExpenseInput[] = itemsWithAttachments.map(
        (item) => ({
          date: item.date!,
          amount: Number(item.amount),
          categoryId: item.categoryId!,
          typeId: item.typeId,
          description: item.description!,
          paymentMethod: item.paymentMethod || 'cash',
          status: item.status || 'pending',
          reference: item.reference,
          branchId: item.branchId,
          organizationId: organizationId,
          attachmentUrl: item.attachmentUrl,
        })
      );

      bulkCreate.mutate(expensesToSave, {
        onSuccess: () => {
          toast.success(`Successfully saved ${items.length} expenses.`);
          setOpen(false);
          setIsUploading(false);
        },
        onError: (err) => {
          toast.error('Failed to save expenses: ' + err.message);
          setIsUploading(false);
        },
      });
    } catch (error) {
      setIsUploading(false);
      toast.error(
        error instanceof Error ? error.message : 'Failed to process expenses'
      );
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-225 h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Add Expenses</DialogTitle>
          <DialogDescription>
            Record one or multiple expenses.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4 h-[calc(95vh-190px)]">
          <div className="space-y-3">
            {items.map((item) => {
              const itemTypes = allTypes.filter(
                (t) => t.categoryId === item.categoryId
              );

              const categoryName = categories.find(
                (c) => c.id === item.categoryId
              )?.name;

              if (item.isCollapsed) {
                return (
                  <div
                    key={item.tempId}
                    className="flex items-center justify-between p-4 rounded-lg border bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer"
                    onClick={() => toggleCollapse(item.tempId)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm">
                          {categoryName || 'No Category'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.date}
                        </span>
                      </div>
                      <div className="flex-1 text-sm text-muted-foreground truncate max-w-50">
                        {item.description || 'No description'}
                      </div>
                      <div className="font-semibold text-sm">
                        {item.amount ? Number(item.amount).toFixed(2) : '0.00'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveItem(item.tempId);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={item.tempId}
                  className="relative grid gap-4 p-4 rounded-lg border bg-card text-card-foreground shadow-sm animate-in fade-in slide-in-from-bottom-2"
                >
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => toggleCollapse(item.tempId)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    {items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveItem(item.tempId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-12 gap-4">
                    {/* Row 1: Basic Info */}
                    <div className="col-span-12 md:col-span-3">
                      <Label className="text-xs mb-1.5 block">Date</Label>
                      <DatePicker
                        date={
                          item.date
                            ? new Date(
                                parseInt(item.date.split('-')[0]),
                                parseInt(item.date.split('-')[1]) - 1,
                                parseInt(item.date.split('-')[2])
                              )
                            : undefined
                        }
                        setDate={(date) =>
                          updateItem(
                            item.tempId,
                            'date',
                            date ? format(date, 'yyyy-MM-dd') : ''
                          )
                        }
                      />
                    </div>

                    <div className="col-span-12 md:col-span-3">
                      <Label className="text-xs mb-1.5 block">
                        Category <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={item.categoryId}
                        onValueChange={(val) =>
                          updateItem(item.tempId, 'categoryId', val)
                        }
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-12 md:col-span-3">
                      <Label className="text-xs mb-1.5 block">Type</Label>
                      <Select
                        value={item.typeId}
                        onValueChange={(val) =>
                          updateItem(item.tempId, 'typeId', val)
                        }
                        disabled={!item.categoryId}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue
                            placeholder={
                              item.categoryId
                                ? 'Select Type'
                                : 'Select Category'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {itemTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-12 md:col-span-3">
                      <Label className="text-xs mb-1.5 block">
                        Amount <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={item.amount || ''}
                        onChange={(e) =>
                          updateItem(item.tempId, 'amount', e.target.value)
                        }
                        className="h-9"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div className="col-span-12 md:col-span-3">
                      <Label className="text-xs mb-1.5 block">Branch</Label>
                      <Select
                        value={item.branchId}
                        onValueChange={(val) =>
                          updateItem(item.tempId, 'branchId', val)
                        }
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableBranches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-12 md:col-span-3">
                      <Label className="text-xs mb-1.5 block">
                        Payment Method
                      </Label>
                      <Select
                        value={item.paymentMethod}
                        onValueChange={(val: any) =>
                          updateItem(item.tempId, 'paymentMethod', val)
                        }
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="mobile_money">
                            Mobile Money
                          </SelectItem>
                          <SelectItem value="bank_transfer">
                            Bank Transfer
                          </SelectItem>
                          <SelectItem value="credit_card">
                            Credit Card
                          </SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-12 md:col-span-3">
                      <Label className="text-xs mb-1.5 block">Status</Label>
                      <Select
                        value={item.status}
                        onValueChange={(val: any) =>
                          updateItem(item.tempId, 'status', val)
                        }
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-12 md:col-span-3">
                      <Label className="text-xs mb-1.5 block">Reference</Label>
                      <Input
                        placeholder="Ref #"
                        value={item.reference || ''}
                        onChange={(e) =>
                          updateItem(item.tempId, 'reference', e.target.value)
                        }
                        className="h-9"
                      />
                    </div>

                    {/* Row 2: Details */}
                    <div className="col-span-12 md:col-span-6">
                      <Label className="text-xs mb-1.5 block">
                        Description <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        placeholder="Expense details..."
                        value={item.description}
                        onChange={(e) =>
                          updateItem(item.tempId, 'description', e.target.value)
                        }
                        className="min-h-21"
                      />
                    </div>

                    <div className="col-span-12 md:col-span-6">
                      <Label className="text-xs mb-1.5 block">
                        Attachment (Image/PDF)
                      </Label>
                      <ModernFileUpload
                        onFileSelect={(file) =>
                          updateItem(item.tempId, 'attachmentFile', file)
                        }
                        variant="compact"
                        accept="image/*,application/pdf"
                        maxSize={5}
                      >
                        {item.attachmentFile && (
                          <div className="mt-1 text-xs text-muted-foreground flex items-center justify-between">
                            <span className="truncate max-w-50">
                              {item.attachmentFile.name}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateItem(
                                  item.tempId,
                                  'attachmentFile',
                                  undefined
                                );
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </ModernFileUpload>
                    </div>
                  </div>
                </div>
              );
            })}

            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={handleAddItem}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Another Expense Item
            </Button>
          </div>
        </ScrollArea>

        <div className="border-t bg-muted/40 p-4">
          <div className="flex items-center justify-between mb-4 px-2">
            <span className="text-sm font-medium text-muted-foreground">
              Total Amount
            </span>
            <span className="text-xl font-bold">
              {calculateTotal().toFixed(2)}
            </span>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={bulkCreate.isPending || isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={bulkCreate.isPending || isUploading}
            >
              {(bulkCreate.isPending || isUploading) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isUploading
                ? 'Uploading...'
                : `Save ${items.length} Expense${items.length > 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
