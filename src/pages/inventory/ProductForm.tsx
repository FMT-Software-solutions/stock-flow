import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, Loader2, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ModernFileUpload } from '@/components/shared/ModernFileUpload';
import { AiGeneratorButton } from '@/components/shared/AiGeneratorButton';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBranchContext } from '@/contexts/BranchContext';
import { useCategories, useProduct, useSuppliers } from '@/hooks/useInventoryQueries';
import { useProductStock, useSaveProduct, type SaveProductInput, type StockRow } from '@/hooks/useProductStock';
import { useVariationTypes } from '@/hooks/useVariationQueries';
import { deleteImageFromCloudinary, uploadImageToCloudinary } from '@/utils/cloudinary';
import { cn } from '@/lib/utils';
import type { Branch } from '@/types/branches';
import type { Category, Product, Supplier } from '@/types/inventory';
import { CategoryPicker } from './product-editor/CategoryPicker';
import { OptionsEditor } from './product-editor/OptionsEditor';
import {
  attributesKey,
  cellKey,
  combineOptions,
  generateSku,
  groupsFromVariants,
  splitStockRows,
  variantLabel,
  type OptionGroup,
} from './product-editor/productHelpers';

type Status = 'published' | 'draft' | 'inactive';

interface Fields {
  name: string;
  sellingPrice: string;
  costPrice: string;
  categoryId: string;
  supplierId: string;
  sku: string;
  barcode: string;
  unit: string;
  description: string;
  status: Status;
  imageUrl: string;
  additionalImages: string[];
  trackStock: boolean;
}

interface VariantDraft {
  /** variant id for saved variants, a client key for new ones */
  key: string;
  id?: string;
  attributes: Record<string, string>;
  sku: string;
  /** '' = same as the product price */
  price: string;
}

interface EditorState {
  fields: Fields;
  groups: OptionGroup[];
  drafts: Record<string, VariantDraft>; // by attributesKey
  stock: Record<string, string>; // by cellKey(variant key | null, branch)
  lowStock: string;
}

const NO_SUPPLIER = '__none__';

export function ProductForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data: product, isLoading: productLoading } = useProduct(id);
  const { data: stockRows = [], isLoading: stockLoading } = useProductStock(id);
  const { data: categories = [] } = useCategories(orgId);
  const { data: suppliers = [] } = useSuppliers(orgId);
  const { data: variationTypes, isLoading: typesLoading } = useVariationTypes(orgId);

  if (isEditing && (productLoading || stockLoading || typesLoading || !product)) {
    return (
      <div className="flex justify-center p-12">
        {productLoading || stockLoading || typesLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <span className="text-muted-foreground">Product not found</span>
        )}
      </div>
    );
  }

  return (
    <ProductEditor
      key={id ?? 'new'}
      product={product ?? null}
      stockRows={stockRows}
      categories={categories}
      suppliers={suppliers}
      typeIdByName={new Map((variationTypes ?? []).map((t) => [t.name, t.id]))}
      organizationId={orgId}
      trackStockByDefault={currentOrganization?.track_stock_by_default ?? true}
    />
  );
}

function initialState(
  product: Product | null,
  stockRows: StockRow[],
  typeIdByName: Map<string, string>,
  trackStockByDefault: boolean
): EditorState {
  const variants = product?.variants ?? [];
  const fields: Fields = {
    name: product?.name ?? '',
    sellingPrice: product ? String(product.sellingPrice ?? '') : '',
    costPrice: product?.costPrice ? String(product.costPrice) : '',
    categoryId: product?.categoryId ?? '',
    supplierId: product?.supplierId ?? '',
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    unit: product?.unit || 'pcs',
    description: product?.description ?? '',
    status: (product?.status?.toLowerCase() as Status) || 'published',
    imageUrl: product?.imageUrl ?? '',
    additionalImages: product?.additionalImages ?? [],
    trackStock: product?.trackStock ?? trackStockByDefault,
  };

  const drafts: Record<string, VariantDraft> = {};
  variants.forEach((v) => {
    drafts[attributesKey(v.attributes)] = {
      key: v.id,
      id: v.id,
      attributes: v.attributes,
      sku: v.sku ?? '',
      price: v.price === null || v.price === undefined ? '' : String(v.price),
    };
  });

  const hasVariants = variants.length > 0;
  const { cells } = splitStockRows(stockRows, new Set(variants.map((v) => v.id)), hasVariants);
  const stock: Record<string, string> = {};
  cells.forEach((row, key) => {
    stock[key] = String(row.quantity);
  });
  // The alert is stored per stock row; show the highest one set on the product.
  const alerts = stockRows.filter((r) => !r.isDeleted).map((r) => r.minStockLevel);

  return {
    fields,
    groups: groupsFromVariants(variants, typeIdByName),
    drafts,
    stock,
    lowStock: alerts.length > 0 ? String(Math.max(...alerts)) : '',
  };
}

