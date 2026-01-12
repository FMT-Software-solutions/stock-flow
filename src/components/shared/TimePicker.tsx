import * as React from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils';

interface TimePickerProps {
  value?: string; // 'HH:mm' 24-hour
  onChange?: (value?: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function toDisplay(value?: string) {
  if (!value) return '';
  const [hStr, mStr] = value.split(':');
  let h = parseInt(hStr || '0', 10);
  const m = parseInt(mStr || '0', 10);
  const meridiem = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const mm = m.toString().padStart(2, '0');
  return `${h}:${mm} ${meridiem}`;
}

function to24(hour12: number, minute: number, meridiem: 'AM' | 'PM') {
  let h = hour12 % 12;
  if (meridiem === 'PM') h += 12;
  const hh = h.toString().padStart(2, '0');
  const mm = minute.toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

export function TimePicker({
  value,
  onChange,
  label,
  placeholder = 'Pick time',
  className,
  disabled,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [hour, setHour] = React.useState<number>(() => {
    if (!value) return 12;
    const h = parseInt(value.split(':')[0] || '0', 10);
    const h12 = h % 12 || 12;
    return h12;
  });
  const [minute, setMinute] = React.useState<number>(() => {
    if (!value) return 0;
    return parseInt(value.split(':')[1] || '0', 10);
  });
  const [meridiem, setMeridiem] = React.useState<'AM' | 'PM'>(() => {
    if (!value) return 'AM';
    const h = parseInt(value.split(':')[0] || '0', 10);
    return h >= 12 ? 'PM' : 'AM';
  });
  const [inputValue, setInputValue] = React.useState<string>(() =>
    toDisplay(value)
  );

  React.useEffect(() => {
    setInputValue(toDisplay(value));
    if (value) {
      const [hStr, mStr] = value.split(':');
      const h = parseInt(hStr || '0', 10);
      setHour(h % 12 || 12);
      setMinute(parseInt(mStr || '0', 10));
      setMeridiem(h >= 12 ? 'PM' : 'AM');
    }
  }, [value]);

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i); // 0,1,...59

  const applySelection = () => {
    const newVal = to24(hour, minute, meridiem);
    onChange?.(newVal);
    setOpen(false);
  };

  const presets = [
    { label: 'Start of day', value: '00:00' },
    { label: 'Mid day', value: '12:00' },
    { label: 'End of day', value: '23:59' },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const txt = e.target.value;
    setInputValue(txt);
    // Try to parse formats like "h:mm AM" or "HH:mm"
    const ampmMatch = txt.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    const twentyFourMatch = txt.match(/^(\d{1,2}):(\d{2})$/);
    if (ampmMatch) {
      const h12 = Math.min(12, Math.max(1, parseInt(ampmMatch[1], 10)));
      const mm = Math.min(59, Math.max(0, parseInt(ampmMatch[2], 10)));
      const md = ampmMatch[3].toUpperCase() as 'AM' | 'PM';
      setHour(h12);
      setMinute(mm);
      setMeridiem(md);
      onChange?.(to24(h12, mm, md));
    } else if (twentyFourMatch) {
      const hh = Math.min(23, Math.max(0, parseInt(twentyFourMatch[1], 10)));
      const mm = Math.min(59, Math.max(0, parseInt(twentyFourMatch[2], 10)));
      const md: 'AM' | 'PM' = hh >= 12 ? 'PM' : 'AM';
      setHour(hh % 12 || 12);
      setMinute(mm);
      setMeridiem(md);
      onChange?.(
        `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
      );
    }
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && <Label className="px-1">{label}</Label>}
      <div className="relative flex gap-2">
        <Input
          value={inputValue}
          placeholder={placeholder}
          className="bg-background pr-10"
          disabled={disabled}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
            }
          }}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="absolute top-1/2 right-2 size-6 -translate-y-1/2 p-0 h-auto w-auto hover:bg-transparent"
              disabled={disabled}
              title="Select time"
            >
              <Clock className="size-4 text-muted-foreground" />
              <span className="sr-only">Select time</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-3"
            align="end"
            alignOffset={-8}
            sideOffset={10}
          >
            <div className="flex gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Hour</Label>
                <Select
                  value={String(hour)}
                  onValueChange={(v) => setHour(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-23 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-50">
                    {hours.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Minute</Label>
                <Select
                  value={String(minute)}
                  onValueChange={(v) => setMinute(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-23 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-50">
                    {minutes.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m.toString().padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">AM/PM</Label>
                <Select
                  value={meridiem}
                  onValueChange={(v) => setMeridiem(v as 'AM' | 'PM')}
                >
                  <SelectTrigger className="w-23 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.value}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onChange?.(preset.value);
                    setOpen(false);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange?.(undefined)}
              >
                Clear
              </Button>
              <Button size="sm" onClick={applySelection}>
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
