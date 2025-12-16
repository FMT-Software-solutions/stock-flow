import { useAiUsage } from '@/hooks/useAiUsage';
import { Sparkles } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AiUsageIndicatorProps {
  className?: string;
}

export function AiUsageIndicator({ className }: AiUsageIndicatorProps) {
  const { usage, limit, loading } = useAiUsage();

  if (loading) return null;

  const isLimitReached = usage >= limit;
  const isNearLimit = usage >= limit * 0.8;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full border bg-background cursor-help transition-colors hover:bg-muted/50',
              className
            )}
          >
            <Sparkles
              className={cn(
                'h-3.5 w-3.5',
                isLimitReached ? 'text-muted-foreground' : 'text-purple-500'
              )}
            />
            <span
              className={cn(
                'text-xs font-medium',
                isLimitReached
                  ? 'text-destructive'
                  : isNearLimit
                  ? 'text-amber-500'
                  : 'text-muted-foreground'
              )}
            >
              {usage}/{limit}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-primary-foreground">
          <p className="font-medium">Daily AI Usage</p>
          <p className="text-sm">
            {usage} of {limit} generations used today
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Resets daily at midnight
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
