import { useCallback, useState } from 'react';
import type { ColumnFiltersState } from '@tanstack/react-table';

const sameValues = (a: unknown, b: string[]) =>
  Array.isArray(a) && a.length === b.length && b.every((v) => a.includes(v));

/**
 * A page's table filters, held by the page so stats tiles can set them.
 * `toggle` turns a select filter on with exactly these values, or off again.
 */
export function useTableFilters(initial: ColumnFiltersState = []) {
  const [filters, setFilters] = useState<ColumnFiltersState>(initial);

  const isActive = useCallback(
    (id: string, values: string[]) => sameValues(filters.find((f) => f.id === id)?.value, values),
    [filters]
  );

  const toggle = useCallback(
    (id: string, values: string[]) =>
      setFilters((current) => {
        const on = sameValues(current.find((f) => f.id === id)?.value, values);
        const rest = current.filter((f) => f.id !== id);
        return on ? rest : [...rest, { id, value: values }];
      }),
    []
  );

  /** The date range filter, when it is the only filter (so a period comparison makes sense). */
  const onlyDateRange = (dateId = 'date'): { from?: Date; to?: Date } | null => {
    const active = filters.filter((f) => !(Array.isArray(f.value) && f.value.length === 0) && f.value !== '' && f.value != null);
    if (active.length !== 1 || active[0].id !== dateId) return null;
    const value = active[0].value as { from?: Date | string; to?: Date | string };
    if (!value?.from) return null;
    return { from: new Date(value.from), to: value.to ? new Date(value.to) : undefined };
  };

  return { filters, setFilters, isActive, toggle, onlyDateRange };
}
