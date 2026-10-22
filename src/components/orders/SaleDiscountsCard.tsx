import { useState } from 'react';
import { ChevronDown, ChevronUp, Info, Loader2, RotateCcw, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCurrency } from '@/hooks/useCurrency';
import { describeDiscountValue } from '@/lib/discounts';
import type { AppliedSaleDiscount, ManualDiscount, SalePricing } from '@/types/discounts';

interface SaleDiscountsCardProps {
  pricing?: SalePricing;
  isPending: boolean;
  codes: string[];
  onCodesChange: (codes: string[]) => void;
  skipped: { id: string; name: string }[];
  onSkippedChange: (skipped: { id: string; name: string }[]) => void;
  manual: ManualDiscount | null;
  onManualChange: (manual: ManualDiscount | null) => void;
  canGiveDiscount: boolean;
  disabled?: boolean;
}

export function SaleDiscountsCard({
  pricing,
  isPending,
  codes,
  onCodesChange,
  skipped,
  onSkippedChange,
  manual,
  onManualChange,
  canGiveDiscount,
  disabled,
}: SaleDiscountsCardProps) {
  const { formatCurrency } = useCurrency();
  const [open, setOpen] = useState(codes.length > 0 || !!manual);
  const [codeInput, setCodeInput] = useState('');

  const applied = pricing?.discounts ?? [];
  const rejected = pricing?.rejected ?? [];
  const discountTotal = pricing?.discountTotal ?? 0;

  const addCode = () => {
    const code = codeInput.trim();
    if (!code) return;
    if (!codes.some((c) => c.toLowerCase() === code.toLowerCase())) {
      onCodesChange([...codes, code]);
    }
    setCodeInput('');
  };

  const removeApplied = (d: AppliedSaleDiscount) => {
    if (d.kind === 'manual') {
      onManualChange(null);
    } else if (d.kind === 'code') {
      onCodesChange(codes.filter((c) => c.toLowerCase() !== (d.code ?? '').toLowerCase()));
    } else if (d.discountId) {
      onSkippedChange([...skipped, { id: d.discountId, name: d.name }]);
    }
  };

  return (
    <Card className={open ? 'py-4' : 'py-2'}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              Discounts
              {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </CardTitle>
            <div className="flex items-center gap-2">
              {!open && discountTotal > 0 && (
                <span className="text-sm font-medium text-green-600">-{formatCurrency(discountTotal)}</span>
              )}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-9 p-0" type="button">
                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span className="sr-only">Toggle</span>
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {applied.length > 0 && (
              <div className="space-y-2">
                {applied.map((d) => (
                  <div
                    key={`${d.kind}-${d.discountId ?? 'manual'}`}
                    className="flex items-center justify-between gap-2 rounded-md border p-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <span className="truncate">{d.name}</span>
                        {d.code && (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {d.code}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {describeDiscountValue(d, formatCurrency)}
                        {d.target === 'order' ? ' · sale' : ' · items'}
                        {d.reason ? ` · ${d.reason}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-green-600">-{formatCurrency(d.amount)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Remove from this sale"
                        onClick={() => removeApplied(d)}
                        disabled={disabled}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {skipped.length > 0 && (
              <div className="space-y-1">
                {skipped.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="line-through">{s.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title="Apply again"
                      onClick={() => onSkippedChange(skipped.filter((x) => x.id !== s.id))}
                      disabled={disabled}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Field>
              <FieldLabel>Code</FieldLabel>
              <div className="flex gap-1">
                <Input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCode();
                    }
                  }}
                  placeholder="Discount code"
                  disabled={disabled}
                />
                <Button type="button" onClick={addCode} disabled={disabled || !codeInput.trim()}>
                  Apply
                </Button>
              </div>
              {rejected.map((r) => (
                <div key={r.code} className="flex items-center justify-between">
                  <FieldError>
                    <span className="font-mono">{r.code}</span>: {r.reason}
                  </FieldError>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onCodesChange(codes.filter((c) => c.toLowerCase() !== r.code.toLowerCase()))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </Field>

            {(canGiveDiscount || manual) && (
              <Field>
                <FieldLabel className="flex items-center gap-1">
                  Manual discount
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-60">
                      Applied after other discounts, on what is left. Recorded on the sale with your name.
                    </TooltipContent>
                  </Tooltip>
                </FieldLabel>
                <div className="flex gap-1">
                  <Select
                    value={manual?.valueType ?? 'percentage'}
                    onValueChange={(v) =>
                      onManualChange({
                        valueType: v as ManualDiscount['valueType'],
                        value: manual?.value ?? 0,
                        reason: manual?.reason,
                      })
                    }
                    disabled={disabled || !canGiveDiscount}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">%</SelectItem>
                      <SelectItem value="fixed_amount">Amount</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-24"
                    value={manual?.value || ''}
                    placeholder="0"
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      onManualChange(
                        value > 0
                          ? { valueType: manual?.valueType ?? 'percentage', value, reason: manual?.reason }
                          : null
                      );
                    }}
                    disabled={disabled || !canGiveDiscount}
                  />
                  <Input
                    value={manual?.reason ?? ''}
                    placeholder="Reason"
                    onChange={(e) =>
                      manual && onManualChange({ ...manual, reason: e.target.value })
                    }
                    disabled={disabled || !canGiveDiscount || !manual}
                  />
                </div>
                {pricing?.manualError && manual && <FieldError>{pricing.manualError}</FieldError>}
              </Field>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
