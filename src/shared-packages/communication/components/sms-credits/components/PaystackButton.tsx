import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { API_ENDPOINTS, APP_ID } from '@/config/endpoints';

interface PaystackButtonProps {
  email: string;
  amountGhs: number;
  creditsPurchased: number;
  organizationId: string;
  organizationName?: string;
  userId: string;
  isProcessing?: boolean;
  disabled?: boolean;
}

export function PaystackButton({
  email,
  amountGhs,
  creditsPurchased,
  organizationId,
  organizationName,
  userId,
  isProcessing = false,
  disabled = false,
}: PaystackButtonProps) {
  const [isInitializing, setIsInitializing] = useState(false);

  const handlePayment = async () => {
    setIsInitializing(true);
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('verify_payment', 'true');
      currentUrl.searchParams.set('amount', amountGhs.toString());
      currentUrl.searchParams.set('credits', creditsPurchased.toString());
      if (organizationName) {
        currentUrl.searchParams.set('org_name', organizationName);
      }
      currentUrl.searchParams.set('app_name', 'StockFlow');
      // Optionally preserve which tab we were on
      currentUrl.searchParams.set('tab', 'billing');

      const response = await fetch(API_ENDPOINTS.PAYMENTS.INITIALIZE_SMS_PURCHASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amountGhs,
          email,
          callbackUrl: currentUrl.toString(),
          organizationId,
          organizationName: organizationName || 'Unknown Organization',
          userId,
          appId: APP_ID,
          appName: 'StockFlow',
          creditsPurchased,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.authorizationUrl) {
        throw new Error(data.message || 'Failed to initialize payment');
      }

      // Redirect the user to Paystack's hosted page in the same window
      window.location.href = data.authorizationUrl;
    } catch (error: any) {
      toast.error(error.message || 'Failed to initialize payment gateway');
      setIsInitializing(false);
    }
  };

  const loading = isProcessing || isInitializing;

  return (
    <Button
      onClick={handlePayment}
      disabled={disabled || loading}
      className="w-full"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Redirecting...
        </>
      ) : (
        `Pay GHS ${amountGhs.toFixed(2)}`
      )}
    </Button>
  );
}