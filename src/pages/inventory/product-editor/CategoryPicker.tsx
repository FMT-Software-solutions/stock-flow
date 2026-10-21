import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCreateCategory } from '@/hooks/useInventoryQueries';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/inventory';

interface CategoryPickerProps {
  id?: string;
  value: string;
  onChange: (categoryId: string) => void;
  categories: Category[];
  organizationId?: string;
}

/** Category combobox that can create the typed category in place. */
export function CategoryPicker({ id, value, onChange, categories, organizationId }: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const createCategory = useCreateCategory();
  const { checkPermission } = useRoleCheck();
  const canCreate = checkPermission('product_categories', 'create');

  const selected = categories.find((c) => c.id === value);
  const typed = search.trim();
  const exactMatch = categories.some((c) => c.name.toLowerCase() === typed.toLowerCase());

  const handleCreate = async () => {
    if (!organizationId || !typed) return;
    try {
      const category = await createCategory.mutateAsync({ name: typed, organizationId });
      onChange(category.id);
      setSearch('');
      setOpen(false);
    } catch (error) {
      console.error('Failed to create category:', error);
      toast.error('Could not create category');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected?.name ?? 'None'}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search or create…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No categories</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', value ? 'opacity-0' : 'opacity-100')} />
                None
              </CommandItem>
              {categories.map((category) => (
                <CommandItem
                  key={category.id}
                  value={category.name}
                  onSelect={() => {
                    onChange(category.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === category.id ? 'opacity-100' : 'opacity-0')} />
                  {category.name}
                </CommandItem>
              ))}
            </CommandGroup>
            {canCreate && typed && !exactMatch && (
              <CommandGroup forceMount>
                <CommandItem value={`__create__${typed}`} onSelect={handleCreate} disabled={createCategory.isPending}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create “{typed}”
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
