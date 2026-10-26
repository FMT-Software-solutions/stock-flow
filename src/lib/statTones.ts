/**
 * Colours for figures, shared by the dashboard and the page stats:
 * blue sales, green cash, red debts and stock-outs, amber warnings, orange expenses.
 */
export const TONES = {
  sales: 'text-blue-600 dark:text-blue-400',
  cash: 'text-emerald-600 dark:text-emerald-400',
  debt: 'text-red-600 dark:text-red-400',
  warn: 'text-amber-600 dark:text-amber-400',
  expense: 'text-orange-600 dark:text-orange-400',
  muted: 'text-muted-foreground',
} as const;

export type Tone = keyof typeof TONES;

/** "▲ 12% vs 1–26 Sep", coloured by whether the change is good. */
export function changeVs(
  current: number,
  previous: number | undefined | null,
  prevLabel: string | null | undefined,
  lowerIsBetter = false
): { text: string; tone: Tone } | null {
  if (previous === undefined || previous === null || !prevLabel) return null;
  if (previous === 0 && current === 0) return { text: `Same as ${prevLabel}`, tone: 'muted' };
  if (previous === 0) return { text: `Up from 0 in ${prevLabel}`, tone: lowerIsBetter ? 'debt' : 'cash' };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: `Same as ${prevLabel}`, tone: 'muted' };
  const up = pct > 0;
  return {
    text: `${up ? '▲' : '▼'} ${Math.abs(pct).toLocaleString()}% vs ${prevLabel}`,
    tone: (lowerIsBetter ? !up : up) ? 'cash' : 'debt',
  };
}
