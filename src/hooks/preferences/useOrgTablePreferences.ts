import { useEffect, useState } from 'react';
import type { VisibilityState } from '@tanstack/react-table';
import { getOrgKV, setOrgKV } from '@/lib/dexie';

export function useOrgTablePreferences(
  orgId: string | undefined,
  storageKey: string | undefined,
  defaultColumnVisibility: VisibilityState = {},
  defaultPageSize = 10
) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaultColumnVisibility);
  const [pageSize, setPageSize] = useState<number>(defaultPageSize);
  const [hydratedVisibility, setHydratedVisibility] = useState(false);
  const [hydratedPagination, setHydratedPagination] = useState(false);

  useEffect(() => {
    if (!orgId || !storageKey) return;
    const visibilityKey = `table.${storageKey}.visibility`;
    getOrgKV<VisibilityState>(orgId, visibilityKey).then((stored) => {
      if (stored) {
        setColumnVisibility({ ...defaultColumnVisibility, ...stored });
      } else {
        setColumnVisibility(defaultColumnVisibility);
      }
      setHydratedVisibility(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, storageKey]);

  useEffect(() => {
    if (!orgId || !storageKey) return;
    const paginationKey = `table.${storageKey}.pagination`;
    getOrgKV<{ pageSize: number }>(orgId, paginationKey).then((stored) => {
      if (stored && typeof stored.pageSize === 'number') {
        setPageSize(stored.pageSize);
      } else {
        setPageSize(defaultPageSize);
      }
      setHydratedPagination(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, storageKey]);

  useEffect(() => {
    if (!orgId || !storageKey || !hydratedVisibility) return;
    const visibilityKey = `table.${storageKey}.visibility`;
    setOrgKV<VisibilityState>(orgId, visibilityKey, columnVisibility).catch(() => { });
  }, [orgId, storageKey, columnVisibility, hydratedVisibility]);

  useEffect(() => {
    if (!orgId || !storageKey || !hydratedPagination) return;
    const paginationKey = `table.${storageKey}.pagination`;
    setOrgKV<{ pageSize: number }>(orgId, paginationKey, { pageSize }).catch(() => { });
  }, [orgId, storageKey, pageSize, hydratedPagination]);

  return { columnVisibility, setColumnVisibility, pageSize, setPageSize } as const;
}
