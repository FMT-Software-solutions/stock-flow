import type { StatsGroup } from '@/types/stats';
import { StatsGroupCard } from './StatsGroupCard';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronsUpDown } from 'lucide-react';
import { useOrgPreference } from '@/hooks/preferences/useOrgPreference';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StatsContainerProps<TData> {
  groups: StatsGroup<TData>[];
  data: TData[];
  className?: string;
  storageKey?: string;
  summaryLabel?: string;
  collapsible?: boolean;
  summaryMode?: 'filtered' | 'all';
  onSummaryModeChange?: (mode: 'filtered' | 'all') => void;
  orgId?: string;
}

export function StatsContainer<TData>({
  groups,
  data,
  className,
  storageKey = 'stockflow-stats-container-is-open',
  summaryLabel = 'Summary',
  collapsible = true,
  summaryMode,
  onSummaryModeChange,
  orgId,
}: StatsContainerProps<TData>) {
  const [isOpen, setIsOpen] = useOrgPreference<boolean>(
    orgId,
    `stats.${storageKey}.isOpen`,
    true
  );
  const glassCardClassName =
    'relative overflow-hidden border-primary/20 bg-card/40 bg-linear-to-br from-primary/15 via-primary/10 to-background/25 shadow-md backdrop-blur-sm';

  const content = (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      {groups
        .filter((group) => !group.isHidden)
        .map((group) => (
          <StatsGroupCard
            key={group.id}
            group={group}
            data={data}
            className={cn(group.cardVariant === 'glass' && glassCardClassName)}
          />
        ))}
    </div>
  );

  if (!collapsible) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2 px-1">
          {summaryLabel && (
            <>
              <span className="text-sm font-medium hidden md:inline">
                {summaryLabel}
              </span>
              <span className="text-sm font-medium md:hidden">Summary</span>
            </>
          )}
          {summaryMode && onSummaryModeChange && (
            <Select
              value={summaryMode}
              onValueChange={(v) =>
                onSummaryModeChange(v as 'filtered' | 'all')
              }
            >
              <SelectTrigger className="h-8 w-44">
                <SelectValue placeholder="Summary Mode" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="filtered">Filtered Items</SelectItem>
                <SelectItem value="all">All Items</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {content}
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="w-full bg-muted/70 px-4 py-2 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium hidden md:inline">
            {summaryLabel}
          </span>
          <span className="text-sm font-medium md:hidden">Summary</span>
          {summaryMode && onSummaryModeChange && (
            <Select
              value={summaryMode}
              onValueChange={(v) =>
                onSummaryModeChange(v as 'filtered' | 'all')
              }
            >
              <SelectTrigger className="h-8 w-44">
                <SelectValue placeholder="Summary Mode" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="filtered">Filtered Items</SelectItem>
                <SelectItem value="all">All Items</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-sm font-medium hidden sm:inline">
              Click to {isOpen ? 'Hide' : 'Show'}
            </span>
            <ChevronsUpDown className="ml-auto h-4 w-4" />
            <span className="sr-only">Toggle</span>
          </div>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="mb-6">{content}</CollapsibleContent>
    </Collapsible>
  );
}
