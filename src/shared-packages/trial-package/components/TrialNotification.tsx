import { useEffect, useState } from 'react';
import { useTrialStatus, type OrganizationLike } from '../hooks/useTrialStatus';
import { Button } from './ui/button';

interface TrialNotificationProps {
  organization?: OrganizationLike | null;
  onBuyNow: () => void;
  storageKeyPrefix?: string; // e.g. "trial_notification_shown_"
}

export function TrialNotification({
  organization,
  onBuyNow,
  storageKeyPrefix = 'trial_notification_shown_'
}: TrialNotificationProps) {
  const { daysRemaining, isActiveTrial, hasPurchased } = useTrialStatus(organization);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!organization || hasPurchased || !isActiveTrial) return;

    // "3 Days to end of trial" logic
    if (daysRemaining <= 3 && daysRemaining >= 0) {
      const lastShownKey = `${storageKeyPrefix}${organization.id}`;
      const lastShownDate = localStorage.getItem(lastShownKey);
      const today = new Date().toISOString().split('T')[0];

      if (lastShownDate !== today) {
        setIsOpen(true);
      }
    }
  }, [organization, daysRemaining, hasPurchased, isActiveTrial, storageKeyPrefix]);

  const handleClose = () => {
    setIsOpen(false);
    if (organization) {
      const lastShownKey = `${storageKeyPrefix}${organization.id}`;
      localStorage.setItem(
        lastShownKey,
        new Date().toISOString().split('T')[0]
      );
    }
  };

  const handleBuyNow = () => {
    handleClose();
    onBuyNow();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center bg-black/50 p-4 animate-in fade-in-0">
      <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white dark:bg-zinc-950 p-6 shadow-lg duration-200 sm:rounded-lg">
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <h2 className="text-lg font-semibold leading-none tracking-tight text-zinc-950 dark:text-zinc-50">
            Trial Ending Soon
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Your trial will expire in{' '}
            <span className="font-semibold text-zinc-950 dark:text-zinc-50">
              {daysRemaining} days
            </span>
            . Please make a purchase to continue using all features without interruption.
          </p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button
            onClick={handleClose}
            variant="outline"
            className="mt-2 sm:mt-0"
          >
            Remind Me Later
          </Button>
          <Button
            onClick={handleBuyNow}
          >
            Buy Now
          </Button>
        </div>
      </div>
    </div>
  );
}
