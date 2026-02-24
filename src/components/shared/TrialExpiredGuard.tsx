import { useOrganization } from '@/contexts/OrganizationContext';
import { useNavigate } from 'react-router-dom';
import { openExternalUrl } from '@/utils/external-url';
import { ThemeSwitcher } from './ThemeSwitcher';
import { TrialExpiredGuard as SharedTrialExpiredGuard } from '@/shared-packages/trial-package';
import { buyNowURL, contactSupportURL } from '@/constants/urls';

export function TrialExpiredGuard({ children }: { children: React.ReactNode }) {
  const { currentOrganization, isLoading } = useOrganization();
  const navigate = useNavigate();

  const handleContactSupport = () => {
    openExternalUrl(contactSupportURL);
  };

  const handleBuyNow = () => {
    openExternalUrl(buyNowURL);
  };

  const handleSwitchOrganization = () => {
    navigate('/select-organization');
  };

  return (
    <SharedTrialExpiredGuard
      organization={currentOrganization}
      isLoading={isLoading}
      onBuyNow={handleBuyNow}
      onSwitchOrganization={handleSwitchOrganization}
      onContactSupport={handleContactSupport}
      organizationName={currentOrganization?.name}
      themeSwitcherComponent={ThemeSwitcher}
    >
      {children}
    </SharedTrialExpiredGuard>
  );
}
