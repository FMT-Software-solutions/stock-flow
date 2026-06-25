import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  useActionRequests,
  useReviewActionRequestBulk,
  useReviewActionRequestItem,
} from '@/lib/action-requests/hooks';
import { getActionDefinition, listActionDefinitions } from '@/lib/action-requests/registry';
import { EditSaleDateDialog } from '@/components/orders/EditSaleDateDialog';
import type { ActionRequest, ActionRequestItem } from '@/lib/action-requests/types';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Clock, Pencil } from 'lucide-react';

function statusBadge(status: ActionRequest['status']) {
  const map: Record<ActionRequest['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pending', variant: 'secondary' },
    approved: { label: 'Approved', variant: 'default' },
    partially_approved: { label: 'Partial', variant: 'default' },
    rejected: { label: 'Rejected', variant: 'destructive' },
    completed: { label: 'Completed', variant: 'outline' },
    cancelled: { label: 'Cancelled', variant: 'outline' },
  };
  const cfg = map[status];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function itemStateBadge(state: ActionRequestItem['state']) {
  const map: Record<ActionRequestItem['state'], { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' },
    approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' },
    rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200' },
    applied: { label: 'Applied', className: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200' },
  };
  const cfg = map[state];
  return <span className={`text-xs px-2 py-0.5 rounded ${cfg.className}`}>{cfg.label}</span>;
}

function ItemSummary({ item }: { item: ActionRequestItem }) {
  if (item.entity_type === 'order') {
    const orderNumber = (item.snapshot?.order_number as string | undefined) ?? item.entity_id.slice(0, 8);
    const original = item.snapshot?.date as string | undefined;
    const result = item.result?.new_date as string | undefined;
    return (
      <div className="flex flex-col">
        <span className="text-xs font-mono font-medium">#{orderNumber}</span>
        {original && (
          <span className="text-[11px] text-muted-foreground">
            From: {format(new Date(original), 'MMM dd, yyyy h:mm a')}
          </span>
        )}
        {result && (
          <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
            To: {format(new Date(result), 'MMM dd, yyyy h:mm a')}
          </span>
        )}
      </div>
    );
  }
  return <span className="text-xs font-mono">{item.entity_id.slice(0, 8)}</span>;
}

const APPROVE_BTN_CLS =
  'h-7 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-200';
const REJECT_BTN_CLS =
  'h-7 text-red-700 hover:bg-red-100 hover:text-red-800 dark:text-red-300 dark:hover:bg-red-500/15 dark:hover:text-red-200';

function ReviewActions({
  request,
  item,
  canApprove,
}: {
  request: ActionRequest;
  item: ActionRequestItem;
  canApprove: boolean;
}) {
  const review = useReviewActionRequestItem();
  if (!canApprove || item.state !== 'pending') return null;
  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="ghost"
        className={APPROVE_BTN_CLS}
        onClick={() => {
          review.mutate(
            { requestId: request.id, itemId: item.id, state: 'approved' },
            {
              onSuccess: () => toast.success('Item approved'),
              onError: (e: any) => toast.error(e.message ?? 'Failed to approve'),
            }
          );
        }}
        disabled={review.isPending}
      >
        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className={REJECT_BTN_CLS}
        onClick={() => {
          review.mutate(
            { requestId: request.id, itemId: item.id, state: 'rejected' },
            {
              onSuccess: () => toast.success('Item rejected'),
              onError: (e: any) => toast.error(e.message ?? 'Failed to reject'),
            }
          );
        }}
        disabled={review.isPending}
      >
        <XCircle className="h-4 w-4 mr-1" /> Reject
      </Button>
    </div>
  );
}

function BulkReviewActions({
  request,
  canApprove,
}: {
  request: ActionRequest;
  canApprove: boolean;
}) {
  const bulk = useReviewActionRequestBulk();
  const pendingCount = (request.items ?? []).filter((i) => i.state === 'pending').length;
  if (!canApprove || pendingCount < 2) return null;

  const run = (state: 'approved' | 'rejected') => {
    bulk.mutate(
      { requestId: request.id, state },
      {
        onSuccess: () =>
          toast.success(
            `${state === 'approved' ? 'Approved' : 'Rejected'} ${pendingCount} item${pendingCount === 1 ? '' : 's'}`
          ),
        onError: (e: any) =>
          toast.error(e.message ?? `Failed to ${state === 'approved' ? 'approve' : 'reject'} all`),
      }
    );
  };

  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="ghost"
        className={APPROVE_BTN_CLS}
        onClick={() => run('approved')}
        disabled={bulk.isPending}
      >
        <CheckCircle2 className="h-4 w-4 mr-1" />
        Approve all ({pendingCount})
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className={REJECT_BTN_CLS}
        onClick={() => run('rejected')}
        disabled={bulk.isPending}
      >
        <XCircle className="h-4 w-4 mr-1" />
        Reject all
      </Button>
    </div>
  );
}

