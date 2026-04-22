import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface CommunicationHistory {
  id: string;
  organization_id: string;
  type: 'sms' | 'email';
  subject?: string;
  content: string;
  recipient_type: string;
  recipient_ids?: any;
  recipient_count: number;
  status: 'pending' | 'sent' | 'failed';
  sent_by?: string;
  sent_at?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export const historyKeys = {
  all: ['communication-history'] as const,
  lists: () => [...historyKeys.all, 'list'] as const,
  list: (orgId: string) => [...historyKeys.lists(), orgId] as const,
};

export function useCommunicationHistory() {
  const { currentOrganization } = useOrganization();

  return useQuery({
    queryKey: historyKeys.list(currentOrganization?.id || ''),
    queryFn: async (): Promise<CommunicationHistory[]> => {
      if (!currentOrganization?.id) return [];

      const { data, error } = await supabase
        .from('communication_history')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CommunicationHistory[];
    },
    enabled: !!currentOrganization?.id,
  });
}

export function useCreateCommunicationHistory() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();

  return useMutation({
    mutationFn: async (history: Omit<CommunicationHistory, 'id' | 'organization_id' | 'created_at'>) => {
      if (!currentOrganization?.id) throw new Error('No organization selected');

      const { data, error } = await supabase
        .from('communication_history')
        .insert({
          ...history,
          organization_id: currentOrganization.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: historyKeys.lists() });
    },
  });
}
