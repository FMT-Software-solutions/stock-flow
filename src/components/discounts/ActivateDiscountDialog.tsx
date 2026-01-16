import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/shared/DatePicker';
import { TimePicker } from '@/components/shared/TimePicker';
import { format } from 'date-fns';
import type { Discount } from '@/types/discounts';
import { useUpdateDiscountFields } from '@/hooks/useDiscountQueries';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ActivateDiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discount: Discount;
}

export function ActivateDiscountDialog({
  open,
  onOpenChange,
  discount,
}: ActivateDiscountDialogProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(
    discount.startAt ? new Date(discount.startAt) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    discount.expiresAt ? new Date(discount.expiresAt) : undefined
  );
  const [startTime, setStartTime] = useState<string>(
    discount.startAt ? format(new Date(discount.startAt), 'HH:mm') : '00:00'
  );
  const [endTime, setEndTime] = useState<string>(
    discount.expiresAt ? format(new Date(discount.expiresAt), 'HH:mm') : '23:59'
  );
  const { mutate: updateDiscount, isPending } = useUpdateDiscountFields();

  const combineDateTimeToIso = (date?: Date, time?: string) => {
    if (!date) return null;
    const t = time || '00:00';
    const yyyyMmDd = format(date, 'yyyy-MM-dd');
    return new Date(`${yyyyMmDd}T${t}:00`).toISOString();
  };

  const handleSave = () => {
    updateDiscount(
      {
        id: discount.id,
        startAt: combineDateTimeToIso(startDate, startTime),
        expiresAt: combineDateTimeToIso(endDate, endTime),
        isActive: true,
        timesUsed: 0,
      },
      {
        onSuccess: () => {
          toast.success('Discount activated');
          onOpenChange(false);
        },
        onError: (e: unknown) => {
          const msg =
            (e as { message?: string })?.message ||
            'Failed to activate discount';
          toast.error(msg);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Activate Discount</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Start Date</div>
            <DatePicker date={startDate} setDate={setStartDate} />
            <TimePicker
              value={startTime}
              onChange={(val?: string) => setStartTime(val ?? startTime)}
              placeholder="Pick time"
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">End Date</div>
            <DatePicker date={endDate} setDate={setEndDate} />
            <TimePicker
              value={endTime}
              onChange={(val?: string) => setEndTime(val ?? endTime)}
              placeholder="Pick time"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save & Activate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
