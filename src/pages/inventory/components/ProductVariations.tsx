import { useState, useEffect, useMemo } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useVariationTypes,
  useVariationOptions,
} from '@/hooks/useVariationQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type GeneratedVariant = {
  id?: string; // If editing existing
  sku: string;
  price: number;
  quantity: number;
  attributes: Record<string, string>; // { "Color": "Red" }
};

interface ProductVariationsProps {
  basePrice: number;
  baseSku: string;
  onChange: (variants: GeneratedVariant[]) => void;
  initialVariants?: GeneratedVariant[];
}

type VariationConfig = {
  variationTypeId: string;
  variationTypeName: string;
  selectedOptions: { id: string; value: string }[];
};

export function ProductVariations({
  basePrice,
  baseSku,
  onChange,
  initialVariants = [],
}: ProductVariationsProps) {
  const { currentOrganization } = useOrganization();
  const { data: variationTypes } = useVariationTypes(currentOrganization?.id);

  // Local state for the configuration (which types and options are selected)
  const [configs, setConfigs] = useState<VariationConfig[]>([]);

  // Local state for the generated variants (to hold user edits to SKU/Price/Qty)
  const [variants, setVariants] = useState<GeneratedVariant[]>(initialVariants);

  // Helper to generate variants from a specific config state
  const generateVariantsFromConfig = (
    currentConfigs: VariationConfig[],
    currentVariants: GeneratedVariant[]
  ) => {
    if (currentConfigs.length === 0) {
      return [];
    }

    // recursive function to generate combinations
    const generateCombinations = (
      currentConfigIndex: number,
      currentAttributes: Record<string, string>
    ): Record<string, string>[] => {
      if (currentConfigIndex === currentConfigs.length) {
        return [currentAttributes];
      }

      const config = currentConfigs[currentConfigIndex];
      if (config.selectedOptions.length === 0) {
        return generateCombinations(currentConfigIndex + 1, currentAttributes);
      }

      let combinations: Record<string, string>[] = [];
      for (const option of config.selectedOptions) {
        combinations = [
          ...combinations,
          ...generateCombinations(currentConfigIndex + 1, {
            ...currentAttributes,
            [config.variationTypeName]: option.value,
          }),
        ];
      }
      return combinations;
    };

    const attributesList = generateCombinations(0, {});

    // Now map attributes to variants, preserving existing edits if possible
    return attributesList.map((attrs) => {
      // Try to find existing variant with same attributes
      const existing = currentVariants.find(
        (v) => JSON.stringify(v.attributes) === JSON.stringify(attrs)
      );

      if (existing) return existing;

      // Create new
      const skuSuffix = Object.values(attrs).join('-');
      const sku = baseSku ? `${baseSku}-${skuSuffix}` : skuSuffix;

      return {
        sku: sku,
        price: basePrice || 0,
        quantity: 0,
        attributes: attrs,
      };
    });
  };

  const updateConfigs = (newConfigs: VariationConfig[]) => {
    setConfigs(newConfigs);
    const newVariants = generateVariantsFromConfig(newConfigs, variants);
    setVariants(newVariants);
    onChange(newVariants);
  };

  const addVariationType = (typeId: string) => {
    const type = variationTypes?.find((t) => t.id === typeId);
    if (!type) return;

    if (configs.some((c) => c.variationTypeId === typeId)) return;

    const newConfigs = [
      ...configs,
      {
        variationTypeId: typeId,
        variationTypeName: type.name,
        selectedOptions: [],
      },
    ];
    updateConfigs(newConfigs);
  };

  const removeVariationType = (typeId: string) => {
    const newConfigs = configs.filter((c) => c.variationTypeId !== typeId);
    updateConfigs(newConfigs);
  };

  // Initialize from initialVariants
  useEffect(() => {
    if (
      initialVariants &&
      initialVariants.length > 0 &&
      configs.length === 0 &&
      variationTypes
    ) {
      const newConfigs: VariationConfig[] = [];
      const typeMap = new Map(variationTypes.map((t) => [t.name, t]));
      const attributesMap = new Map<string, Set<string>>();

      initialVariants.forEach((v) => {
        Object.entries(v.attributes).forEach(([key, value]) => {
          if (!attributesMap.has(key)) {
            attributesMap.set(key, new Set());
          }
          attributesMap.get(key)?.add(value);
        });
      });

      attributesMap.forEach((valuesSet, typeName) => {
        let type = typeMap.get(typeName);
        // Fallback if type not found in DB
        if (!type) {
          type = { id: typeName, name: typeName, isDefault: false };
        }

        if (type) {
          const selectedOptions = Array.from(valuesSet).map((val) => ({
            id: val, // Temporary ID, will match by value in VariationTypeRow
            value: val,
          }));

          newConfigs.push({
            variationTypeId: type.id,
            variationTypeName: type.name,
            selectedOptions: selectedOptions,
          });
        }
      });

      setConfigs(newConfigs);
      setVariants(initialVariants);
    }
  }, [initialVariants, variationTypes]);

  const handleVariantChange = (
    index: number,
    field: keyof GeneratedVariant,
    value: any
  ) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setVariants(newVariants);
    onChange(newVariants);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Variation Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Select onValueChange={addVariationType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Add Variation Type" />
              </SelectTrigger>
              <SelectContent>
                {variationTypes?.map((type) => (
                  <SelectItem
                    key={type.id}
                    value={type.id}
                    disabled={configs.some(
                      (c) => c.variationTypeId === type.id
                    )}
                  >
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {configs.map((config) => (
              <VariationTypeRow
                key={config.variationTypeId}
                config={config}
                organizationId={currentOrganization?.id}
                onRemove={() => removeVariationType(config.variationTypeId)}
                onOptionsChange={(options) => {
                  const newConfigs = configs.map((c) =>
                    c.variationTypeId === config.variationTypeId
                      ? { ...c, selectedOptions: options }
                      : c
                  );
                  updateConfigs(newConfigs);
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {variants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Generated Variants ({variants.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variant</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((variant, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {Object.entries(variant.attributes).map(
                        ([key, value]) => (
                          <Badge key={key} variant="outline" className="mr-1">
                            {key}: {value}
                          </Badge>
                        )
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={variant.sku}
                        onChange={(e) =>
                          handleVariantChange(index, 'sku', e.target.value)
                        }
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={variant.price}
                        onChange={(e) =>
                          handleVariantChange(
                            index,
                            'price',
                            parseFloat(e.target.value)
                          )
                        }
                        className="h-8 w-24"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function VariationTypeRow({
  config,
  organizationId,
  onRemove,
  onOptionsChange,
}: {
  config: VariationConfig;
  organizationId?: string;
  onRemove: () => void;
  onOptionsChange: (options: { id: string; value: string }[]) => void;
}) {
  const { data: fetchedOptions } = useVariationOptions(
    config.variationTypeId,
    organizationId
  );

  // Merge selected options with fetched options to ensure selected ones are always visible
  // even if not returned by the API (e.g. if type ID is temporary or option deleted)
  const allOptions = useMemo(() => {
    const options = [...(fetchedOptions || [])];
    config.selectedOptions.forEach((selected) => {
      // Check by value because ID might be temporary or different
      if (!options.find((o) => o.value === selected.value)) {
        options.push({
          id: selected.id,
          variationTypeId: config.variationTypeId,
          value: selected.value,
          organizationId: organizationId,
        });
      }
    });
    return options;
  }, [
    fetchedOptions,
    config.selectedOptions,
    config.variationTypeId,
    organizationId,
  ]);

  const handleOptionToggle = (option: { id: string; value: string }) => {
    const isSelected = config.selectedOptions.some(
      (o) => o.id === option.id || o.value === option.value
    );
    let newOptions;
    if (isSelected) {
      newOptions = config.selectedOptions.filter(
        (o) => o.id !== option.id && o.value !== option.value
      );
    } else {
      newOptions = [...config.selectedOptions, option];
    }
    onOptionsChange(newOptions);
  };

  return (
    <div className="flex items-center gap-4 px-4 py-2 border rounded-md">
      <div className="w-[150px] font-medium">{config.variationTypeName}</div>
      <div className="flex-1">
        <div className="flex flex-wrap gap-2">
          {allOptions.map((option) => {
            const isSelected = config.selectedOptions.some(
              (o) => o.id === option.id || o.value === option.value
            );
            return (
              <Badge
                key={option.id || option.value}
                variant={isSelected ? 'default' : 'outline'}
                className="cursor-pointer hover:opacity-80"
                onClick={() => handleOptionToggle(option)}
              >
                {option.value}
              </Badge>
            );
          })}
        </div>
        {allOptions.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No options available. Add them in Settings.
          </div>
        )}
      </div>
      <Button variant="ghost" size="icon" onClick={onRemove}>
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
}
