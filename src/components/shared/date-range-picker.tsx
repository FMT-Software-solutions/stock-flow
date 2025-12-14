'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface DatePickerWithRangeProps {
  className?: string;
  date?: DateRange;
  setDate?: (date: DateRange | undefined) => void;
  placeholder?: string;
}

export function DatePickerWithRange({
  className,
  date,
  setDate,
  placeholder = 'Pick a date range',
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
        to: endOfMonth(new Date()),
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
        to: endOfYear(new Date()),
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
    if (preset) {
      setDate?.(preset.getRange());
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setSelectedPreset(undefined); // Clear preset if manually selecting
    setDate?.(range);
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'w-full justify-start text-left font-normal',
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
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 border-b">
            <Select value={selectedPreset} onValueChange={handlePresetChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a preset..." />
              </SelectTrigger>
              <SelectContent position="popper">
                {presets.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Calendar
            autoFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
