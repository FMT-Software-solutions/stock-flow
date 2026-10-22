import { useState } from 'react';
import { Check, ChevronsUpDown, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * One-line branch filter for report bars: "All branches", the branch name, or
 * "2 branches", opening a checklist. An empty selection means all branches.
 */
export function BranchFilter({
  branches,
  value,
  onChange,
  className,
}: {
  branches: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const all = value.length === 0 || value.length === branches.length;
  const label = all
    ? 'All branches'
    : value.length === 1
      ? branches.find((b) => b.id === value[0])?.name ?? '1 branch'
      : `${value.length} branches`;

  const toggle = (id: string) => {
    // From "all", picking a branch narrows to just that branch.
    if (all) {
      onChange([id]);
      return;
    }
    const next = value.includes(id) ? value.filter((x) => x !== id) : [...value, id];
    // Unticking the last branch, or ticking every branch, means all again.
    onChange(next.length === branches.length ? [] : next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Branches"
          title={all ? undefined : branches.filter((b) => value.includes(b.id)).map((b) => b.name).join(', ')}
          className={cn('justify-between gap-2 font-normal', className)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="end">
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem value="__all__" onSelect={() => onChange([])}>
                <Check className={cn('mr-2 h-4 w-4', all ? 'opacity-100' : 'opacity-0')} />
                All branches
              </CommandItem>
            </CommandGroup>
            <CommandGroup className="border-t">
              {branches.map((b) => {
                const checked = !all && value.includes(b.id);
                return (
                  <CommandItem key={b.id} value={`${b.name} ${b.id}`} onSelect={() => toggle(b.id)}>
                    <Check className={cn('mr-2 h-4 w-4', checked ? 'opacity-100' : 'opacity-0')} />
                    {b.name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
