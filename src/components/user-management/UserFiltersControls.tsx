import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    <div className="flex flex-wrap items-center gap-3">
      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Status:
        </span>
        <Select
          value={filters.status}
          onValueChange={(value) =>
            onFiltersChange({ status: value as 'all' | 'active' | 'inactive' })
          }
        >
          <SelectTrigger className="w-32">
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
      </div>

      {/* Role Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Role:</span>
        <Select
          value={filters.role || 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              role: value === 'all' ? undefined : (value as UserRole),
            })
          }
        >
          <SelectTrigger className="w-36">
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
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Sort by:
        </span>
        <Select
          value={sortBy}
          onValueChange={(value) =>
            onSortChange(value as UserSortField, sortOrder)
          }
        >
          <SelectTrigger className="w-36">
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
          className="px-2"
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
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Clear Filters
        </Button>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1 ml-2">
          {filters.status !== 'all' && (
            <Badge variant="secondary" className="text-xs">
              Status:{' '}
              {STATUS_OPTIONS.find((s) => s.value === filters.status)?.label}
            </Badge>
          )}
          {filters.role && (
            <Badge variant="secondary" className="text-xs">
              Role: {ROLE_OPTIONS.find((r) => r.value === filters.role)?.label}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
