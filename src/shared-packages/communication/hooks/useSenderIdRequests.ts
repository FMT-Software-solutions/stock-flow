import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { toast } from 'sonner';
import { API_ENDPOINTS, APP_ID } from '@/config/endpoints';

export interface SenderIdRequest {
  id: string;
  organization_id: string;
  sender_id: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export const senderIdKeys = {
  all: ['sender_id_requests'] as const,
  list: (orgId: string | undefined) => [...senderIdKeys.all, orgId] as const,
};

export function useSenderIdRequests(organizationId: string | undefined) {
  return useQuery({
    queryKey: senderIdKeys.list(organizationId),
    queryFn: async (): Promise<SenderIdRequest[]> => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('sender_id_requests')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Failed to load Sender ID requests');
        throw error;
      }

      return data || [];
    },
    enabled: !!organizationId,
  });
}

export function useCreateSenderIdRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      organizationName,
      senderId,
      reason,
    }: {
      organizationId: string;
      organizationName: string;
      senderId: string;
      reason: string;
    }) => {
      const { data, error } = await supabase
        .from('sender_id_requests')
        .insert({
          organization_id: organizationId,
          sender_id: senderId,
          reason,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes('Maximum of 3 sender IDs')) {
          throw new Error('Maximum of 3 sender IDs allowed per organization');
        }
        if (error.code === '23505') { // Unique violation
          throw new Error('This Sender ID has already been requested.');
        }
        throw new Error(error.message);
      }

      // Notify admins
      try {
        await fetch(API_ENDPOINTS.SMS.NOTIFY_SENDER_ID, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationName,
            senderId,
            reason,
            action: 'created',
            appId: APP_ID,
            appName: 'StockFlow',
          }),
        });
      } catch (err) {
        console.error('Failed to notify admin of sender ID request', err);
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: senderIdKeys.list(variables.organizationId),
      });
      toast.success('Sender ID request submitted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit Sender ID request');
    },
  });
}

export function useUpdateSenderIdRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      organizationName,
      senderId,
      reason,
    }: {
      id: string;
      organizationName: string;
      senderId: string;
      reason: string;
    }) => {
      const { data, error } = await supabase
        .from('sender_id_requests')
        .update({
          sender_id: senderId,
          reason,
          status: 'pending', // Resubmitting sets it back to pending
          rejection_reason: null, // Clear the rejection reason on resubmit
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique violation
          throw new Error('This Sender ID has already been requested.');
        }
        throw new Error(error.message);
      }

      // Notify admins
      try {
        await fetch(API_ENDPOINTS.SMS.NOTIFY_SENDER_ID, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationName,
            senderId,
            reason,
            action: 'resubmitted',
            appId: APP_ID,
            appName: 'StockFlow',
          }),
        });
      } catch (err) {
        console.error('Failed to notify admin of sender ID request resubmission', err);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: senderIdKeys.all });
      toast.success('Sender ID request resubmitted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to resubmit Sender ID request');
    },
  });
}

export function useDeleteSenderIdRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sender_id_requests')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      // Invalidate all since we don't have the orgId easily accessible here
      // or we can just invalidate the 'all' key
      queryClient.invalidateQueries({ queryKey: senderIdKeys.all });
      toast.success('Sender ID request deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete Sender ID request');
    },
  });
}
