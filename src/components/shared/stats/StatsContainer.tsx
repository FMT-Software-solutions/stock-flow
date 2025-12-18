import type { StatsGroup } from '@/types/stats';
import { StatsGroupCard } from './StatsGroupCard';
import { cn } from '@/lib/utils';

interface StatsContainerProps<TData> {
  groups: StatsGroup<TData>[];
  data: TData[];
  className?: string;
}

export function StatsContainer<TData>({
  groups,
  data,
  className,
}: StatsContainerProps<TData>) {
  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      {groups.map((group) => (
        <StatsGroupCard key={group.id} group={group} data={data} />
      ))}
    </div>
  );
}
