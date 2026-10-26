import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X, SortAsc, SortDesc } from 'lucide-react';
import type {
  UserFilters,
  UserSortField,
  SortOrder,
} from '@/types/user-management';
import { USER_SORT_OPTIONS } from '@/types/user-management';
import type { UserRole } from '@/lib/auth';

interface UserFiltersControlsProps {
  filters: UserFilters;
  sortBy: UserSortField;
  sortOrder: SortOrder;
  onFiltersChange: (filters: Partial<UserFilters>) => void;
  onSortChange: (sortBy: UserSortField, sortOrder: SortOrder) => void;
  onResetFilters: () => void;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'branch_admin', label: 'Branch Admin' },
  { value: 'write', label: 'Editor' },
  { value: 'read', label: 'Viewer' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Users' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

export function UserFiltersControls({
  filters,
  sortBy,
  sortOrder,
  onFiltersChange,
  onSortChange,
  onResetFilters,
}: UserFiltersControlsProps) {
  const hasActiveFilters =
    filters.status !== 'all' || filters.role !== undefined;

  const handleSortToggle = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    onSortChange(sortBy, newOrder);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
          value={filters.status}
          onValueChange={(value) =>
            onFiltersChange({ status: value as 'all' | 'active' | 'inactive' })
          }
        >
          <SelectTrigger className="h-8 w-32" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

      <Select
          value={filters.role || 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              role: value === 'all' ? undefined : (value as UserRole),
            })
          }
        >
          <SelectTrigger className="h-8 w-36" aria-label="Role">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

      <div className="flex items-center gap-1">
        <Select
          value={sortBy}
          onValueChange={(value) =>
            onSortChange(value as UserSortField, sortOrder)
          }
        >
          <SelectTrigger className="h-8 w-36" aria-label="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USER_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSortToggle}
          className="h-8 w-8 p-0"
          aria-label={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortOrder === 'asc' ? (
            <SortAsc className="h-4 w-4" />
          ) : (
            <SortDesc className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Reset Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetFilters}
          className="h-8 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Reset
        </Button>
      )}
    </div>
  );
}
