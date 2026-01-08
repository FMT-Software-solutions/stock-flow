import { useEffect, useState } from 'react';
import { getOrgKV, setOrgKV } from '@/lib/dexie';

export function useOrgPreference<T>(
  orgId: string | undefined,
  key: string,
  defaultValue: T
) {
  const [value, setValue] = useState<T>(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    getOrgKV<T>(orgId, key).then((stored) => {
      if (stored !== undefined && stored !== null) {
        setValue(stored as T);
      } else {
        setValue(defaultValue);
      }
      setHydrated(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, key]);

  useEffect(() => {
    if (!orgId || !hydrated) return;
    setOrgKV<T>(orgId, key, value).catch(() => { });
  }, [orgId, key, value, hydrated]);

  return [value, setValue] as const;
}
