import { useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSaveCustomOptions, useSaveProduct } from '@/hooks/useProductStock';
import { useCreateVariationOption, useVariationOptions, useVariationTypes } from '@/hooks/useVariationQueries';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/inventory';
import {
  attributesKey,
  customOptionError,
  groupsFromVariants,
  isCustomOption,
  type OptionGroup,
} from '../product-editor/productHelpers';

type Mode = 'options' | 'custom';

/** Adds a variant to a product from its stock tab: option values or a custom name. */
export function AddVariantPopover({ product }: { product: Product }) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const { data: types = [] } = useVariationTypes(orgId);
  const saveProduct = useSaveProduct();
  const saveCustoms = useSaveCustomOptions();
  const createOption = useCreateVariationOption();

  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const optionVariants = useMemo(() => variants.filter((v) => !isCustomOption(v)), [variants]);
  const customs = useMemo(() => variants.filter(isCustomOption), [variants]);
  const groups = useMemo(
    () => groupsFromVariants(optionVariants, new Map(types.map((t) => [t.name, t.id]))),
    [optionVariants, types]
  );

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(groups.length > 0 ? 'options' : 'custom');
  const [label, setLabel] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const pending = saveProduct.isPending || saveCustoms.isPending;

  const reset = () => {
    setLabel('');
    setValues({});
    setMode(groups.length > 0 ? 'options' : 'custom');
  };

  const addCustom = async () => {
    const name = label.trim();
    if (!name) return;
    if (customs.some((c) => c.customLabel!.toLowerCase() === name.toLowerCase())) {
      toast.error('An option with this name already exists');
      return;
    }
    try {
      await saveCustoms.mutateAsync({
        productId: product.id,
        options: [...customs.map((c) => ({ id: c.id, label: c.customLabel! })), { label: name }],
      });
      toast.success(`${name} added`);
      setOpen(false);
      reset();
    } catch (error) {
      console.error('Adding custom option failed:', error);
      toast.error(customOptionError(error));
    }
  };

  const addCombination = async () => {
    const attributes = Object.fromEntries(groups.map((g) => [g.name, (values[g.name] ?? '').trim()]));
    if (Object.values(attributes).some((v) => !v)) return;
    if (optionVariants.some((v) => attributesKey(v.attributes) === attributesKey(attributes))) {
      toast.error('This variant already exists');
      return;
    }
    const sku = product.sku || 'SKU';
    try {
      await saveProduct.mutateAsync({
        product: { id: product.id },
        variants: [
          ...optionVariants.map((v) => ({ id: v.id, sku: v.sku, price: v.price, attributes: v.attributes })),
          { key: 'new', sku: `${sku}-${Object.values(attributes).join('-')}`, price: null, attributes },
        ],
      });
      // Remember new values in the organization's lists (a convenience).
      groups.forEach((g) => {
        const value = attributes[g.name];
        if (orgId && !g.values.includes(value) && types.some((t) => t.id === g.typeId)) {
          createOption.mutate({ variationTypeId: g.typeId, value, organizationId: orgId }, { onError: () => {} });
        }
      });
      toast.success(`${Object.values(attributes).join(' / ')} added`);
      setOpen(false);
      reset();
    } catch (error) {
      console.error('Adding variant failed:', error);
      toast.error((error as Error)?.message || 'Could not add variant');
    }
  };

  const submit = () => (mode === 'custom' ? addCustom() : addCombination());
  const ready =
    mode === 'custom' ? !!label.trim() : groups.every((g) => (values[g.name] ?? '').trim() !== '');

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add option
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        {groups.length > 0 && (
          <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
            {(['options', 'custom'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'rounded px-2 py-1 text-xs font-medium',
                  mode === m ? 'bg-background shadow-sm' : 'text-muted-foreground'
                )}
              >
                {m === 'options' ? groups.map((g) => g.name).join(' · ') : 'Custom'}
              </button>
            ))}
          </div>
        )}

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) submit();
          }}
        >
          {mode === 'custom' ? (
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Name"
              autoFocus
              aria-label="Custom option name"
            />
          ) : (
            groups.map((group, i) => (
              <GroupValueInput
                key={group.name}
                group={group}
                organizationId={orgId}
                knownType={types.some((t) => t.id === group.typeId)}
                value={values[group.name] ?? ''}
                onChange={(v) => setValues((s) => ({ ...s, [group.name]: v }))}
                autoFocus={i === 0}
              />
            ))
          )}
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!ready || pending}>
              {pending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Add
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function GroupValueInput({
  group,
  organizationId,
  knownType,
  value,
  onChange,
  autoFocus,
}: {
  group: OptionGroup;
  organizationId?: string;
  knownType: boolean;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  const { data: options = [] } = useVariationOptions(knownType ? group.typeId : undefined, organizationId);
  const suggestions = [
    ...new Set([...group.values, ...options.filter((o) => !o.isArchived).map((o) => o.value)]),
  ];
  const listId = `values-${group.name}`;

  return (
    <div className="grid gap-1">
      <label className="text-xs text-muted-foreground" htmlFor={`${listId}-input`}>
        {group.name}
      </label>
      <Input
        id={`${listId}-input`}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
