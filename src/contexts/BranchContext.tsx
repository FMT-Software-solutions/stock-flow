import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import type { ReactNode } from 'react';
import { useOrganization } from './OrganizationContext';
import { useAuth } from './AuthContext';
import { useBranches, useUserBranches } from '../hooks/useBranchQueries';
import type { Branch } from '../types/branches';

interface BranchContextType {
  // Data
  allBranches: Branch[];
  userBranches: Branch[];
  availableBranches: Branch[]; // Branches the user can actually select (All for owner, Assigned for user)

  // Selection
  selectedBranchIds: string[];
  selectBranch: (branchId: string) => void; // Toggle selection
  selectSingleBranch: (branchId: string) => void; // Select only this branch
  selectAllBranches: () => void; // For owners
  deselectBranch: (branchId: string) => void;

  // State
  isLoading: boolean;
  isOwner: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'fmt-selected-branches-';

export function BranchProvider({ children }: { children: ReactNode }) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();

  const organizationId = currentOrganization?.id;
  const userId = user?.id;

  // Fetch all branches for the organization
  const {
    data: allBranches = [],
    isLoading: isLoadingAllBranches,
  } = useBranches(organizationId);

  const {
    data: assignedUserBranchesData = [],
    isLoading: isLoadingUserBranches,
  } = useUserBranches(userId, organizationId);

  const orgBranchIds = currentOrganization?.branch_ids || [];
  const assignedBranches =
    orgBranchIds.length > 0
      ? allBranches.filter((b) => orgBranchIds.includes(b.id))
      : assignedUserBranchesData.map((ub) => ub.branch).filter((b): b is Branch => !!b);

  // Determine if user is owner (checking role in current organization)
  const isOwner = currentOrganization?.user_role === 'owner';

  // Determine available branches based on role
  const availableBranches = isOwner ? allBranches : assignedBranches;

  // State for selected branch IDs
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);

  // Initialize selection
  useEffect(() => {
    if (!organizationId || isLoadingAllBranches || isLoadingUserBranches)
      return;

    // Load from local storage or set defaults
    const storageKey = `${STORAGE_KEY_PREFIX}${organizationId}-${userId}`;
    const savedSelection = localStorage.getItem(storageKey);

    if (savedSelection) {
      try {
        const parsedIds = JSON.parse(savedSelection);
        // Verify that saved IDs are still valid (exist in available branches)
        const validIds = parsedIds.filter((id: string) =>
          availableBranches.some((b) => b.id === id)
        );

        if (validIds.length > 0) {
          setSelectedBranchIds(validIds);
          return;
        }
      } catch (e) {
        console.error('Failed to parse saved branch selection', e);
      }
    }

    // Default selection logic if no saved selection or invalid
    if (availableBranches.length > 0) {
      if (isOwner) {
        // Owner: Select all by default
        setSelectedBranchIds(availableBranches.map((b) => b.id));
      } else {
        // User: Select first assigned branch
        setSelectedBranchIds([availableBranches[0].id]);
      }
    } else {
      setSelectedBranchIds([]);
    }
  }, [
    organizationId,
    userId,
    isLoadingAllBranches,
    isLoadingUserBranches,
    isOwner,
    JSON.stringify(availableBranches.map((b) => b.id)),
  ]);

  // Persist selection
  useEffect(() => {
    if (organizationId && userId && selectedBranchIds.length > 0) {
      const storageKey = `${STORAGE_KEY_PREFIX}${organizationId}-${userId}`;
      localStorage.setItem(storageKey, JSON.stringify(selectedBranchIds));
    }
  }, [selectedBranchIds, organizationId, userId]);

  const selectBranch = useCallback((branchId: string) => {
    setSelectedBranchIds((prev) => {
      // Check if already selected
      if (prev.includes(branchId)) {
        // Prevent deselecting the last branch
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== branchId);
      } else {
        // Add to selection
        return [...prev, branchId];
      }
    });
  }, []);

  const selectSingleBranch = useCallback((branchId: string) => {
    setSelectedBranchIds([branchId]);
  }, []);

  const deselectBranch = useCallback((branchId: string) => {
    setSelectedBranchIds((prev) => {
      if (prev.length <= 1) return prev; // Cannot deselect last one
      return prev.filter((id) => id !== branchId);
    });
  }, []);

  const selectAllBranches = useCallback(() => {
    if (isOwner) {
      setSelectedBranchIds(availableBranches.map((b) => b.id));
    }
  }, [isOwner, availableBranches]);

  const value = {
    allBranches,
    userBranches: assignedBranches,
    availableBranches,
    selectedBranchIds,
    selectBranch,
    selectSingleBranch,
    selectAllBranches,
    deselectBranch,
    isLoading: isLoadingAllBranches || isLoadingUserBranches,
    isOwner,
  };

  return (
    <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
  );
}

export function useBranchContext() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranchContext must be used within a BranchProvider');
  }
  return context;
}
