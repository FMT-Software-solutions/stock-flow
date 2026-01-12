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
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface DatePickerWithRangeProps {
  className?: string;
  date?: DateRange;
  setDate?: (date: DateRange | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function DatePickerWithRange({
  className,
  date,
  setDate,
  placeholder = 'Pick a date range',
  disabled,
}: DatePickerWithRangeProps) {
  const [selectedPreset, setSelectedPreset] = React.useState<
    string | undefined
  >(undefined);

  const presets = [
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
      label: 'This Week',
      value: 'this_week',
      getRange: () => ({
        from: startOfWeek(new Date(), { weekStartsOn: 1 }), // Monday start
        to: endOfWeek(new Date(), { weekStartsOn: 1 }),
      }),
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
  ];

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    const preset = presets.find((p) => p.value === value);
    if (preset && setDate) {
      setDate(preset.getRange());
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (setDate) {
      setDate(undefined);
    }
    setSelectedPreset(undefined);
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
                  {format(date.from, 'LLL dd, y')} -{' '}
                  {format(date.to, 'LLL dd, y')}
                </>
              ) : (
                format(date.from, 'LLL dd, y')
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
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <div className="p-3 border-r w-37.5">
              <div className="space-y-2">
                <h4 className="font-medium text-sm mb-2">Presets</h4>
                {presets.map((preset) => (
                  <Button
                    key={preset.value}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      selectedPreset === preset.value && 'bg-accent'
                    )}
                    onClick={() => handlePresetChange(preset.value)}
                  >
                    {preset.label}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left font-normal text-muted-foreground hover:text-foreground"
                  onClick={handleClear}
                >
                  Clear Filter
                </Button>
              </div>
            </div>
            <div className="p-3">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={(newDate) => {
                  if (setDate) setDate(newDate);
                  setSelectedPreset(undefined);
                }}
                numberOfMonths={2}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