function ProductEditor({
  product,
  stockRows,
  categories,
  suppliers,
  typeIdByName,
  organizationId,
  trackStockByDefault,
}: {
  product: Product | null;
  stockRows: StockRow[];
  categories: Category[];
  suppliers: Supplier[];
  typeIdByName: Map<string, string>;
  organizationId?: string;
  trackStockByDefault: boolean;
}) {
  const navigate = useNavigate();
  const isEditing = !!product;
  const { availableBranches } = useBranchContext();
  const { checkPermission } = useRoleCheck();
  const canEditStock = checkPermission('inventory', 'edit') || checkPermission('inventory', 'create');
  const saveProduct = useSaveProduct();

  const [initial] = useState(() => initialState(product, stockRows, typeIdByName, trackStockByDefault));
  const [state, setState] = useState<EditorState>(initial);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'sellingPrice', string>>>({});
  const [moreOpen, setMoreOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<{ label: string; quantity: number }[] | null>(null);

  const { fields, groups, drafts, stock, lowStock } = state;
  const branches: Branch[] = availableBranches;

  const setField = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setState((s) => ({ ...s, fields: { ...s.fields, [key]: value } }));

  // Variants follow the selected option values; drafts keep edits to a
  // combination even while it is toggled off and on again.
  const variants = useMemo<VariantDraft[]>(
    () =>
      combineOptions(groups).map((attributes) => {
        const k = attributesKey(attributes);
        return drafts[k] ?? { key: `new:${k}`, attributes, sku: '', price: '' };
      }),
    [groups, drafts]
  );
  const hasVariants = variants.length > 0;

  const updateDraft = (draft: VariantDraft, patch: Partial<VariantDraft>) =>
    setState((s) => ({
      ...s,
      drafts: { ...s.drafts, [attributesKey(draft.attributes)]: { ...draft, ...patch } },
    }));

  const setStock = (key: string, value: string) => setState((s) => ({ ...s, stock: { ...s.stock, [key]: value } }));

  // Saved variants that are no longer selected, and the stock they hold.
  const removedVariants = useMemo(() => {
    const kept = new Set(variants.map((v) => v.id).filter(Boolean));
    return (product?.variants ?? [])
      .filter((v) => !kept.has(v.id))
      .map((v) => ({
        label: variantLabel(v.attributes),
        quantity: stockRows
          .filter((r) => r.variantId === v.id && !r.isDeleted)
          .reduce((sum, r) => sum + r.quantity, 0),
      }));
  }, [variants, product, stockRows]);

  const handleImageUpload = async (files: File[], target: 'main' | 'more') => {
    try {
      setUploading(true);
      const urls = await Promise.all(files.map((file) => uploadImageToCloudinary(file)));
      if (target === 'main') setField('imageUrl', urls[0]);
      else setField('additionalImages', [...fields.additionalImages, ...urls]);
    } catch (error) {
      console.error('Upload failed', error);
      toast.error('Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url: string, target: 'main' | 'more') => {
    if (target === 'main') setField('imageUrl', '');
    else setField('additionalImages', fields.additionalImages.filter((u) => u !== url));
    // Uploads from this session are deleted right away. Saved images are left
    // in Cloudinary so Cancel doesn't break the stored product.
    if (url !== product?.imageUrl && !product?.additionalImages?.includes(url)) {
      deleteImageFromCloudinary(url).catch((error) => console.error('Failed to delete image', error));
    }
  };

  const validate = () => {
    const next: typeof errors = {};
    if (fields.name.trim().length < 2) next.name = 'Enter a name';
    if (fields.sellingPrice === '' || Number.isNaN(Number(fields.sellingPrice)) || Number(fields.sellingPrice) < 0) {
      next.sellingPrice = 'Enter a price';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = (): SaveProductInput => {
    const sku = fields.sku.trim() || generateSku(fields.name);
    const productPayload: Record<string, unknown> = {
      name: fields.name.trim(),
      sku,
      description: fields.description,
      category_id: fields.categoryId || null,
      supplier_id: fields.supplierId || null,
      selling_price: Number(fields.sellingPrice),
      cost_price: fields.costPrice === '' ? 0 : Number(fields.costPrice),
      unit: fields.unit.trim() || 'pcs',
      status: fields.status,
      image_url: fields.imageUrl || null,
      additional_images: fields.additionalImages,
      barcode: fields.barcode.trim() || null,
      track_stock: fields.trackStock,
    };
    if (product) productPayload.id = product.id;
    else productPayload.organization_id = organizationId;

    const variantPayload = variants.map((v) => ({
      id: v.id,
      key: v.key,
      sku: v.sku.trim() || `${sku}-${Object.values(v.attributes).join('-')}`,
      price: v.price === '' ? null : Number(v.price),
      attributes: v.attributes,
    }));

    const stockPayload: NonNullable<SaveProductInput['stock']> = [];
    if (fields.trackStock && canEditStock) {
      const lowChanged = lowStock !== initial.lowStock && lowStock !== '';
      const rowsFor = hasVariants ? variants : [null];
      rowsFor.forEach((variant) =>
        branches.forEach((branch) => {
          const key = cellKey(variant ? variant.key : null, branch.id);
          const value = stock[key] ?? '';
          const changed = value !== '' && value !== (initial.stock[key] ?? '');
          const exists = key in initial.stock;
          if (!changed && !(lowChanged && exists)) return;
          // New rows take the product's alert; existing ones only when it changed.
          const applyAlert = lowStock !== '' && (lowChanged || !exists);
          stockPayload.push({
            branch_id: branch.id,
            ...(variant ? (variant.id ? { variant_id: variant.id } : { variant_key: variant.key }) : {}),
            ...(changed ? { quantity: Number(value) } : {}),
            ...(applyAlert ? { min_stock_level: Number(lowStock) } : {}),
          });
        })
      );
    }

    return { product: productPayload, variants: variantPayload, stock: stockPayload };
  };

  const save = async () => {
    try {
      const result = await saveProduct.mutateAsync(buildPayload());
      toast.success(isEditing ? 'Product saved' : 'Product created');
      navigate(`/products/${result.product_id}`);
    } catch (error) {
      console.error('Failed to save product:', error);
      toast.error((error as Error)?.message || 'Failed to save product');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const withStock = removedVariants.filter((v) => v.quantity > 0);
    if (withStock.length > 0) {
      setConfirmArchive(withStock);
      return;
    }
    save();
  };

  const busy = saveProduct.isPending || uploading;
  const stockInput = (key: string, label: string) => (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      step="any"
      value={stock[key] ?? ''}
      onChange={(e) => setStock(key, e.target.value)}
      placeholder="0"
      className="h-8 w-20 text-right tabular-nums"
      aria-label={label}
      disabled={!canEditStock}
    />
  );

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold tracking-tight">{isEditing ? 'Edit product' : 'New product'}</h1>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {saveProduct.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </div>

      {/* Basics */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row">
          <div className="relative h-28 w-28 shrink-0">
            {fields.imageUrl ? (
              <>
                <img src={fields.imageUrl} alt="" className="h-full w-full rounded-lg border object-cover" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute right-1 top-1 h-6 w-6"
                  onClick={() => removeImage(fields.imageUrl, 'main')}
                  aria-label="Remove photo"
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <ModernFileUpload
                variant="compact"
                className="h-full w-full"
                onFileSelect={(file) => handleImageUpload([file], 'main')}
                disabled={uploading}
              />
            )}
          </div>
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.name} className="sm:col-span-2">
              <FieldLabel htmlFor="product-name">Name</FieldLabel>
              <Input
                id="product-name"
                value={fields.name}
                onChange={(e) => setField('name', e.target.value)}
                autoFocus={!isEditing}
              />
              {errors.name && <FieldError>{errors.name}</FieldError>}
            </Field>
            <Field data-invalid={!!errors.sellingPrice}>
              <FieldLabel htmlFor="product-price">Price</FieldLabel>
              <Input
                id="product-price"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={fields.sellingPrice}
                onChange={(e) => setField('sellingPrice', e.target.value)}
              />
              {errors.sellingPrice && <FieldError>{errors.sellingPrice}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="product-category">Category</FieldLabel>
              <CategoryPicker
                id="product-category"
                value={fields.categoryId}
                onChange={(value) => setField('categoryId', value)}
                categories={categories}
                organizationId={organizationId}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Stock (products without options) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            <label htmlFor="track-stock">Track stock</label>
          </CardTitle>
          <Switch
            id="track-stock"
            checked={fields.trackStock}
            onCheckedChange={(checked) => setField('trackStock', checked)}
          />
        </CardHeader>
        {fields.trackStock && (
          <CardContent className="space-y-4">
            {!hasVariants && canEditStock && (
              <div className="flex flex-wrap gap-4">
                {branches.map((branch) => {
                  const key = cellKey(null, branch.id);
                  return (
                    <div key={branch.id} className="grid gap-1">
                      <span className="text-xs text-muted-foreground">{branches.length > 1 ? branch.name : 'Stock'}</span>
                      {stockInput(key, `Stock in ${branch.name}`)}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="grid gap-1">
              <label htmlFor="low-stock" className="text-xs text-muted-foreground">
                Low stock alert
              </label>
              <Input
                id="low-stock"
                type="number"
                min={0}
                step="any"
                value={lowStock}
                onChange={(e) => setState((s) => ({ ...s, lowStock: e.target.value }))}
                placeholder="0"
                className="h-8 w-20 text-right tabular-nums"
                disabled={!canEditStock}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Options & variants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <OptionsEditor
            groups={groups}
            onChange={(next) => setState((s) => ({ ...s, groups: next }))}
            organizationId={organizationId}
          />

          {hasVariants && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Variant</th>
                    <th className="px-3 py-2 text-right font-medium">Price</th>
                    {fields.trackStock &&
                      canEditStock &&
                      branches.map((b) => (
                        <th key={b.id} className="whitespace-nowrap px-3 py-2 text-right font-medium">
                          {branches.length > 1 ? b.name : 'Stock'}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {variants.map((variant) => (
                    <tr key={variant.key} className="border-t">
                      <td className="whitespace-nowrap px-3 py-2">{variantLabel(variant.attributes)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          value={variant.price}
                          placeholder={fields.sellingPrice || '0'}
                          onChange={(e) => updateDraft(variant, { price: e.target.value })}
                          className="ml-auto h-8 w-24 text-right tabular-nums"
                          aria-label={`Price of ${variantLabel(variant.attributes)}`}
                        />
                      </td>
                      {fields.trackStock &&
                        canEditStock &&
                        branches.map((b) => (
                          <td key={b.id} className="px-3 py-1.5">
                            <div className="flex justify-end">
                              {stockInput(
                                cellKey(variant.key, b.id),
                                `${variantLabel(variant.attributes)} stock in ${b.name}`
                              )}
                            </div>
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* More details */}
      <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <button type="button" className="flex w-full items-center justify-between px-6 py-4 text-left">
              <span className="text-base font-semibold">More details</span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', moreOpen && 'rotate-180')} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="product-sku">SKU</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="product-sku"
                    value={fields.sku}
                    onChange={(e) => setField('sku', e.target.value)}
                    placeholder="Auto"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Generate from name"
                    onClick={() => fields.name && setField('sku', generateSku(fields.name))}
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="product-barcode">Barcode</FieldLabel>
                <Input id="product-barcode" value={fields.barcode} onChange={(e) => setField('barcode', e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="product-cost">Cost price</FieldLabel>
                <Input
                  id="product-cost"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={fields.costPrice}
                  onChange={(e) => setField('costPrice', e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="product-unit">Unit</FieldLabel>
                <Input id="product-unit" value={fields.unit} onChange={(e) => setField('unit', e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="product-supplier">Supplier</FieldLabel>
                <Select
                  value={fields.supplierId || NO_SUPPLIER}
                  onValueChange={(value) => setField('supplierId', value === NO_SUPPLIER ? '' : value)}
                >
                  <SelectTrigger id="product-supplier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SUPPLIER}>None</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="product-status">Status</FieldLabel>
                <Select value={fields.status} onValueChange={(value) => setField('status', value as Status)}>
                  <SelectTrigger id="product-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="inactive">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="product-description">Description</FieldLabel>
                  <AiGeneratorButton
                    context={{
                      productName: fields.name,
                      categoryName: categories.find((c) => c.id === fields.categoryId)?.name,
                    }}
                    onGenerate={(text) => setField('description', text)}
                  />
                </div>
                <Textarea
                  id="product-description"
                  value={fields.description}
                  onChange={(e) => setField('description', e.target.value)}
                  className="resize-none"
                />
              </Field>
              <div className="grid gap-2 sm:col-span-2">
                <span className="text-sm font-medium">More photos</span>
                <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
                  {fields.additionalImages.map((url) => (
                    <div key={url} className="relative aspect-square overflow-hidden rounded-lg border">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute right-1 top-1 h-5 w-5"
                        onClick={() => removeImage(url, 'more')}
                        aria-label="Remove photo"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <div className="aspect-square">
                    <ModernFileUpload
                      variant="compact"
                      className="h-full w-full"
                      multiple
                      onFilesSelect={(files) => handleImageUpload(files, 'more')}
                      onFileSelect={(file) => handleImageUpload([file], 'more')}
                      disabled={uploading}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <AlertDialog open={!!confirmArchive} onOpenChange={(open) => !open && setConfirmArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove variants with stock?</AlertDialogTitle>
          </AlertDialogHeader>
          <ul className="space-y-1 text-sm">
            {confirmArchive?.map((v) => (
              <li key={v.label} className="flex justify-between">
                <span>{v.label}</span>
                <span className="tabular-nums text-muted-foreground">{v.quantity} in stock</span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmArchive(null);
                save();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
