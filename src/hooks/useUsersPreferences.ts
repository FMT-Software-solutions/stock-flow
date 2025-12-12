import { useState, useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { UserDisplayMode, UserFilters, UserSortField, SortOrder } from '@/types/user-management';

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

  // Load preferences when organization changes
  useEffect(() => {
    if (currentOrganization?.id) {
      const savedDisplayMode = localStorage.getItem(`users-display-mode-${currentOrganization.id}`);
      const savedPageSize = localStorage.getItem(`users-page-size-${currentOrganization.id}`);
      const savedSortBy = localStorage.getItem(`users-sort-by-${currentOrganization.id}`);
      const savedSortOrder = localStorage.getItem(`users-sort-order-${currentOrganization.id}`);
      const savedCurrentPage = localStorage.getItem(`users-current-page-${currentOrganization.id}`);
      const savedFilters = localStorage.getItem(`users-filters-${currentOrganization.id}`);
      
      if (savedDisplayMode) {
        setDisplayMode(savedDisplayMode as UserDisplayMode);
      }
      if (savedPageSize) {
        setPageSize(parseInt(savedPageSize, 10));
      }
      if (savedSortBy) {
        setSortBy(savedSortBy as UserSortField);
      }
      if (savedSortOrder) {
        setSortOrder(savedSortOrder as SortOrder);
      }
      if (savedCurrentPage) {
        setCurrentPage(parseInt(savedCurrentPage, 10));
      }
      if (savedFilters) {
        try {
          const parsedFilters = JSON.parse(savedFilters);
          setFilters(parsedFilters);
        } catch (error) {
          console.error('Error parsing saved user filters:', error);
        }
      }
    }
  }, [currentOrganization?.id]);

  // Save display mode when it changes
  useEffect(() => {
    if (currentOrganization?.id) {
      localStorage.setItem(`users-display-mode-${currentOrganization.id}`, displayMode);
    }
  }, [displayMode, currentOrganization?.id]);

  // Save page size when it changes
  useEffect(() => {
    if (currentOrganization?.id) {
      localStorage.setItem(`users-page-size-${currentOrganization.id}`, pageSize.toString());
    }
  }, [pageSize, currentOrganization?.id]);

  // Save sort preferences when they change
  useEffect(() => {
    if (currentOrganization?.id) {
      localStorage.setItem(`users-sort-by-${currentOrganization.id}`, sortBy || '');
    }
  }, [sortBy, currentOrganization?.id]);

  useEffect(() => {
    if (currentOrganization?.id) {
      localStorage.setItem(`users-sort-order-${currentOrganization.id}`, sortOrder || '');
    }
  }, [sortOrder, currentOrganization?.id]);

  // Save current page when it changes
  useEffect(() => {
    if (currentOrganization?.id) {
      localStorage.setItem(`users-current-page-${currentOrganization.id}`, currentPage.toString());
    }
  }, [currentPage, currentOrganization?.id]);

  // Save filters when they change
  useEffect(() => {
    if (currentOrganization?.id) {
      localStorage.setItem(`users-filters-${currentOrganization.id}`, JSON.stringify(filters));
    }
  }, [filters, currentOrganization?.id]);

  const updateFilters = (newFilters: Partial<UserFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1); // Reset to first page when filters change
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