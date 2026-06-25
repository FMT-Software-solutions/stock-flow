import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import type {
  ActionRequest,
  ActionRequestItem,
  ActionRequestItemState,
} from './types';
import { getActionDefinition } from './registry';

// FK names below MUST match the constraints in the DB. `requested_by` and `reviewed_by`
// each have multiple FKs (auth.users + profiles), so we name the profiles FK explicitly.
const REQUEST_SELECT = `
  *,
  items:action_request_items(*),
  requester:profiles!action_requests_requested_by_fkey2(first_name, last_name),
  reviewer:profiles!action_requests_reviewed_by_fkey2(first_name, last_name)
`;

export function useActionRequests(params?: {
  actionType?: string;
  scope?: 'mine' | 'pending_review' | 'all';
  /** Background poll interval in ms. Omit to disable polling. */
  pollMs?: number;
}) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const orgId = currentOrganization?.id;
  const userId = user?.id;
  const scope = params?.scope ?? 'all';

  return useQuery({
    queryKey: ['action_requests', orgId, params?.actionType ?? 'all', scope, userId],
    queryFn: async () => {
      if (!orgId) return [];
      let query = supabase
        .from('action_requests')
        .select(REQUEST_SELECT)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (params?.actionType) {
        query = query.eq('action_type', params.actionType);
      }
      if (scope === 'mine' && userId) {
        query = query.eq('requested_by', userId);
      }
      if (scope === 'pending_review') {
        query = query.in('status', ['pending', 'partially_approved']);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ActionRequest[];
    },
    enabled: !!orgId,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: params?.pollMs,
  });
}

export function useActiveActionGrant(params: {
  actionType: string;
  entityType: string;
  entityId?: string;
}) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: [
      'action_request_grant',
      params.actionType,
      params.entityType,
      params.entityId,
      userId,
    ],
    queryFn: async () => {
      if (!userId || !params.entityId) return null;
      const { data, error } = await supabase
        .from('action_request_items')
        .select('id, request_id, action_requests!inner(requested_by, action_type)')
        .eq('entity_type', params.entityType)
        .eq('entity_id', params.entityId)
        .eq('state', 'approved')
        .eq('action_requests.requested_by', userId)
        .eq('action_requests.action_type', params.actionType)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; request_id: string } | null;
    },
    enabled: !!userId && !!params.entityId,
  });
}

interface CreateRequestInput {
  actionType: string;
  reason?: string;
  payload?: Record<string, unknown>;
  items: Array<{
    entityId: string;
    snapshot: Record<string, unknown>;
  }>;
}

export function useCreateActionRequest() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateRequestInput) => {
      if (!currentOrganization?.id || !user?.id) {
        throw new Error('Not in an organization');
      }
      const def = getActionDefinition(input.actionType);
      if (!def) throw new Error(`Unknown action_type: ${input.actionType}`);

      const { data: request, error: reqErr } = await supabase
        .from('action_requests')
        .insert({
          organization_id: currentOrganization.id,
          action_type: input.actionType,
          requested_by: user.id,
          reason: input.reason ?? null,
          payload: input.payload ?? {},
        })
        .select()
        .single();
      if (reqErr) throw reqErr;

      if (input.items.length > 0) {
        const { error: itemsErr } = await supabase
          .from('action_request_items')
          .insert(
            input.items.map((it) => ({
              request_id: request.id,
              entity_type: def.entityType,
              entity_id: it.entityId,
              snapshot: it.snapshot,
            }))
          );
        if (itemsErr) throw itemsErr;
      }

      return request as ActionRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_requests'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

interface ReviewItemInput {
  requestId: string;
  itemId: string;
  state: Extract<ActionRequestItemState, 'approved' | 'rejected'>;
  notes?: string;
}

export function useReviewActionRequestItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: ReviewItemInput) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data: item, error: itemErr } = await supabase
        .from('action_request_items')
        .update({ state: input.state })
        .eq('id', input.itemId)
        .select()
        .single();
      if (itemErr) throw itemErr;

      // Update parent request's review metadata + derive status from items.
      const { data: siblings, error: sibErr } = await supabase
        .from('action_request_items')
        .select('state')
        .eq('request_id', input.requestId);
      if (sibErr) throw sibErr;

      const states = (siblings ?? []).map((s) => s.state);
      const pending = states.filter((s) => s === 'pending').length;
      const approved = states.filter((s) => s === 'approved').length;
      const rejected = states.filter((s) => s === 'rejected').length;
      const applied = states.filter((s) => s === 'applied').length;

      let newStatus: ActionRequest['status'] = 'pending';
      if (pending === 0 && approved === 0 && applied === 0) {
        newStatus = 'rejected';
      } else if (pending === 0 && approved === 0) {
        newStatus = 'completed';
      } else if (rejected > 0 || applied > 0) {
        newStatus = 'partially_approved';
      } else if (pending === 0) {
        newStatus = 'approved';
      }

      const { error: reqErr } = await supabase
        .from('action_requests')
        .update({
          status: newStatus,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: input.notes ?? null,
        })
        .eq('id', input.requestId);
      if (reqErr) throw reqErr;

      return item as ActionRequestItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_requests'] });
      queryClient.invalidateQueries({ queryKey: ['action_request_grant'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

interface BulkReviewInput {
  requestId: string;
  state: Extract<ActionRequestItemState, 'approved' | 'rejected'>;
  notes?: string;
}

/**
 * Approves or rejects every still-pending item in a request in a single round-trip.
 * Already-approved/rejected/applied items are left alone.
 */
export function useReviewActionRequestBulk() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: BulkReviewInput) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error: itemsErr } = await supabase
        .from('action_request_items')
        .update({ state: input.state })
        .eq('request_id', input.requestId)
        .eq('state', 'pending');
      if (itemsErr) throw itemsErr;

      const { data: siblings, error: sibErr } = await supabase
        .from('action_request_items')
        .select('state')
        .eq('request_id', input.requestId);
      if (sibErr) throw sibErr;

      const states = (siblings ?? []).map((s) => s.state);
      const pending = states.filter((s) => s === 'pending').length;
      const approved = states.filter((s) => s === 'approved').length;
      const rejected = states.filter((s) => s === 'rejected').length;
      const applied = states.filter((s) => s === 'applied').length;

      let newStatus: ActionRequest['status'] = 'pending';
      if (pending === 0 && approved === 0 && applied === 0) {
        newStatus = 'rejected';
      } else if (pending === 0 && approved === 0) {
        newStatus = 'completed';
      } else if (rejected > 0 || applied > 0) {
        newStatus = 'partially_approved';
      } else if (pending === 0) {
        newStatus = 'approved';
      }

      const { error: reqErr } = await supabase
        .from('action_requests')
        .update({
          status: newStatus,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: input.notes ?? null,
        })
        .eq('id', input.requestId);
      if (reqErr) throw reqErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_requests'] });
      queryClient.invalidateQueries({ queryKey: ['action_request_grant'] });
      queryClient.invalidateQueries({ queryKey: ['action_request_active_items'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useApplySalesDateEdit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { itemId: string; newDate: Date }) => {
      const { data, error } = await supabase.rpc('apply_sales_date_edit', {
        p_item_id: params.itemId,
        p_new_date: params.newDate.toISOString(),
      });
      if (error) throw error;
      return data as ActionRequestItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['action_requests'] });
      queryClient.invalidateQueries({ queryKey: ['action_request_grant'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
