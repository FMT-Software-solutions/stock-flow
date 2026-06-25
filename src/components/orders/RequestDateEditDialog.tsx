import { useMemo, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useCreateActionRequest } from '@/lib/action-requests/hooks';
import { SALES_EDIT_DATE } from '@/lib/action-requests/registry';
import { useActiveItemsInOrg } from '@/lib/action-requests/useApprovedItemsForUser';
import type { Order } from '@/types/orders';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
  onSubmitted?: () => void;
}

export function RequestDateEditDialog({ open, onOpenChange, orders, onSubmitted }: Props) {
  const [reason, setReason] = useState('');
  const create = useCreateActionRequest();
  const { data: active } = useActiveItemsInOrg({
    actionType: SALES_EDIT_DATE,
    entityType: 'order',
  });

  const { eligible, locked } = useMemo(() => {
    const lockedRows: Order[] = [];
    const eligibleRows: Order[] = [];
    for (const o of orders) {
      if (active?.has(o.id)) lockedRows.push(o);
      else eligibleRows.push(o);
    }
    return { eligible: eligibleRows, locked: lockedRows };
  }, [orders, active]);

  const handleSubmit = () => {
    if (eligible.length === 0) {
      toast.error('All selected sales already have an open request');
      return;
    }
    create.mutate(
      {
        actionType: SALES_EDIT_DATE,
        reason: reason.trim() || undefined,
        items: eligible.map((o) => ({
          entityId: o.id,
          snapshot: {
            order_number: o.order_number,
            date: o.date,
          },
        })),
      },
      {
        onSuccess: () => {
          toast.success(
            `Request submitted for ${eligible.length} sale${eligible.length === 1 ? '' : 's'}`
          );
          setReason('');
          onOpenChange(false);
          onSubmitted?.();
        },
        onError: (e: any) => {
          toast.error(e.message ?? 'Failed to submit request');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request sales date edit</DialogTitle>
          <DialogDescription>
            An approver will review. Once they approve, you can update each sale's date — but only once per request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">
              Selected sales ({orders.length})
            </Label>
            <ScrollArea className="h-32 mt-1 rounded-md border">
              <ul className="p-2 text-xs space-y-1">
                {orders.map((o) => {
                  const isLocked = active?.has(o.id);
                  return (
                    <li key={o.id} className="flex justify-between items-center">
                      <span className="font-mono">#{o.order_number}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {format(new Date(o.date), 'MMM dd, yyyy h:mm a')}
                        </span>
                        {isLocked && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                            already requested
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
            {locked.length > 0 && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                {locked.length} of these already have an open request and will be skipped.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="reason" className="text-xs">
              Reason (optional)
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Recorded these late after the internet outage on June 18."
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={create.isPending || eligible.length === 0}>
            {create.isPending
              ? 'Submitting...'
              : eligible.length === orders.length
                ? 'Submit request'
                : `Submit for ${eligible.length} sale${eligible.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
