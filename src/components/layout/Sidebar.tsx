import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { navItems } from '@/config/navigation';

import { TrialStatus } from '../shared/TrialStatus';

interface SidebarProps {
  className?: string;
  fullHeight?: boolean;
}

export function Sidebar({ className, fullHeight = false }: SidebarProps) {
  const isDev = import.meta.env.DEV;
  const { checkPermission } = useRoleCheck();

  const filteredNavItems = navItems.filter((item) => {
    // 1. Check devOnly
    if (item.devOnly && !isDev) return false;

    // 2. Check permissions if defined
    if (item.permission) {
      return checkPermission(item.permission.scope, item.permission.action);
    }

    return true;
  });

  const { signOut } = useAuth();
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const { isCollapsed, toggleCollapse } = useSidebar();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        'fixed left-0 bg-background border-r border-border z-40 transition-all duration-300 ease-in-out',
        fullHeight ? 'top-0 bottom-0 z-60' : 'top-16 bottom-0',
        isCollapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      <div className="flex flex-col justify-between h-full">
        {/* Collapse Toggle Button */}
        <div className="p-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={toggleCollapse}
                  variant="ghost"
                  size="icon"
                  className="w-full h-10 rounded-lg"
                >
                  {isCollapsed ? (
                    <PanelLeftOpen className="h-5 w-5" />
                  ) : (
                    <PanelLeftClose className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <nav className="px-2 flex-1 overflow-y-auto">
          <ul className="space-y-2">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              if (isCollapsed) {
                const isActive =
                  location.pathname === item.to ||
                  location.pathname.startsWith(item.to + '/');

                return (
                  <li key={item.to}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => navigate(item.to)}
                            className={cn(
                              'flex items-center justify-center w-full h-10 rounded-lg text-sm font-medium transition-colors',
                              isActive
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{item.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </li>
                );
              }

              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )
                    }
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                    {item.devOnly && (
                      <span className="ml-auto text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded">
                        DEV
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-2 border-t border-border">
          {!isCollapsed && currentOrganization && (
            <div className="mb-2 flex justify-center">
              <TrialStatus
                trialEndDate={currentOrganization.trial_end_date}
                hasPurchased={currentOrganization.has_purchased}
              />
            </div>
          )}
          {isCollapsed ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleSignOut}
                    className="w-full h-10 text-red-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                    variant="ghost"
                    size="icon"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Sign Out</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              onClick={handleSignOut}
              className="w-full text-red-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
              variant="ghost"
            >
              <LogOut className="mr-1 h-4 w-4" />
              Sign Out
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
