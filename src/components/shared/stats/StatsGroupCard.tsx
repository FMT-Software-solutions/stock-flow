import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { StatsGroup } from '@/types/stats';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface StatsGroupCardProps<TData> {
  group: StatsGroup<TData>;
  data: TData[];
  className?: string;
}

export function StatsGroupCard<TData>({
  group,
  data,
  className,
}: StatsGroupCardProps<TData>) {
  const Icon = group.icon;
  const ActionIcon = group.action?.icon;
  const isGlass = group.cardVariant === 'glass';

  return (
    <Card className={cn('h-full py-4', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex flex-col space-y-1.5">
          <div className="flex items-center gap-2">
            {Icon && (
              <Icon
                className={cn(
                  'h-4 w-4',
                  isGlass ? 'text-primary/80' : 'text-muted-foreground'
                )}
              />
            )}
            <CardTitle
              className={cn('text-sm font-medium', isGlass && 'text-primary')}
            >
              {group.title}
            </CardTitle>
          </div>
          {group.description && (
            <CardDescription>{group.description}</CardDescription>
          )}
        </div>
        {group.action && (
          <Button
            variant="ghost"
            size="icon"
            onClick={group.action.onClick}
            title={group.action.label}
          >
            {ActionIcon ? (
              <ActionIcon className="h-4 w-4" />
            ) : (
              <span className="text-xs">Edit</span>
            )}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {group.fields.map((field, index) => {
          const result = field.calculate(data);
          const FieldIcon = field.icon;

          return (
            <div
              key={field.id}
              className={cn(
                'flex gap-2 justify-between items-start py-1.5',
                index !== group.fields.length - 1 && 'border-b'
              )}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {FieldIcon && <FieldIcon className="h-4 w-4" />}
                <span>{field.label}</span>
              </div>
              <div className="flex flex-col items-end text-right max-w-[60%]">
                <span
                  className={cn('font-bold wrap-break-word', field.className)}
                >
                  {result.value}
                </span>
                {result.subValue && (
                  <span className="text-xs text-muted-foreground wrap-break-word">
                    {result.subValue}
                  </span>
                )}
                {(result.trend || result.trendValue) && (
                  <span
                    className={cn(
                      'text-xs',
                      result.trend === 'up'
                        ? 'text-green-500'
                        : result.trend === 'down'
                        ? 'text-red-500'
                        : 'text-muted-foreground'
                    )}
                  >
                    {result.trendValue}
                  </span>
                )}
              </div>
              {result.footer && (
                <div className="text-xs text-muted-foreground">
                  {result.footer}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
