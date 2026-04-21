import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { OrganizationSelector } from '../shared/OrganizationSelector';
import { BranchSelector } from '../shared/BranchSelector';
import { UserProfileDropdown } from '../shared/UserProfileDropdown';
import { RestartToUpdateButton } from '../../modules/auto-update/RestartToUpdateButton';
import { AiUsageIndicator } from '../shared/AiUsageIndicator';
import { Button } from '@/components/ui/button';
import { Grid, ArrowLeft, Search } from 'lucide-react';
import { GridLauncher } from './GridLauncher';
import { useSearchStore } from '@/stores/searchStore';

export function GridLayout() {
  const [showLauncher, setShowLauncher] = useState(false);
  const { setIsOpen: setSearchOpen } = useSearchStore();

  const handleBackToMenu = () => {
    setShowLauncher(true);
  };

  const handleLauncherItemClick = () => {
    setShowLauncher(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!showLauncher ? (
              <Button
                variant="ghost"
                onClick={handleBackToMenu}
                className="flex items-center gap-2 font-medium hover:bg-primary/10 hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Menu
              </Button>
            ) : (
              <div className="flex items-center gap-2 font-semibold text-lg">
                <Grid className="h-5 w-5 text-primary" />
                <span>Application Menu</span>
              </div>
            )}
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
              <OrganizationSelector />
              <div className="h-6 w-px bg-border" />
              <BranchSelector />
            </div>
            <AiUsageIndicator />
            <RestartToUpdateButton />
            <UserProfileDropdown />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative">
        {showLauncher ? (
          <div className="absolute inset-0 bg-background z-40 overflow-y-auto">
            <GridLauncher onItemClick={handleLauncherItemClick} />
          </div>
        ) : (
          <div className="container mx-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}
