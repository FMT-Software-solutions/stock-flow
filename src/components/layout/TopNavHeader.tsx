import { Link, useLocation } from 'react-router-dom';
import { OrganizationSelector } from '../shared/OrganizationSelector';
import { BranchSelector } from '../shared/BranchSelector';
import { UserProfileDropdown } from '../shared/UserProfileDropdown';
import { RestartToUpdateButton } from '../../modules/auto-update/RestartToUpdateButton';
import { cn } from '@/lib/utils';
import { navItems } from '@/config/navigation';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { useState } from 'react';

interface TopNavHeaderProps {
  className?: string;
}

export function TopNavHeader({ className }: TopNavHeaderProps) {
  const isDev = import.meta.env.DEV;
  const { checkPermission } = useRoleCheck();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const filteredNavItems = navItems.filter((item) => {
    if (item.devOnly && !isDev) return false;
    if (item.permission) {
      return checkPermission(item.permission.scope, item.permission.action);
    }
    return true;
  });

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 h-16 bg-background border-b border-border z-50',
        className
      )}
    >
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center space-x-4 md:space-x-8">
          {/* Mobile Menu Trigger */}
          <div className="md:hidden">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col space-y-2 mt-4">
                  {filteredNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      location.pathname === item.to ||
                      location.pathname.startsWith(item.to + '/');
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          'flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex items-center space-x-4">
            <OrganizationSelector />
            <div className="h-6 w-px bg-border hidden md:block" />
            <BranchSelector />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.to ||
                location.pathname.startsWith(item.to + '/');
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <RestartToUpdateButton />
          <UserProfileDropdown />
        </div>
      </div>
    </header>
  );
}
