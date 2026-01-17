'use client';

import * as React from 'react';
import { CalendarIcon, X } from 'lucide-react';
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns';
import type { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { DatePicker } from '@/components/shared/DatePicker';

export interface DatePickerWithRangeProps {
  className?: string;
  date?: DateRange;
  setDate?: (date: DateRange | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  onClear?: () => void;
}

function DatePickerWithRangeInner({
  className,
  date,
  setDate,
  placeholder = 'Pick a date range',
  disabled,
  minDate,
  maxDate,
  onClear,
}: DatePickerWithRangeProps) {
  const [selectedPreset, setSelectedPreset] = React.useState<
    string | undefined
  >(undefined);

  const presets = [
    {
      label: 'All Time',
      value: 'all_time',
      getRange: () => undefined,
    },
    {
      label: 'Today',
      value: 'today',
      getRange: () => ({
        from: startOfDay(new Date()),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: 'Yesterday',
      value: 'yesterday',
      getRange: () => {
        const yesterday = subDays(new Date(), 1);
        return {
          from: startOfDay(yesterday),
          to: endOfDay(yesterday),
        };
      },
    },
    {
      label: 'Last 3 Days',
      value: 'last_3_days',
      getRange: () => ({
        from: startOfDay(subDays(new Date(), 2)),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: 'Last 7 Days',
      value: 'last_7_days',
      getRange: () => ({
        from: startOfDay(subDays(new Date(), 6)),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: 'Last 15 Days',
      value: 'last_15_days',
      getRange: () => ({
        from: startOfDay(subDays(new Date(), 14)),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: 'Last 30 Days',
      value: 'last_30_days',
      getRange: () => ({
        from: startOfDay(subDays(new Date(), 29)),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: 'Last 60 Days',
      value: 'last_60_days',
      getRange: () => ({
        from: startOfDay(subDays(new Date(), 59)),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: 'Last 90 Days',
      value: 'last_90_days',
      getRange: () => ({
        from: startOfDay(subDays(new Date(), 89)),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: 'This Week',
      value: 'this_week',
      getRange: () => {
        const now = new Date();
        return {
          from: startOfWeek(now, { weekStartsOn: 1 }),
          to: endOfDay(now),
        };
      },
    },
    {
      label: 'Last Week',
      value: 'last_week',
      getRange: () => {
        const lastWeek = subWeeks(new Date(), 1);
        return {
          from: startOfWeek(lastWeek, { weekStartsOn: 1 }),
          to: endOfWeek(lastWeek, { weekStartsOn: 1 }),
        };
      },
    },
    {
      label: 'This Month',
      value: 'this_month',
      getRange: () => ({
        from: startOfMonth(new Date()),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: 'Last Month',
      value: 'last_month',
      getRange: () => {
        const lastMonth = subMonths(new Date(), 1);
        return {
          from: startOfMonth(lastMonth),
          to: endOfMonth(lastMonth),
        };
      },
    },
    {
      label: 'Last 2 Months',
      value: 'last_2_months',
      getRange: () => ({
        from: startOfDay(subMonths(new Date(), 2)),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: 'Last 3 Months',
      value: 'last_3_months',
      getRange: () => ({
        from: startOfDay(subMonths(new Date(), 3)),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: 'Last 6 Months',
      value: 'last_6_months',
      getRange: () => ({
        from: startOfDay(subMonths(new Date(), 6)),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: 'Last 180 Days',
      value: 'last_180_days',
      getRange: () => ({
        from: startOfDay(subDays(new Date(), 179)),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: 'Last 360 Days',
      value: 'last_360_days',
      getRange: () => ({
        from: startOfDay(subDays(new Date(), 359)),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: 'This Year',
      value: 'this_year',
      getRange: () => ({
        from: startOfYear(new Date()),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: 'Last Year',
      value: 'last_year',
      getRange: () => {
        const lastYear = subYears(new Date(), 1);
        return {
          from: startOfYear(lastYear),
          to: endOfYear(lastYear),
        };
      },
    },
  ] as const;

  const isRangeAllowed = (range: DateRange | undefined) => {
    if (!range) {
      return !minDate;
    }

    if (minDate && range.from && range.from < startOfDay(minDate)) {
      return false;
    }
    if (maxDate && range.to && range.to > endOfDay(maxDate)) {
      return false;
    }
    return true;
  };

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    const preset = presets.find((p) => p.value === value);
    if (!preset || !setDate) return;

    const range = preset.getRange();
    if (!isRangeAllowed(range)) return;
    setDate(range);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
      setSelectedPreset(undefined);
      return;
    }
    if (setDate) {
      setDate(undefined);
    }
    setSelectedPreset(undefined);
  };

  const handleCustomSelect = () => {
    setSelectedPreset('custom');
  };

  const customFrom = date?.from;
  const customTo = date?.to;

  const clampFrom = (d: Date) => {
    let next = startOfDay(d);
    if (minDate && next < startOfDay(minDate)) {
      next = startOfDay(minDate);
    }
    if (maxDate && next > startOfDay(maxDate)) {
      next = startOfDay(maxDate);
    }
    return next;
  };

  const clampTo = (d: Date) => {
    let next = endOfDay(d);
    if (minDate && next < startOfDay(minDate)) {
      next = endOfDay(minDate);
    }
    if (maxDate && next > endOfDay(maxDate)) {
      next = endOfDay(maxDate);
    }
    return next;
  };

  const endMinDate = customFrom
    ? minDate && customFrom < startOfDay(minDate)
      ? startOfDay(minDate)
      : customFrom
    : minDate;

  const setCustomFrom = (from: Date | undefined) => {
    if (!setDate) return;
    if (!from) {
      setDate(undefined);
      return;
    }

    const nextFrom = clampFrom(from);
    const clampedTo = customTo ? clampTo(customTo) : undefined;
    const nextTo = clampedTo && clampedTo >= nextFrom ? clampedTo : undefined;

    setDate({ from: nextFrom, to: nextTo });
  };

  const setCustomTo = (to: Date | undefined) => {
    if (!setDate) return;
    if (!to) {
      if (!customFrom) {
        setDate(undefined);
        return;
      }
      setDate({ from: startOfDay(customFrom), to: undefined });
      return;
    }

    const nextTo = clampTo(to);
    let nextFrom = customFrom ? clampFrom(customFrom) : clampFrom(to);
    if (nextFrom > nextTo) {
      nextFrom = clampFrom(to);
    }

    setDate({
      from: nextFrom,
      to: nextTo,
    });
  };

  return (
    <div className={cn('grid gap-2', disabled && 'opacity-50', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            disabled={!!disabled}
            className={cn(
              'min-w-75 justify-start text-left font-normal relative',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'MMM dd, yyyy')} -{' '}
                  {format(date.to, 'MMM dd, yyyy')}
                </>
              ) : (
                format(date.from, 'MMM dd, yyyy')
              )
            ) : (
              <span>{placeholder}</span>
            )}
            {date && (
              <div
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full cursor-pointer"
                onClick={handleClear}
                title="Clear date range"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[92vw] max-w-xs p-0"
          align="start"
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            if (target.closest('[data-slot="popover-content"]')) {
              e.preventDefault();
            }
          }}
        >
          <div className="p-2">
            <div className="space-y-2">
              <h4 className="font-medium text-sm px-1">Presets</h4>
              <div className="max-h-75 overflow-y-auto">
                {presets
                  .filter((p) => (minDate ? p.value !== 'all_time' : true))
                  .map((preset) => {
                    const allowed = isRangeAllowed(preset.getRange());
                    return (
                      <Button
                        key={preset.value}
                        variant="ghost"
                        size="sm"
                        disabled={!!disabled || !allowed}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          selectedPreset === preset.value && 'bg-accent'
                        )}
                        onClick={() => handlePresetChange(preset.value)}
                      >
                        {preset.label}
                      </Button>
                    );
                  })}
              </div>

              <div className="pt-2 border-t space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!!disabled}
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    selectedPreset === 'custom' && 'bg-accent'
                  )}
                  onClick={handleCustomSelect}
                >
                  Custom
                </Button>

                {selectedPreset === 'custom' && (
                  <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
                    <DatePicker
                      label="Start Date"
                      date={customFrom}
                      setDate={setCustomFrom}
                      disabled={!!disabled}
                      minDate={minDate}
                      maxDate={maxDate}
                    />
                    <DatePicker
                      label="End Date"
                      date={customTo}
                      setDate={setCustomTo}
                      disabled={!!disabled}
                      minDate={endMinDate}
                      maxDate={maxDate}
                    />
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!!disabled}
                  className="w-full justify-start text-left font-normal text-muted-foreground hover:text-foreground"
                  onClick={handleClear}
                >
                  Clear Filter
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function getDateTime(d?: Date) {
  return d ? d.getTime() : undefined;
}

export const DatePickerWithRange = React.memo(
  DatePickerWithRangeInner,
  (prev, next) => {
    return (
      prev.className === next.className &&
      prev.placeholder === next.placeholder &&
      prev.disabled === next.disabled &&
      getDateTime(prev.minDate) === getDateTime(next.minDate) &&
      getDateTime(prev.maxDate) === getDateTime(next.maxDate) &&
      getDateTime(prev.date?.from) === getDateTime(next.date?.from) &&
      getDateTime(prev.date?.to) === getDateTime(next.date?.to)
    );
  }
);
