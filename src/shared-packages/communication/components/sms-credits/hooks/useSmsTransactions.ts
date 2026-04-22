import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import type { SmsTransaction } from '../types/sms-credits';

export function useSmsTransactions(organizationId?: string) {
  return useQuery<SmsTransaction[]>({
    queryKey: ['sms_transactions', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('sms_credit_transactions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(50); // Get latest 50 for now

      if (error) throw new Error(error.message);

      return data as SmsTransaction[];
    },
    enabled: !!organizationId,
  });
}