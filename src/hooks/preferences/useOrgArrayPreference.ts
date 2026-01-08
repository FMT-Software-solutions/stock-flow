import { useEffect, useState } from 'react';
import { getOrgKV, setOrgKV } from '@/lib/dexie';

export function useOrgArrayPreference<T extends string>(
  orgId: string | undefined,
  key: string,
  defaultValue: T[]
) {
  const [value, setValue] = useState<T[]>(defaultValue);

  useEffect(() => {
    if (!orgId) return;
    getOrgKV<T[]>(orgId, key).then((stored) => {
      if (stored && Array.isArray(stored) && stored.length > 0) {
        setValue(stored);
        return;
      }
      setValue(defaultValue);
      setOrgKV<T[]>(orgId, key, defaultValue).catch(() => {});
    });
  }, [orgId, key, defaultValue]);

  return [value, setValue] as const;
}

