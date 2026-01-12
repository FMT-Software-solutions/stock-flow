import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type GroupUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';

interface ExpensesSettingsCardProps {
  title: string;
  groupUnit: GroupUnit;
  setGroupUnit: (v: GroupUnit) => void;
  groupBy: 'category' | 'type';
  setGroupBy?: (v: 'category' | 'type') => void;
  className?: string;
}

export function ExpensesSettingsCard({
  title,
  groupUnit,
  setGroupUnit,
  groupBy,
  setGroupBy,
  className,
}: ExpensesSettingsCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Time Group</span>
            <Select value={groupUnit} onValueChange={(v) => setGroupUnit(v as GroupUnit)}>
              <SelectTrigger className="h-8 w-full">
                <SelectValue placeholder="Group by time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
                <SelectItem value="quarter">Quarterly</SelectItem>
                <SelectItem value="year">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Group By</span>
            <Select value={groupBy} onValueChange={(v) => setGroupBy?.(v as 'category' | 'type')}>
              <SelectTrigger className="h-8 w-full">
                <SelectValue placeholder="Group rows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">By Category</SelectItem>
                <SelectItem value="type">By Type</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
