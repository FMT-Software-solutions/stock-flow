import { useEffect, useState } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { openExternalUrl } from '@/utils/external-url';
import { ThemeSwitcher } from './ThemeSwitcher';

export function TrialExpiredGuard({ children }: { children: React.ReactNode }) {
  const { currentOrganization, isLoading } = useOrganization();
  const navigate = useNavigate();
  const [isExpired, setIsExpired] = useState(false);

  const handleContactFMT = () => {
    openExternalUrl('https://fmtsoftware.com/contact');
  };

  const handleBuyNow = () => {
    openExternalUrl(
      `https://fmtsoftware.com/store/stockflow/buy?org=${currentOrganization?.id}`
    );
  };

  useEffect(() => {
    if (isLoading || !currentOrganization) {
      setIsExpired(false);
      return;
    }

    if (currentOrganization.has_purchased) {
      setIsExpired(false);
      return;
    }

    if (!currentOrganization.trial_end_date) {
      // If no trial date and not purchased, what to do?
      // Assume active or handle as edge case. For now, let it pass.
      setIsExpired(false);
      return;
    }

    const daysLeft = differenceInDays(
      parseISO(currentOrganization.trial_end_date),
      new Date()
    );

    // Check if expired (less than 0 days means yesterday was the last day, so strictly negative usually means expired depending on logic)
    // differenceInDays(later, earlier) returns positive.
    // if end date is today, difference is 0. Trial usually includes the end date.
    // So expired means daysLeft < 0.
    if (daysLeft < 0) {
      setIsExpired(true);
    } else {
      setIsExpired(false);
    }
  }, [currentOrganization, isLoading]);

  if (isExpired) {
    // Blocking Overlay (replaces content)
    return (
      <div className="bg-background flex flex-col items-center justify-center p-4 h-screen">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center dark:bg-red-900/20">
            <Lock className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Trial Expired</h1>
            <p className="text-xs text-muted-foreground">
              Your organization's trial period has ended. To continue using
              StockFlow, please purchase.
            </p>
          </div>

          <div className="bg-card border rounded-lg p-4 text-sm text-left shadow-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Organization</span>
              <span className="font-medium">{currentOrganization?.name}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Status</span>
              <span className="text-red-600 font-medium">Expired</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button size="lg" className="flex-1" onClick={handleBuyNow}>
              Buy Now
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/select-organization')}
            >
              Switch Organization
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-8">
            Need help?{' '}
            <Button
              onClick={handleContactFMT}
              variant="link"
              className="text-xs px-0 underline hover:text-primary"
            >
              Contact Support
            </Button>
          </p>
          <div className="flex justify-center">
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
