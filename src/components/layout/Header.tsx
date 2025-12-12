import { OrganizationSelector } from '../shared/OrganizationSelector';
import { BranchSelector } from '../shared/BranchSelector';
import { UserProfileDropdown } from '../shared/UserProfileDropdown';
import { RestartToUpdateButton } from '../../modules/auto-update/RestartToUpdateButton';

export function Header() {

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-background border-b border-border z-50">
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center space-x-4">
          <OrganizationSelector />
          <div className="h-6 w-px bg-border hidden md:block" />
          <BranchSelector />
        </div>

        <div className="flex items-center space-x-4">
          <RestartToUpdateButton />
        </div>

        <div className="flex items-center space-x-4">
          <UserProfileDropdown />
        </div>
      </div>
    </header>
  );
}
