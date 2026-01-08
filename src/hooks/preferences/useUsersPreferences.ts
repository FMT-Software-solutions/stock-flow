import { useState, useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { UserDisplayMode, UserFilters, UserSortField, SortOrder } from '@/types/user-management';
import { getOrgKV, setOrgKV } from '@/lib/dexie';

export function useUsersPreferences() {
  const { currentOrganization } = useOrganization();
  const [displayMode, setDisplayMode] = useState<UserDisplayMode>('table');
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<UserSortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<UserFilters>({
    status: 'all',
    role: undefined,
  });

  useEffect(() => {
    if (currentOrganization?.id) {
      const orgId = currentOrganization.id;
      getOrgKV<UserDisplayMode>(orgId, 'users.displayMode').then((dm) => {
        if (dm) setDisplayMode(dm);
        else setOrgKV<UserDisplayMode>(orgId, 'users.displayMode', 'table').catch(() => {});
      });
      getOrgKV<number>(orgId, 'users.pageSize').then((ps) => {
        if (typeof ps === 'number') setPageSize(ps);
        else setOrgKV<number>(orgId, 'users.pageSize', 10).catch(() => {});
      });
      getOrgKV<UserSortField>(orgId, 'users.sortBy').then((sb) => {
        if (sb) setSortBy(sb);
        else setOrgKV<UserSortField>(orgId, 'users.sortBy', 'created_at').catch(() => {});
      });
      getOrgKV<SortOrder>(orgId, 'users.sortOrder').then((so) => {
        if (so) setSortOrder(so);
        else setOrgKV<SortOrder>(orgId, 'users.sortOrder', 'desc').catch(() => {});
      });
      getOrgKV<number>(orgId, 'users.currentPage').then((cp) => {
        if (typeof cp === 'number') setCurrentPage(cp);
        else setOrgKV<number>(orgId, 'users.currentPage', 1).catch(() => {});
      });
      getOrgKV<UserFilters>(orgId, 'users.filters').then((f) => {
        if (f) setFilters(f);
        else setOrgKV<UserFilters>(orgId, 'users.filters', { status: 'all', role: undefined }).catch(() => {});
      });
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (currentOrganization?.id) {
      setOrgKV<UserDisplayMode>(currentOrganization.id, 'users.displayMode', displayMode).catch(() => {});
    }
  }, [displayMode, currentOrganization?.id]);

  useEffect(() => {
    if (currentOrganization?.id) {
      setOrgKV<number>(currentOrganization.id, 'users.pageSize', pageSize).catch(() => {});
    }
  }, [pageSize, currentOrganization?.id]);

  useEffect(() => {
    if (currentOrganization?.id) {
      setOrgKV<UserSortField>(currentOrganization.id, 'users.sortBy', sortBy).catch(() => {});
    }
  }, [sortBy, currentOrganization?.id]);

  useEffect(() => {
    if (currentOrganization?.id) {
      setOrgKV<SortOrder>(currentOrganization.id, 'users.sortOrder', sortOrder).catch(() => {});
    }
  }, [sortOrder, currentOrganization?.id]);

  useEffect(() => {
    if (currentOrganization?.id) {
      setOrgKV<number>(currentOrganization.id, 'users.currentPage', currentPage).catch(() => {});
    }
  }, [currentPage, currentOrganization?.id]);

  useEffect(() => {
    if (currentOrganization?.id) {
      setOrgKV<UserFilters>(currentOrganization.id, 'users.filters', filters).catch(() => {});
    }
  }, [filters, currentOrganization?.id]);

  const updateFilters = (newFilters: Partial<UserFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setFilters({
      status: 'all',
      role: undefined,
    });
    setCurrentPage(1);
  };

  return {
    displayMode,
    setDisplayMode,
    pageSize,
    setPageSize,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    currentPage,
    setCurrentPage,
    filters,
    setFilters,
    updateFilters,
    resetFilters,
  };
}
