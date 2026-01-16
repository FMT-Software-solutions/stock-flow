import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { User } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export function UserInfo({
  userId,
  label,
  date,
}: {
  userId?: string | null;
  label: string;
  date?: Date | null;
}) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', userId)
        .single();
      return data;
    },
    enabled: !!userId,
  });

  const activityDate = date || new Date();
  const relativeTime = formatDistanceToNow(activityDate, { addSuffix: true });

  if (!userId) return null;

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20">
      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
        <User className="h-5 w-5 text-primary" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          {label}
        </span>
        <span className="text-sm font-medium">
          {isLoading
            ? 'Loading...'
            : profile
            ? `${profile.first_name} ${profile.last_name}`
            : 'Unknown User'}
        </span>
        {date && (
          <div className="flex flex-col">
            <span className="text-xs">
              {format(activityDate, 'MMMM dd, yyyy h:mm a')}
            </span>
            <span className="text-xs text-muted-foreground">
              {relativeTime === 'in less than a minute' ||
              relativeTime === 'less than a minute ago'
                ? 'now'
                : relativeTime}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
