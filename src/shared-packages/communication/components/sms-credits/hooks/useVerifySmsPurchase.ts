import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_ENDPOINTS, APP_ID } from '@/config/endpoints';

interface VerifyPurchaseParams {
  organizationId: string;
  userId: string;
  reference: string;
  amountGhs: number;
  creditsPurchased: number;
  organizationName?: string;
  appName?: string;
}

export function useVerifySmsPurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: VerifyPurchaseParams) => {
      const response = await fetch(API_ENDPOINTS.PAYMENTS.VERIFY_SMS_PURCHASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...params, appId: APP_ID }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to verify payment');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate both the balance and transactions so they update immediately
      queryClient.invalidateQueries({ queryKey: ['sms_balance', variables.organizationId] });
      queryClient.invalidateQueries({ queryKey: ['sms_transactions', variables.organizationId] });
    },
  });
}