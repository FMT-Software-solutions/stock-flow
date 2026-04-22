import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export interface CommunicationTemplate {
  id: string;
  organization_id: string;
  name: string;
  type: 'sms' | 'email';
  subject?: string;
  content: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export const templateKeys = {
  all: ['communication-templates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
  list: (orgId: string) => [...templateKeys.lists(), orgId] as const,
};

export function useCommunicationTemplates() {
  const { currentOrganization } = useOrganization();

  return useQuery({
    queryKey: templateKeys.list(currentOrganization?.id || ''),
    queryFn: async (): Promise<CommunicationTemplate[]> => {
      if (!currentOrganization?.id) return [];

      const { data, error } = await supabase
        .from('communication_templates')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CommunicationTemplate[];
    },
    enabled: !!currentOrganization?.id,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();

  return useMutation({
    mutationFn: async (template: Omit<CommunicationTemplate, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
      if (!currentOrganization?.id) throw new Error('No organization selected');

      const { data, error } = await supabase
        .from('communication_templates')
        .insert({
          ...template,
          organization_id: currentOrganization.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      toast.success('Template saved successfully');
    },
    onError: (error) => {
      console.error('Failed to save template:', error);
      toast.error('Failed to save template');
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('communication_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      toast.success('Template deleted');
    },
    onError: (error) => {
      console.error('Failed to delete template:', error);
      toast.error('Failed to delete template');
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<CommunicationTemplate, 'id' | 'organization_id' | 'created_at' | 'updated_at'>> }) => {
      const { data, error } = await supabase
        .from('communication_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to update template:', error);
      toast.error('Failed to update template');
    },
  });
}
