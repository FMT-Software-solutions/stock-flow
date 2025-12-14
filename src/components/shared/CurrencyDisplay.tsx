import { useCurrency } from '@/hooks/useCurrency';

interface CurrencyDisplayProps {
  amount: number;
  className?: string;
}

export function CurrencyDisplay({ amount, className }: CurrencyDisplayProps) {
  const { formatCurrency } = useCurrency();
  return <span className={className}>{formatCurrency(amount)}</span>;
}
