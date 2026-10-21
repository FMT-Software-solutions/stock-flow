import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  useCreateVariationOption,
  useCreateVariationType,
  useVariationOptions,
  useVariationTypes,
} from '@/hooks/useVariationQueries';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import type { OptionGroup } from './productHelpers';

interface OptionsEditorProps {
  groups: OptionGroup[];
  onChange: (groups: OptionGroup[]) => void;
  organizationId?: string;
  disabled?: boolean;
}

const UUID = /^[0-9a-f-]{36}$/i;

/** Option types (Size, Colour…) and the values this product comes in. */
export function OptionsEditor({ groups, onChange, organizationId, disabled }: OptionsEditorProps) {
  const { data: types = [] } = useVariationTypes(organizationId);
  const createType = useCreateVariationType();
  const { checkPermission } = useRoleCheck();
  const canCreateOptions = checkPermission('variations', 'create');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const unused = types.filter((t) => !groups.some((g) => g.typeId === t.id || g.name === t.name));
  const typed = search.trim();
  const exists = types.some((t) => t.name.toLowerCase() === typed.toLowerCase());

  const addGroup = (typeId: string, name: string) => {
    onChange([...groups, { typeId, name, values: [] }]);
    setSearch('');
    setOpen(false);
  };

  const createGroup = async () => {
    if (!organizationId || !typed) return;
    try {
      const type = await createType.mutateAsync({ name: typed, organizationId });
      addGroup(type.id, type.name);
    } catch (error) {
      console.error('Failed to create option type:', error);
      toast.error('Could not create option');
    }
  };

  const updateGroup = (index: number, next: OptionGroup | null) => {
    const copy = [...groups];
    if (next) copy[index] = next;
    else copy.splice(index, 1);
    onChange(copy);
  };

  return (
    <div className="space-y-3">
      {groups.map((group, index) => (
        <OptionGroupRow
          key={group.typeId}
          group={group}
          organizationId={organizationId}
          canCreate={canCreateOptions}
          disabled={disabled}
          onChange={(next) => updateGroup(index, next)}
        />
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={disabled}>
            <Plus className="mr-1 h-4 w-4" />
            {groups.length === 0 ? 'Add options' : 'Add option'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput placeholder="Size, Colour…" value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandGroup>
                {unused.map((type) => (
                  <CommandItem key={type.id} value={type.name} onSelect={() => addGroup(type.id, type.name)}>
                    {type.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              {canCreateOptions && typed && !exists && (
                <CommandGroup forceMount>
                  <CommandItem value={`__create__${typed}`} onSelect={createGroup} disabled={createType.isPending}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create “{typed}”
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function OptionGroupRow({
  group,
  organizationId,
  canCreate,
  disabled,
  onChange,
}: {
  group: OptionGroup;
  organizationId?: string;
  canCreate: boolean;
  disabled?: boolean;
  onChange: (group: OptionGroup | null) => void;
}) {
  const isKnownType = UUID.test(group.typeId);
  const { data: options = [], isLoading } = useVariationOptions(isKnownType ? group.typeId : undefined, organizationId);
  const createOption = useCreateVariationOption();
  const [draft, setDraft] = useState('');

  // Values already on the product stay visible even if removed from the org list.
  const values = [...options.map((o) => o.value), ...group.values.filter((v) => !options.some((o) => o.value === v))];

  const toggle = (value: string) => {
    const selected = group.values.includes(value);
    onChange({
      ...group,
      values: selected ? group.values.filter((v) => v !== value) : [...group.values, value],
    });
  };

  const addValue = async () => {
    const value = draft.trim();
    if (!value) return;
    setDraft('');
    const existing = values.find((v) => v.toLowerCase() === value.toLowerCase());
    if (existing) {
      if (!group.values.includes(existing)) toggle(existing);
      return;
    }
    if (isKnownType && organizationId) {
      try {
        await createOption.mutateAsync({ variationTypeId: group.typeId, value, organizationId });
      } catch (error) {
        console.error('Failed to save option value:', error);
        toast.error(`Could not add “${value}”`);
        return;
      }
    }
    onChange({ ...group, values: [...group.values, value] });
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start">
      <div className="w-28 shrink-0 pt-1 text-sm font-medium">{group.name}</div>
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {isLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
        {values.map((value) => {
          const selected = group.values.includes(value);
          return (
            <Badge
              key={value}
              asChild
              variant={selected ? 'default' : 'outline'}
              className="cursor-pointer select-none"
            >
              <button type="button" onClick={() => toggle(value)} disabled={disabled} aria-pressed={selected}>
                {value}
              </button>
            </Badge>
          );
        })}
        {canCreate && (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addValue();
              }
            }}
            onBlur={addValue}
            placeholder="Add value"
            className="h-7 w-28 text-xs"
            disabled={disabled || createOption.isPending}
            aria-label={`Add ${group.name} value`}
          />
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 self-end sm:self-start"
        onClick={() => onChange(null)}
        disabled={disabled}
        aria-label={`Remove ${group.name}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
