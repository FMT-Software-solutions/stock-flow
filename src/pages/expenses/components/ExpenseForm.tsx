import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { ModernFileUpload } from '@/components/shared/ModernFileUpload';
import { DatePicker } from '@/components/shared/DatePicker';
import { Loader2, Trash2 } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBranchContext } from '@/contexts/BranchContext';
import {
  useExpenseCategories,
  useExpenseTypes,
} from '@/hooks/useExpenseQueries';
import { format } from 'date-fns';
import { uploadAttachment } from '@/utils/attachment-upload';
import { toast } from 'sonner';
import type { Expense, ExpenseInput } from '@/types/expenses';
import { openExternalUrl } from '@/utils/external-url';

interface ExpenseFormProps {
  initialData?: Partial<Expense>;
  onSubmit: (data: ExpenseInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ExpenseForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting: externalIsSubmitting,
}: ExpenseFormProps) {
  const { currentOrganization } = useOrganization();
  const { availableBranches } = useBranchContext();
  const organizationId = currentOrganization?.id;

  const { data: categories = [] } = useExpenseCategories(organizationId);
  const { data: allTypes = [] } = useExpenseTypes(organizationId);

  const [formData, setFormData] = useState<
    Partial<ExpenseInput> & { attachmentFile?: File }
  >({
    date: new Date().toISOString().split('T')[0],
    categoryId: '',
    description: '',
    paymentMethod: 'cash',
    status: 'pending',
    branchId: availableBranches[0]?.id,
    organizationId,
    ...initialData,
    // Ensure amount is number or undefined
    amount: initialData?.amount ? Number(initialData.amount) : undefined,
  });

  const [isUploading, setIsUploading] = useState(false);
  const isSubmitting = externalIsSubmitting || isUploading;

  const itemTypes = allTypes.filter(
    (t) => t.categoryId === formData.categoryId
  );

  const updateField = (field: keyof typeof formData, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'categoryId') {
        updated.typeId = undefined;
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!organizationId) return;

    // Validation
    if (
      !formData.amount ||
      !formData.categoryId ||
      !formData.description ||
      !formData.date
    ) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setIsUploading(true);

    try {
      let attachmentUrl = formData.attachmentUrl;

      // Upload new file if selected
      if (formData.attachmentFile) {
        try {
          const result = await uploadAttachment(
            formData.attachmentFile,
            organizationId
          );
          attachmentUrl = result.url;
        } catch (error) {
          console.error('Failed to upload attachment:', error);
          toast.error('Failed to upload attachment');
          setIsUploading(false);
          return;
        }
      }

      const expenseData: ExpenseInput = {
        date: formData.date!,
        amount: Number(formData.amount),
        categoryId: formData.categoryId!,
        typeId: formData.typeId,
        description: formData.description!,
        paymentMethod: formData.paymentMethod || 'cash',
        status: formData.status || 'pending',
        reference: formData.reference,
        branchId: formData.branchId,
        organizationId: organizationId,
        attachmentUrl: attachmentUrl,
      };

      await onSubmit(expenseData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3 py-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Date */}
        <div className="space-y-1">
          <Label>
            Date <span className="text-destructive">*</span>
          </Label>
          <DatePicker
            date={formData.date ? new Date(formData.date) : undefined}
            setDate={(date) =>
              updateField('date', date ? format(date, 'yyyy-MM-dd') : '')
            }
          />
        </div>

        {/* Amount */}
        <div className="space-y-1">
          <Label>
            Amount <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            placeholder="0.00"
            value={formData.amount || ''}
            onChange={(e) => updateField('amount', e.target.value)}
            min="0"
            step="0.01"
          />
        </div>

        {/* Category */}
        <div className="space-y-1">
          <Label>
            Category <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.categoryId}
            onValueChange={(val) => updateField('categoryId', val)}
          >
            <SelectTrigger className="w-full">
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

        {/* Type */}
        <div className="space-y-1">
          <Label>Type</Label>
          <Select
            value={formData.typeId}
            onValueChange={(val) => updateField('typeId', val)}
            disabled={!formData.categoryId}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  formData.categoryId ? 'Select Type' : 'Select Category'
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

        {/* Branch */}
        <div className="space-y-1">
          <Label>Branch</Label>
          <Select
            value={formData.branchId}
            onValueChange={(val) => updateField('branchId', val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Branch" />
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

        {/* Payment Method */}
        <div className="space-y-1">
          <Label>Payment Method</Label>
          <Select
            value={formData.paymentMethod}
            onValueChange={(val: any) => updateField('paymentMethod', val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="mobile_money">Mobile Money</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="credit_card">Credit Card</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-1">
          <Label>Status</Label>
          <Select
            value={formData.status}
            onValueChange={(val: any) => updateField('status', val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reference */}
        <div className="space-y-1">
          <Label>Reference</Label>
          <Input
            placeholder="Ref #"
            value={formData.reference || ''}
            onChange={(e) => updateField('reference', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Description */}
        <div className="space-y-1">
          <Label>
            Description <span className="text-destructive">*</span>
          </Label>
          <Textarea
            placeholder="Expense details..."
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            className="min-h-25"
          />
        </div>

        {/* Attachment */}
        <div className="space-y-1">
          <Label>Attachment (Image/PDF)</Label>
          <ModernFileUpload
            onFileSelect={(file) => updateField('attachmentFile', file)}
            variant="compact"
            accept="image/*,application/pdf"
            maxSize={5}
          >
            {(formData.attachmentFile || formData.attachmentUrl) && (
              <div className="mt-1 text-xs text-muted-foreground flex items-center justify-between bg-muted/50 p-2 rounded">
                <span className="truncate max-w-50">
                  {formData.attachmentFile?.name || 'Current Attachment'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateField('attachmentFile', undefined);
                    if (formData.attachmentUrl && !formData.attachmentFile) {
                      // If removing existing url
                      updateField('attachmentUrl', null);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </ModernFileUpload>
          {formData.attachmentUrl && !formData.attachmentFile && (
            <div className="text-xs text-blue-500 mt-1">
              <button
                type="button"
                onClick={() => openExternalUrl(formData.attachmentUrl!)}
                className="hover:underline bg-transparent border-0 p-0 cursor-pointer text-blue-500"
              >
                View existing attachment
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