function RequesterApplyAction({ item }: { item: ActionRequestItem }) {
  const [open, setOpen] = useState(false);
  if (item.state !== 'approved') return null;
  return (
    <>
      <Button size="sm" variant="outline" className="h-7" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit date
      </Button>
      <EditSaleDateDialog open={open} onOpenChange={setOpen} item={item} />
    </>
  );
}

function RequestCard({ request, mode }: { request: ActionRequest; mode: 'mine' | 'review' }) {
  const def = getActionDefinition(request.action_type);
  const { checkPermission } = useRoleCheck();
  const { user } = useAuth();
  const canApprove = def
    ? checkPermission(def.permissionScope, def.approvePermission)
    : false;
  const isRequester = user?.id === request.requested_by;

  const requesterName = request.requester
    ? `${request.requester.first_name ?? ''} ${request.requester.last_name ?? ''}`.trim()
    : '';
  const reviewerName = request.reviewer
    ? `${request.reviewer.first_name ?? ''} ${request.reviewer.last_name ?? ''}`.trim()
    : '';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm">
              {def?.labels.singular ?? request.action_type}
              <span className="ml-2">{statusBadge(request.status)}</span>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {requesterName && <>By <span className="font-medium">{requesterName}</span> · </>}
              {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
              {reviewerName && request.reviewed_at && (
                <>
                  <br />
                  Reviewed by <span className="font-medium">{reviewerName}</span>
                  {' · '}
                  {formatDistanceToNow(new Date(request.reviewed_at), { addSuffix: true })}
                </>
              )}
              {request.reason && (
                <>
                  <br />
                  <span className="italic">"{request.reason}"</span>
                </>
              )}
            </CardDescription>
          </div>
          {mode === 'review' && (
            <BulkReviewActions request={request} canApprove={canApprove} />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {(request.items ?? []).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 border rounded-md px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <ItemSummary item={item} />
                {itemStateBadge(item.state)}
              </div>
              <div className="flex items-center gap-2">
                {mode === 'review' && (
                  <ReviewActions request={request} item={item} canApprove={canApprove} />
                )}
                {mode === 'mine' && isRequester && <RequesterApplyAction item={item} />}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function RequestsPage() {
  const { currentOrganization } = useOrganization();
  const { checkPermission } = useRoleCheck();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('id');

  const defs = useMemo(() => listActionDefinitions(), []);
  const canReviewAny = useMemo(
    () => defs.some((d) => checkPermission(d.permissionScope, d.approvePermission)),
    [defs, checkPermission]
  );

  // Poll every 10s while the page is open so reviewers/requesters see updates without a manual reload.
  // `refetchOnWindowFocus` (set on the hook) gives an instant refresh when the tab comes back.
  const mineQuery = useActionRequests({ scope: 'mine', pollMs: 10_000 });
  const reviewQuery = useActionRequests({ scope: 'pending_review', pollMs: 10_000 });

  const mine = mineQuery.data ?? [];
  const review = reviewQuery.data ?? [];

  const [tab, setTab] = useState<'mine' | 'review'>(canReviewAny ? 'review' : 'mine');

  if (!currentOrganization) return null;

  const focusedMine = focusId ? mine.find((r) => r.id === focusId) : undefined;
  const focusedReview = focusId ? review.find((r) => r.id === focusId) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Requests</h1>
        <p className="text-sm text-muted-foreground">
          Track action requests you have submitted, and review requests awaiting your decision.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'mine' | 'review')}>
        <TabsList>
          <TabsTrigger value="mine">
            My requests {mine.length > 0 && <Badge variant="secondary" className="ml-2">{mine.length}</Badge>}
          </TabsTrigger>
          {canReviewAny && (
            <TabsTrigger value="review">
              Pending review {review.length > 0 && <Badge variant="default" className="ml-2">{review.length}</Badge>}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="mine" className="space-y-3 mt-4">
          {focusedMine && <RequestCard request={focusedMine} mode="mine" />}
          {mine
            .filter((r) => r.id !== focusId)
            .map((r) => (
              <RequestCard key={r.id} request={r} mode="mine" />
            ))}
          {mine.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <Clock className="h-6 w-6 opacity-50" />
                You haven't submitted any requests yet.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {canReviewAny && (
          <TabsContent value="review" className="space-y-3 mt-4">
            {focusedReview && <RequestCard request={focusedReview} mode="review" />}
            {review
              .filter((r) => r.id !== focusId)
              .map((r) => (
                <RequestCard key={r.id} request={r} mode="review" />
              ))}
            {review.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 opacity-50" />
                  Nothing waiting on you. Nice work.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

