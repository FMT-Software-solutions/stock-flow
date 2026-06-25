import type { PermissionAction, PermissionScope } from '@/modules/permissions/types';

export type ActionRequestStatus =
  | 'pending'
  | 'approved'
  | 'partially_approved'
  | 'rejected'
  | 'completed'
  | 'cancelled';

export type ActionRequestItemState =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'applied';

export interface ActionRequestItem {
  id: string;
  request_id: string;
  entity_type: string;
  entity_id: string;
  snapshot: Record<string, unknown>;
  result: Record<string, unknown> | null;
  state: ActionRequestItemState;
  applied_at: string | null;
  applied_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActionRequest {
  id: string;
  organization_id: string;
  action_type: string;
  requested_by: string;
  reason: string | null;
  payload: Record<string, unknown>;
  status: ActionRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  items?: ActionRequestItem[];
  requester?: { first_name: string | null; last_name: string | null } | null;
  reviewer?: { first_name: string | null; last_name: string | null } | null;
}

export interface ActionRequestDefinition {
  /** Stable identifier — also stored in the DB row. */
  actionType: string;
  /** entity_type used in action_request_items rows for this action. */
  entityType: string;
  /** Permission scope (always the same for paired request/approve actions). */
  permissionScope: PermissionScope;
  requestPermission: PermissionAction;
  approvePermission: PermissionAction;
  /** Display labels surfaced in the generic UI. */
  labels: {
    singular: string;
    plural: string;
    requestVerb: string;
    approveVerb: string;
  };
}
