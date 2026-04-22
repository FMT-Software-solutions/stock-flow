import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSmsBalance } from '../hooks/useSmsBalance';
import { PurchaseModal } from './PurchaseModal';

interface SmsCreditWidgetProps {
  organizationId?: string;
  organizationName?: string;
  organizationEmail?: string;
  organizationPhone?: string;
  userId?: string;
}

export function SmsCreditWidget({
  organizationId,
  organizationName = '',
  organizationEmail = '',
  organizationPhone = '',
  userId
}: SmsCreditWidgetProps) {
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const { data: balance, isLoading } = useSmsBalance(organizationId);

  const creditBalance = balance?.credit_balance || 0;

  return (
    <>
      <div className="flex items-center gap-2 bg-background border rounded-lg px-3 py-[2px]">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground font-semibold uppercase leading-none">
            SMS Credits:
          </span>
          {isLoading ? (
            <div className="h-4 w-12 bg-muted animate-pulse rounded mt-1" />
          ) : (
            <div className="flex items-center gap-1">
              <span title={creditBalance < 50 ? 'Low balance!' : ''} className={`text-sm font-bold leading-none ${creditBalance < 50 ? 'text-destructive' : 'text-foreground'}`}>
                {creditBalance.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10 gap-1"
          onClick={() => setIsPurchaseModalOpen(true)}
        >
          <span className="text-xs hidden sm:inline">Buy more</span>
        </Button>
      </div>

      <PurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        organizationId={organizationId}
        organizationName={organizationName}
        organizationEmail={organizationEmail}
        organizationPhone={organizationPhone}
        userId={userId}
        currentBalance={creditBalance}
      />
    </>
  );
}