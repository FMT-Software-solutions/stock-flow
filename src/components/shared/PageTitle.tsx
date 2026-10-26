import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * A page's heading: the same size on every page. Any explanation shows as a
 * tooltip on the heading itself, not as text or an icon on the page.
 */
export function PageTitle({
  children,
  hint,
  as: Tag = 'h1',
  className,
}: {
  children: ReactNode;
  hint?: ReactNode;
  as?: 'h1' | 'h2';
  className?: string;
}) {
  const heading = (
    <Tag className={cn('truncate text-xl font-bold tracking-tight', className)} tabIndex={hint ? 0 : undefined}>
      {children}
    </Tag>
  );
  if (!hint) return heading;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{heading}</TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-xs">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}
