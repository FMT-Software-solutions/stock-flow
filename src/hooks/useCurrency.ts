import { useOrganization } from '@/contexts/OrganizationContext';
import { useCallback } from 'react';

export function useCurrency() {
  const { currentOrganization } = useOrganization();
  const currency = currentOrganization?.currency || 'GHS';

  const formatCurrency = useCallback(
    (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
      }).format(amount);
    },
    [currency]
  );

  return {
    currency,
    formatCurrency,
  };
}
