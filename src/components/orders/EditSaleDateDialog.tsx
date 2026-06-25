import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/shared/DatePicker';
import { toast } from 'sonner';
import { useApplySalesDateEdit } from '@/lib/action-requests/hooks';
import type { ActionRequestItem } from '@/lib/action-requests/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ActionRequestItem;
}

export function EditSaleDateDialog({ open, onOpenChange, item }: Props) {
  const apply = useApplySalesDateEdit();
  const originalIso = item.snapshot?.date as string | undefined;
  const original = originalIso ? new Date(originalIso) : undefined;
  const orderNumber = (item.snapshot?.order_number as string | undefined) ?? item.entity_id.slice(0, 8);

  const [newDate, setNewDate] = useState<Date | undefined>(original);

  useEffect(() => {
    if (open) setNewDate(original);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = () => {
    if (!newDate) {
      toast.error('Pick a date');
      return;
    }
    if (newDate > new Date()) {
      toast.error('Date cannot be in the future');
      return;
    }
    apply.mutate(
      { itemId: item.id, newDate },
      {
        onSuccess: () => {
          toast.success('Sale date updated');
          onOpenChange(false);
        },
        onError: (e: any) => {
          toast.error(e.message ?? 'Failed to update sale date');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update sale date</DialogTitle>
          <DialogDescription>
            Order <span className="font-mono font-medium">#{orderNumber}</span>
            {original && (
              <>
                {' · '}originally <span className="font-medium">{format(original, 'MMM dd, yyyy h:mm a')}</span>
              </>
            )}
            . This edit can only be applied once; you'll need a new request to change it again.
          </DialogDescription>
        </DialogHeader>
        <DatePicker
          date={newDate}
          setDate={setNewDate}
          label="New sale date"
          maxDate={new Date()}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={apply.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={apply.isPending || !newDate}>
            {apply.isPending ? 'Saving...' : 'Update date'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
