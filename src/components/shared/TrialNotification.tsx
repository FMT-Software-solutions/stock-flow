import { useOrganization } from '@/contexts/OrganizationContext';
import { openExternalUrl } from '@/utils/external-url';
import { TrialNotification as SharedTrialNotification } from '@/shared-packages/trial-package';
import { buyNowURL } from '@/constants/urls';

export function TrialNotification() {
  const { currentOrganization } = useOrganization();

  const handleBuyNow = () => {
    openExternalUrl(buyNowURL);
  };

  return (
    <SharedTrialNotification
      organization={currentOrganization}
      onBuyNow={handleBuyNow}
      storageKeyPrefix="stockflow_trial_notification_"
    />
  );
}
