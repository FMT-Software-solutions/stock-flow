import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Supplier } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { openExternalUrl } from '@/utils/external-url';
import { cn } from '@/lib/utils';

interface SupplierDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier;
}

export function SupplierDetailsDialog({
  open,
  onOpenChange,
  supplier,
}: SupplierDetailsDialogProps) {
  if (!supplier) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{supplier.name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Contact Person</span>
            <div className="text-sm font-medium">
              {supplier.contactPerson || '-'}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Email</span>
            <div className={cn('text-sm font-medium', !supplier.email && 'text-muted-foreground')}>
              {supplier.email || '-'}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Phone</span>
            <div className={cn('text-sm font-medium', !supplier.phone && 'text-muted-foreground')}>
              {supplier.phone || '-'}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Address</span>
            <div className={cn('text-sm font-medium', !supplier.address && 'text-muted-foreground')}>
              {supplier.address || '-'}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <span className="text-xs text-muted-foreground">Website</span>
            {supplier.website ? (
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{supplier.website}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openExternalUrl(supplier.website!)}
                  className="h-8"
                >
                  <ExternalLink className="mr-2 h-3 w-3" />
                  Open
                </Button>
              </div>
            ) : (
              <div className="text-sm font-medium text-muted-foreground">-</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
