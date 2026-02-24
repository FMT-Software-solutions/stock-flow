import React from 'react';
import { Lock } from 'lucide-react';
import { useTrialStatus, type OrganizationLike } from '../hooks/useTrialStatus';
import { Button } from './ui/button';

interface TrialExpiredGuardProps {
  children: React.ReactNode;
  organization?: OrganizationLike | null;
  isLoading?: boolean;
  onBuyNow: () => void;
  onSwitchOrganization: () => void;
  onContactSupport: () => void;
  themeSwitcherComponent?: React.ComponentType;
  organizationName?: string;
}

export function TrialExpiredGuard({
  children,
  organization,
  isLoading,
  onBuyNow,
  onSwitchOrganization,
  onContactSupport,
  themeSwitcherComponent: ThemeSwitcherComponent,
  organizationName,
}: TrialExpiredGuardProps) {
  const { isExpired } = useTrialStatus(organization);

  if (isLoading || !organization) {
    return <>{children}</>;
  }

  if (isExpired) {
    // Blocking Overlay (replaces content)
    return (
      <div className="flex flex-col items-center justify-center p-4 h-screen w-screen fixed top-0 left-0 z-50 ">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center dark:bg-red-900/20">
            <Lock className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Trial Expired</h1>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Your organization's trial period has ended. To continue using the application, please purchase.
            </p>
          </div>

          <div className="bg-card border rounded-lg p-4 text-sm text-left shadow-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500 dark:text-gray-400">Organization</span>
              <span className="font-medium">{organizationName || organization.id}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500 dark:text-gray-400">Status</span>
              <span className="text-red-600 font-medium">Expired</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onBuyNow}
              size="lg"
              className="flex-1"
            >
              Buy Now
            </Button>
            <Button
              onClick={onSwitchOrganization}
              variant="outline"
              size="lg"
              className="flex-1"
            >
              Switch Organization
            </Button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-8">
            Need help?{' '}
            <button
              onClick={onContactSupport}
              className="text-xs px-0 underline hover:text-gray-900 dark:hover:text-gray-50 bg-transparent border-none cursor-pointer"
            >
              Contact Support
            </button>
          </p>

          {ThemeSwitcherComponent && (
            <div className="flex justify-center">
              <ThemeSwitcherComponent />
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
