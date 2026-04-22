import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import { SMS_PURCHASE_TIERS } from '../types/sms-credits';
import type { SmsPurchaseTier } from '../types/sms-credits';
import { PaystackButton } from './PaystackButton';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId?: string;
  organizationName?: string;
  organizationEmail?: string;
  organizationPhone?: string;
  userId?: string;
  currentBalance: number;
}

export function PurchaseModal({
  isOpen,
  onClose,
  organizationId,
  organizationName = '',
  organizationEmail = '',
  userId,
  currentBalance,
}: PurchaseModalProps) {
  const [selectedTier, setSelectedTier] = useState<SmsPurchaseTier | null>(null);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Purchase SMS Credits</DialogTitle>
          <DialogDescription>
            Current Balance: <strong className="text-foreground">{currentBalance.toLocaleString()} credits</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 py-4">
          {SMS_PURCHASE_TIERS.map((tier) => (
            <Card
              key={tier.amountGhs}
              className={`p-4 cursor-pointer hover:border-primary transition-all text-center flex flex-col items-center justify-center space-y-2 relative overflow-hidden ${selectedTier?.amountGhs === tier.amountGhs ? 'border-primary bg-primary/5 ring-2 ring-primary ring-offset-2' : ''
                }`}
              onClick={() => setSelectedTier(tier)}
            >
              {selectedTier?.amountGhs === tier.amountGhs && (
                <div className="absolute top-0 right-0 p-1">
                  <CheckCircle2 className="h-4 w-4 text-primary fill-primary/20" />
                </div>
              )}
              <div className="space-y-1">
                <p className="font-bold text-xl leading-none">{tier.credits.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground uppercase">Credits</p>
              </div>
              <Badge variant={selectedTier?.amountGhs === tier.amountGhs ? 'default' : 'secondary'} className="mt-2 w-full justify-center text-sm">
                GHS {tier.amountGhs.toFixed(2)}
              </Badge>
            </Card>
          ))}
        </div>

        {selectedTier && (
          <div className="bg-muted p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 animate-in slide-in-from-bottom-4">
            <div className="text-center sm:text-left">
              <p className="text-sm text-muted-foreground">You are purchasing</p>
              <p className="font-bold text-lg">{selectedTier.credits.toLocaleString()} SMS Credits</p>
            </div>
            <div className="w-full sm:w-auto min-w-[200px]">
              <PaystackButton
                email={organizationEmail || 'admin@example.com'}
                amountGhs={selectedTier.amountGhs}
                creditsPurchased={selectedTier.credits}
                organizationId={organizationId || ''}
                organizationName={organizationName}
                userId={userId || ''}
                disabled={!organizationId || !userId}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}