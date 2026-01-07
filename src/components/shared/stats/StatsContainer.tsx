import type { StatsGroup } from '@/types/stats';
import { StatsGroupCard } from './StatsGroupCard';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronsUpDown } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface StatsContainerProps<TData> {
  groups: StatsGroup<TData>[];
  data: TData[];
  className?: string;
  storageKey?: string;
  summaryLabel?: string;
  collapsible?: boolean;
}

export function StatsContainer<TData>({
  groups,
  data,
  className,
  storageKey = 'stockflow-stats-container-is-open',
  summaryLabel = 'Summary',
  collapsible = true,
}: StatsContainerProps<TData>) {
  const [isOpen, setIsOpen] = useLocalStorage(storageKey, true);

  const content = (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      {groups
        .filter((group) => !group.isHidden)
        .map((group) => (
          <StatsGroupCard key={group.id} group={group} data={data} />
        ))}
    </div>
  );

  if (!collapsible) {
    return (
      <div className="mb-6">
        {summaryLabel && (
          <div className="text-sm font-medium mb-2 px-1">{summaryLabel}</div>
        )}
        {content}
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full bg-muted/70 text-left px-4 py-2 mb-2 flex items-center justify-between cursor-pointer">
        <span className="text-sm font-medium">{summaryLabel}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            Click to {isOpen ? 'Hide' : 'Show'}
          </span>
          <ChevronsUpDown className="ml-auto h-4 w-4" />
          <span className="sr-only">Toggle</span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="mb-6">{content}</CollapsibleContent>
    </Collapsible>
  );
}
