import { useRef, useState } from 'react';
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
import { InlineCreateForm } from './InlineCreateForm';

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
  const [creating, setCreating] = useState(false);
  // The group just added gets focus in its "Add value" field.
  const [focusTypeId, setFocusTypeId] = useState<string | null>(null);
  // Stops the popover handing focus back to its trigger after adding a group.
  const keepFocus = useRef(false);

  const unused = types.filter((t) => !groups.some((g) => g.typeId === t.id || g.name === t.name));
  const typed = search.trim();
  const exists = types.some((t) => t.name.toLowerCase() === typed.toLowerCase());

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSearch('');
      setCreating(false);
    }
  };

  const addGroup = (typeId: string, name: string) => {
    onChange([...groups, { typeId, name, values: [] }]);
    setFocusTypeId(typeId);
    keepFocus.current = true;
    handleOpenChange(false);
  };

  const createGroup = async (name: string) => {
    if (!organizationId || !name) return;
    const existing = types.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!groups.some((g) => g.typeId === existing.id)) addGroup(existing.id, existing.name);
      else handleOpenChange(false);
      return;
    }
    try {
      const type = await createType.mutateAsync({ name, organizationId });
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
          autoFocus={group.typeId === focusTypeId}
          onChange={(next) => updateGroup(index, next)}
        />
      ))}

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={disabled}>
            <Plus className="mr-1 h-4 w-4" />
            {groups.length === 0 ? 'Add options' : 'Add option'}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-60 p-0"
          align="start"
          onCloseAutoFocus={(e) => {
            if (keepFocus.current) {
              e.preventDefault();
              keepFocus.current = false;
            }
          }}
        >
          {creating ? (
            <InlineCreateForm
              title="New option"
              placeholder="Material, Flavour…"
              initialValue={typed}
              pending={createType.isPending}
              onCreate={createGroup}
              onCancel={() => setCreating(false)}
            />
          ) : (
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
                {canCreateOptions && (
                  <CommandGroup forceMount className="border-t">
                    <CommandItem
                      forceMount
                      value="__new_option__"
                      onSelect={() => (typed && !exists ? createGroup(typed) : setCreating(true))}
                      disabled={createType.isPending}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {typed && !exists ? `Create “${typed}”` : 'New option'}
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          )}
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
  autoFocus,
  onChange,
}: {
  group: OptionGroup;
  organizationId?: string;
  canCreate: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
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

  const addValue = () => {
    const value = draft.trim();
    if (!value) return;
    setDraft('');
    const existing = values.find((v) => v.toLowerCase() === value.toLowerCase());
    if (existing) {
      if (!group.values.includes(existing)) toggle(existing);
      return;
    }
    // Select it right away so fast typing never waits on the network; the
    // product saves the value either way, the org list is a convenience.
    onChange({ ...group, values: [...group.values, value] });
    if (isKnownType && organizationId) {
      createOption.mutate(
        { variationTypeId: group.typeId, value, organizationId },
        {
          onError: (error) => {
            console.error('Failed to save option value:', error);
            toast.error(`“${value}” wasn't saved to your ${group.name} list`);
          },
        }
      );
    }
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
            placeholder="+ Add value"
            autoFocus={autoFocus}
            className="h-7 w-28 text-xs"
            disabled={disabled}
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
