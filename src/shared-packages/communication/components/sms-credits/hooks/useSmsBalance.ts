import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';

interface SmsBalance {
  credit_balance: number;
}

export function useSmsBalance(organizationId?: string) {
  return useQuery({
    queryKey: ['sms_balance', organizationId],
    queryFn: async (): Promise<SmsBalance | null> => {
      if (!organizationId) return null;

      const { data, error } = await supabase
        .from('organization_sms_balances')
        .select('credit_balance')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching SMS balance:', error);
        throw error;
      }

      return data || { credit_balance: 0 };
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60, // Consider data fresh for 1 minute
  });
}