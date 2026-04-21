import { OrganizationSelector } from '../shared/OrganizationSelector';
import { BranchSelector } from '../shared/BranchSelector';
import { UserProfileDropdown } from '../shared/UserProfileDropdown';
import { RestartToUpdateButton } from '../../modules/auto-update/RestartToUpdateButton';
// import { AiUsageIndicator } from '../shared/AiUsageIndicator';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { useSearchStore } from '@/stores/searchStore';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const { setIsOpen: setSearchOpen } = useSearchStore();

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 h-16 bg-background border-b border-border z-50',
        className
      )}
    >
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center space-x-4">
          <OrganizationSelector />
          <div className="h-6 w-px bg-border hidden md:block" />
          <BranchSelector />
        </div>

        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Search className="h-5 w-5" />
          </Button>

          <div className="hidden md:flex items-center space-x-4">
            {/* <AiUsageIndicator /> */}
            <RestartToUpdateButton />
          </div>

          <UserProfileDropdown />
        </div>
      </div>
    </header>
  );
}
