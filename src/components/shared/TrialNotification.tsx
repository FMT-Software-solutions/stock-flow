import { useEffect, useState } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@/contexts/OrganizationContext';
import { openExternalUrl } from '@/utils/external-url';

export function TrialNotification() {
  const { currentOrganization } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);

  useEffect(() => {
    if (
      !currentOrganization ||
      currentOrganization.has_purchased ||
      !currentOrganization.trial_end_date
    )
      return;

    const daysLeft = differenceInDays(
      parseISO(currentOrganization.trial_end_date),
      new Date()
    );
    setDaysRemaining(daysLeft);

    // "3 Days to end of trial" (Logic: 3 days or less, but not expired yet)
    // We only show it if it hasn't been shown TODAY.
    if (daysLeft <= 3 && daysLeft >= 0) {
      const lastShownKey = `trial_notification_shown_${currentOrganization.id}`;
      const lastShownDate = localStorage.getItem(lastShownKey);
      const today = new Date().toISOString().split('T')[0];

      if (lastShownDate !== today) {
        setIsOpen(true);
      }
    }
  }, [currentOrganization]);

  const handleClose = () => {
    setIsOpen(false);
    if (currentOrganization) {
      const lastShownKey = `trial_notification_shown_${currentOrganization.id}`;
      localStorage.setItem(
        lastShownKey,
        new Date().toISOString().split('T')[0]
      );
    }
  };

  const handleBuyNow = () => {
    handleClose();

    openExternalUrl(
      `https://fmtsoftware.com/store/stockflow/buy?org=${currentOrganization?.id}`
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trial Ending Soon</DialogTitle>
          <DialogDescription>
            Your trial will expire in{' '}
            <span className="font-semibold text-foreground">
              {daysRemaining} days
            </span>
            . Please make a purchase to continue using all features without
            interruption.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Remind Me Later
          </Button>
          <Button onClick={handleBuyNow}>Buy Now</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
