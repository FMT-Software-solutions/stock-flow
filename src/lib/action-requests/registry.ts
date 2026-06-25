import type { ActionRequestDefinition } from './types';

export const SALES_EDIT_DATE = 'sales.edit_date';

const definitions: Record<string, ActionRequestDefinition> = {
  [SALES_EDIT_DATE]: {
    actionType: SALES_EDIT_DATE,
    entityType: 'order',
    permissionScope: 'orders',
    requestPermission: 'request_date_edit',
    approvePermission: 'approve_date_edit',
    labels: {
      singular: 'sales date edit',
      plural: 'sales date edits',
      requestVerb: 'Request date edit',
      approveVerb: 'Approve date edit',
    },
  },
};

export function getActionDefinition(actionType: string): ActionRequestDefinition | undefined {
  return definitions[actionType];
}

export function listActionDefinitions(): ActionRequestDefinition[] {
  return Object.values(definitions);
}
