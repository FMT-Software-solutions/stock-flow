import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/utils/supabase';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import {
  useCreateVariationOption,
  useDeleteVariationOption,
  useDeleteVariationType,
  useRenameVariationOption,
  useRenameVariationType,
  useSetVariationArchived,
  useVariationOptions,
  useVariationTypes,
} from '@/hooks/useVariationQueries';
import { useOrganizationVariants } from '@/hooks/useSellableProducts';
import { useProducts } from '@/hooks/useInventoryQueries';
import { useSaveCustomOptions } from '@/hooks/useProductStock';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { VariationOption, VariationType } from '@/types/inventory';
import { customOptionError } from './product-editor/productHelpers';

type View = 'options' | 'custom';

const errorMessage = (error: unknown, fallback: string) => (error as Error)?.message || fallback;

/** Option types and values, and every product's custom options, editable in place. */
export function Variations() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const { data: types = [], isLoading } = useVariationTypes(orgId);
  const { data: variants = [] } = useOrganizationVariants(orgId);
  const [view, setView] = useState<View>('options');

  // How many active variants use each type, and each type + value.
  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    variants
      .filter((v) => !v.custom_label)
      .forEach((v) =>
        Object.entries(v.attributes ?? {}).forEach(([type, value]) => {
          counts.set(type, (counts.get(type) ?? 0) + 1);
          counts.set(`${type}\u0000${value}`, (counts.get(`${type}\u0000${value}`) ?? 0) + 1);
        })
      );
    return counts;
  }, [variants]);

  const customCount = variants.filter((v) => v.custom_label).length;
  const sortedTypes = [...types].sort((a, b) => Number(a.isArchived) - Number(b.isArchived) || a.name.localeCompare(b.name));

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md bg-muted p-1">
        {(
          [
            ['options', 'Options', types.length],
            ['custom', 'Custom options', customCount],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            className={cn(
              'rounded px-3 py-1 text-sm font-medium',
              view === value ? 'bg-background shadow-sm' : 'text-muted-foreground'
            )}
          >
            {label} <span className="tabular-nums text-muted-foreground">{count}</span>
          </button>
        ))}
      </div>

      {view === 'options' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedTypes.map((type) => (
            <TypeCard key={type.id} type={type} organizationId={orgId} usage={usage} />
          ))}
        </div>
      ) : (
        <CustomOptions organizationId={orgId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline name editing
// ---------------------------------------------------------------------------

function EditableName({
  value,
  onSave,
  canEdit,
  className,
  label,
}: {
  value: string;
  /** Resolves true when saved. */
  onSave: (next: string) => Promise<boolean>;
  canEdit: boolean;
  className?: string;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  // A refused name stays for correcting; leaving the field then drops it.
  const [failed, setFailed] = useState(false);

  const cancel = () => {
    setEditing(false);
    setFailed(false);
    setDraft(value);
  };

  const save = async () => {
    const next = draft.trim();
    if (!next || next === value) return cancel();
    setSaving(true);
    const ok = await onSave(next);
    setSaving(false);
    if (ok) setEditing(false);
    else setFailed(true);
  };

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex min-w-0 items-center gap-1"
      >
        <Input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setFailed(false);
          }}
          onKeyDown={(e) => e.key === 'Escape' && cancel()}
          onBlur={() => !saving && (failed ? cancel() : save())}
          autoFocus
          readOnly={saving}
          className="h-7 min-w-32 text-sm"
          aria-label={label}
        />
        {saving && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />}
      </form>
    );
  }

  return (
    <div className={cn('group flex min-w-0 items-center gap-1', className)}>
      <span className="truncate">{value}</span>
      {canEdit && (
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
          aria-label={`Rename ${value}`}
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Option types and values
// ---------------------------------------------------------------------------

function TypeCard({
  type,
  organizationId,
  usage,
}: {
  type: VariationType;
  organizationId?: string;
  usage: Map<string, number>;
}) {
  const { data: options = [], isLoading } = useVariationOptions(type.id, organizationId);
  const createOption = useCreateVariationOption();
  const renameType = useRenameVariationType();
  const setArchived = useSetVariationArchived();
  const deleteType = useDeleteVariationType();
  const { checkPermission } = useRoleCheck();
  const canEdit = checkPermission('variations', 'edit');
  const canCreate = checkPermission('variations', 'create');
  const canDelete = checkPermission('variations', 'delete');
  const [newValue, setNewValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isSystem = !type.organizationId;
  const used = usage.get(type.name) ?? 0;
  const sortedOptions = [...options].sort(
    (a, b) => Number(a.isArchived) - Number(b.isArchived) || a.value.localeCompare(b.value, undefined, { numeric: true })
  );

  const addValue = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = newValue.trim();
    if (!organizationId || !value) return;
    if (options.some((o) => o.value.toLowerCase() === value.toLowerCase())) {
      toast.error(`${type.name} already has ${value}`);
      return;
    }
    try {
      await createOption.mutateAsync({ variationTypeId: type.id, value, organizationId });
      setNewValue('');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not add value'));
    }
  };

  const rename = async (name: string) => {
    try {
      await renameType.mutateAsync({ id: type.id, name });
      toast.success(`Renamed to ${name}`);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'Could not rename'));
      return false;
    }
  };

  const toggleArchived = async () => {
    try {
      await setArchived.mutateAsync({ kind: 'type', id: type.id, archived: !type.isArchived });
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update'));
    }
  };

  const remove = async () => {
    try {
      await deleteType.mutateAsync(type.id);
      toast.success(`${type.name} deleted`);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not delete'));
    }
  };

  return (
    <Card className={cn(type.isArchived && 'opacity-70')}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <div className="flex min-w-0 items-center gap-2 font-medium">
          <EditableName value={type.name} onSave={rename} canEdit={canEdit && !isSystem} label="Option name" />
          <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground" title="Variants using it">
            {used}
          </span>
          {type.isArchived && (
            <Badge variant="outline" className="shrink-0 text-xs font-normal">
              Archived
            </Badge>
          )}
        </div>
        {!isSystem && (canEdit || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`${type.name} actions`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem onSelect={toggleArchived}>{type.isArchived ? 'Restore' : 'Archive'}</DropdownMenuItem>
              )}
              {canDelete && used === 0 && (
                <DropdownMenuItem className="text-destructive" onSelect={() => setConfirmDelete(true)}>
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            sortedOptions.map((option) => (
              <ValueChip
                key={option.id}
                option={option}
                type={type}
                used={usage.get(`${type.name}\u0000${option.value}`) ?? 0}
                canEdit={canEdit && !!option.organizationId}
                canDelete={canDelete && !!option.organizationId}
              />
            ))
          )}
        </div>
        {!isSystem && canCreate && !type.isArchived && (
          <form onSubmit={addValue} className="flex gap-2">
            <Input
              placeholder="Add value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="h-8"
              aria-label={`Add ${type.name} value`}
            />
            <Button type="submit" size="sm" variant="outline" className="h-8" disabled={createOption.isPending} aria-label="Add">
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        )}
      </CardContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {type.name}?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ValueChip({
  option,
  type,
  used,
  canEdit,
  canDelete,
}: {
  option: VariationOption;
  type: VariationType;
  used: number;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const renameOption = useRenameVariationOption();
  const setArchived = useSetVariationArchived();
  const deleteOption = useDeleteVariationOption();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(option.value);

  const chip = (
    <Badge
      variant={option.isArchived ? 'outline' : 'secondary'}
      className={cn('gap-1 font-normal', option.isArchived && 'text-muted-foreground line-through')}
    >
      {option.value}
      {used > 0 && <span className="tabular-nums text-muted-foreground">{used}</span>}
    </Badge>
  );

  if (!canEdit && !canDelete) return chip;

  const run = async (action: () => Promise<unknown>, done?: string) => {
    try {
      await action();
      if (done) toast.success(done);
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update'));
    }
  };

  const rename = () => {
    const value = draft.trim();
    if (!value || value === option.value) return setOpen(false);
    run(() => renameOption.mutateAsync({ id: option.id, value }), `Renamed to ${value}`);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(option.value);
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {chip}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3" align="start">
        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
          <span>{type.name}</span>
          <span className="tabular-nums">{used} variants</span>
        </div>
        {canEdit && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              rename();
            }}
            className="flex gap-2"
          >
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus className="h-8" aria-label="Value" />
            <Button type="submit" size="sm" className="h-8" disabled={renameOption.isPending}>
              {renameOption.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
            </Button>
          </form>
        )}
        <div className="flex justify-between gap-2">
          {canEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => run(() => setArchived.mutateAsync({ kind: 'option', id: option.id, archived: !option.isArchived }))}
              disabled={setArchived.isPending}
            >
              {option.isArchived ? 'Restore' : 'Archive'}
            </Button>
          )}
          {canDelete && used === 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => run(() => deleteOption.mutateAsync(option.id), `${option.value} deleted`)}
              disabled={deleteOption.isPending}
            >
              Delete
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Custom options, grouped by product
// ---------------------------------------------------------------------------

/** Active stock of each custom option, all branches. */
function useCustomOptionStock(organizationId?: string) {
  return useQuery({
    queryKey: ['custom_option_stock', organizationId],
    queryFn: async () => {
      if (!organizationId) return new Map<string, number>();
      const { data, error } = await supabase
        .from('inventory')
        .select('variant_id, quantity')
        .eq('organization_id', organizationId)
        .eq('type', 'custom')
        .eq('is_deleted', false)
        .not('variant_id', 'is', null);
      if (error) throw error;
      const totals = new Map<string, number>();
      (data ?? []).forEach((r: { variant_id: string; quantity: number | string | null }) =>
        totals.set(r.variant_id, (totals.get(r.variant_id) ?? 0) + Number(r.quantity ?? 0))
      );
      return totals;
    },
    enabled: !!organizationId,
  });
}

interface CustomOption {
  id: string;
  label: string;
}

function CustomOptions({ organizationId }: { organizationId?: string }) {
  const { data: variants = [], isLoading } = useOrganizationVariants(organizationId);
  const { data: products = [] } = useProducts(organizationId);
  const { data: stock = new Map<string, number>() } = useCustomOptionStock(organizationId);
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const byProduct = new Map<string, CustomOption[]>();
    variants
      .filter((v) => v.custom_label)
      .forEach((v) => byProduct.set(v.product_id, [...(byProduct.get(v.product_id) ?? []), { id: v.id, label: v.custom_label! }]));
    const nameOf = new Map(products.map((p) => [p.id, p.name]));
    return [...byProduct.entries()]
      .filter(([productId]) => nameOf.has(productId))
      .map(([productId, options]) => ({
        productId,
        name: nameOf.get(productId)!,
        options: options.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [variants, products]);

  const query = search.trim().toLowerCase();
  const shown = query
    ? groups
        .map((g) =>
          g.name.toLowerCase().includes(query)
            ? g
            : { ...g, options: g.options.filter((o) => o.label.toLowerCase().includes(query)) }
        )
        .filter((g) => g.options.length > 0)
    : groups;

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products or options"
          className="pl-8"
        />
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No custom options</p>
      ) : (
        <div className="divide-y rounded-md border">
          {shown.map((group) => (
            <CustomGroup
              key={group.productId}
              productId={group.productId}
              name={group.name}
              options={group.options}
              allOptions={groups.find((g) => g.productId === group.productId)!.options}
              stock={stock}
              forceOpen={!!query}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CustomGroup({
  productId,
  name,
  options,
  allOptions,
  stock,
  forceOpen,
}: {
  productId: string;
  name: string;
  /** Options shown (filtered by search) */
  options: CustomOption[];
  /** Every option of the product, which a save must list */
  allOptions: CustomOption[];
  stock: Map<string, number>;
  forceOpen: boolean;
}) {
  const saveCustoms = useSaveCustomOptions();
  const { checkPermission } = useRoleCheck();
  const canEdit = checkPermission('products', 'edit');
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<CustomOption | null>(null);
  const total = allOptions.reduce((sum, o) => sum + (stock.get(o.id) ?? 0), 0);

  const save = async (next: CustomOption[], done: string) => {
    try {
      await saveCustoms.mutateAsync({ productId, options: next });
      toast.success(done);
      return true;
    } catch (error) {
      toast.error(customOptionError(error));
      return false;
    }
  };

  const rename = (option: CustomOption, label: string) =>
    save(
      allOptions.map((o) => (o.id === option.id ? { ...o, label } : o)),
      `Renamed to ${label}`
    );

  const remove = (option: CustomOption) =>
    save(
      allOptions.filter((o) => o.id !== option.id),
      `${option.label} removed`
    );

  const isOpen = forceOpen || open;

  return (
    <Collapsible open={isOpen} onOpenChange={setOpen}>
      <div className="flex items-center gap-2 px-3 py-2">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium">
            <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-90')} />
            <span className="truncate">{name}</span>
            <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">{allOptions.length}</span>
          </button>
        </CollapsibleTrigger>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground" title="In stock">
          {total}
        </span>
        <Link
          to={`/products/${productId}`}
          className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Open
        </Link>
      </div>
      <CollapsibleContent>
        <ul className="pb-2 pl-9 pr-3">
          {options.map((option) => {
            const qty = stock.get(option.id) ?? 0;
            return (
              <li key={option.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                <EditableName
                  value={option.label}
                  onSave={(label) => rename(option, label)}
                  canEdit={canEdit}
                  label="Option name"
                />
                <div className="flex shrink-0 items-center gap-1">
                  <span className={cn('tabular-nums', qty <= 0 && 'text-muted-foreground')}>{qty}</span>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => (qty > 0 ? setRemoving(option) : remove(option))}
                      disabled={saveCustoms.isPending}
                      aria-label={`Remove ${option.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.label}?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm tabular-nums text-muted-foreground">
            {removing ? stock.get(removing.id) ?? 0 : 0} in stock
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={() => removing && remove(removing)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}
