import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type AppNotification,
} from '@/lib/notifications/hooks';
import { cn } from '@/lib/utils';

function Row({ n, onClick }: { n: AppNotification; onClick: () => void }) {
  const isUnread = !n.read_at;
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-muted/60 transition',
        isUnread && 'bg-primary/5'
      )}
    >
      <div className="flex items-start gap-3">
        {isUnread && (
          <span className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{n.title}</div>
          {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
          <div className="text-[11px] text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
          </div>
        </div>
      </div>
    </button>
  );
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const { data: notifications = [] } = useNotifications({ pollMs: 30_000, limit: 200 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0
              ? `${unread} unread notification${unread === 1 ? '' : 's'}`
              : 'You are all caught up.'}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            Mark all as read
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              You don&apos;t have any notifications yet.
            </div>
          ) : (
            notifications.map((n) => (
              <Row
                key={n.id}
                n={n}
                onClick={() => {
                  if (!n.read_at) markRead.mutate(n.id);
                  navigate(n.link);
                }}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
