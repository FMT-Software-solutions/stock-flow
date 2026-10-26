import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrgKV, setOrgKV } from '@/lib/dexie';

/**
 * A list kept per organization on this device. Loads once per organization
 * and key (the default may be a new array on every render); every change is
 * saved. An empty list is a valid choice (everything hidden).
 */
export function useOrgArrayPreference<T extends string>(
  orgId: string | undefined,
  key: string,
  defaultValue: T[]
) {
  const [value, setValue] = useState<T[]>(defaultValue);
  const defaultRef = useRef(defaultValue);
  defaultRef.current = defaultValue;

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    getOrgKV<T[]>(orgId, key).then((stored) => {
      if (cancelled) return;
      setValue(Array.isArray(stored) ? stored : defaultRef.current);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId, key]);

  const update = useCallback(
    (next: T[]) => {
      setValue(next);
      if (orgId) setOrgKV<T[]>(orgId, key, next).catch(() => {});
    },
    [orgId, key]
  );

  return [value, update] as const;
}
