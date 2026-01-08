import { useState, useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getOrgKV, setOrgKV } from '@/lib/dexie';

export type DisplayMode = 'grid' | 'table';

export function useBranchesPreferences() {
  const { currentOrganization } = useOrganization();
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grid');
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (currentOrganization?.id) {
      const orgId = currentOrganization.id;
      getOrgKV<DisplayMode>(orgId, 'branches.displayMode').then((dm) => {
        if (dm) setDisplayMode(dm);
        else setOrgKV<DisplayMode>(orgId, 'branches.displayMode', 'grid').catch(() => { });
      });
      getOrgKV<number>(orgId, 'branches.pageSize').then((ps) => {
        if (typeof ps === 'number') setPageSize(ps);
        else setOrgKV<number>(orgId, 'branches.pageSize', 10).catch(() => { });
      });
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (currentOrganization?.id) {
      setOrgKV<DisplayMode>(currentOrganization.id, 'branches.displayMode', displayMode).catch(() => { });
    }
  }, [displayMode, currentOrganization?.id]);

  useEffect(() => {
    if (currentOrganization?.id) {
      setOrgKV<number>(currentOrganization.id, 'branches.pageSize', pageSize).catch(() => { });
    }
  }, [pageSize, currentOrganization?.id]);

  return {
    displayMode,
    setDisplayMode,
    pageSize,
    setPageSize
  };
}
