import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

/**
 * Returns a Map keyed by entity_id → action_request_items.id for every item currently in
 * `approved` state belonging to the signed-in user, scoped to an action_type/entity_type.
 * Used by row-level UI to decide whether to show an "apply" affordance without N+1 queries.
 */
export function useApprovedItemsForUser(params: {
  actionType: string;
  entityType: string;
}) {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const userId = user?.id;
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: [
      'action_request_grant',
      params.actionType,
      params.entityType,
      orgId,
      userId,
    ],
    queryFn: async () => {
      if (!userId || !orgId) return new Map<string, string>();
      const { data, error } = await supabase
        .from('action_request_items')
        .select(
          'id, entity_id, action_requests!inner(requested_by, action_type, organization_id)'
        )
        .eq('entity_type', params.entityType)
        .eq('state', 'approved')
        .eq('action_requests.requested_by', userId)
        .eq('action_requests.action_type', params.actionType)
        .eq('action_requests.organization_id', orgId);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of data ?? []) {
        map.set(row.entity_id as string, row.id as string);
      }
      return map;
    },
    enabled: !!userId && !!orgId,
    refetchOnWindowFocus: true,
  });
}

/**
 * Returns a Map keyed by entity_id → state for every item still "locked" in the org for this
 * action_type. State is 'pending' or 'approved'. Used to surface "already requested" badges
 * and to disable re-selection in the list.
 */
export function useActiveItemsInOrg(params: { actionType: string; entityType: string }) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: ['action_request_active_items', params.actionType, params.entityType, orgId],
    queryFn: async () => {
      if (!orgId) return new Map<string, 'pending' | 'approved'>();
      const { data, error } = await supabase
        .from('action_request_items')
        .select(
          'entity_id, state, action_requests!inner(action_type, organization_id)'
        )
        .eq('entity_type', params.entityType)
        .in('state', ['pending', 'approved'])
        .eq('action_requests.action_type', params.actionType)
        .eq('action_requests.organization_id', orgId);
      if (error) throw error;
      const map = new Map<string, 'pending' | 'approved'>();
      for (const row of data ?? []) {
        const state = row.state as 'pending' | 'approved';
        // approved beats pending if both somehow exist (shouldn't, but be defensive)
        const existing = map.get(row.entity_id as string);
        if (existing === 'approved') continue;
        map.set(row.entity_id as string, state);
      }
      return map;
    },
    enabled: !!orgId,
    refetchOnWindowFocus: true,
  });
}
