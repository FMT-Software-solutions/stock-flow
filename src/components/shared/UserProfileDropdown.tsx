import {
  Check,
  Download,
  HelpCircle,
  Layout,
  LayoutGrid,
  Layers,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Palette,
  PanelLeft,
  PanelTop,
  Settings,
  Sun,
  User,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUpdateStore } from '../../modules/auto-update/stores/updateStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { UpdateDrawer } from '../../modules/auto-update/UpdateDrawer';
import { isElectron, processAvatarUrl } from '../../utils/asset-path';
import { openExternalUrl } from '../../utils/external-url';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { HelpDrawer } from './HelpDrawer';

export function UserProfileDropdown() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { hasUpdate } = useUpdateStore();
  const { layoutMode, setLayoutMode } = useLayoutStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUpdateDrawerOpen, setIsUpdateDrawerOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleProfileClick = () => {
    navigate('/profile');
    setIsDropdownOpen(false);
  };

  const handleSettingsClick = () => {
    navigate('/settings');
    setIsDropdownOpen(false);
  };

  const handleCheckForUpdates = () => {
    setIsUpdateDrawerOpen(true);
    setIsDropdownOpen(false);
  };

  const handleContactFMT = () => {
    openExternalUrl('https://fmtsoftware.com/contact');
    setIsDropdownOpen(false);
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
  };

  if (!user?.profile) {
    return null;
  }

  const { profile } = user;
  const displayName = `${profile.first_name || ''} ${
    profile.last_name || ''
  }`.trim();
  const fallbackText =
    profile.first_name && profile.last_name
      ? `${profile.first_name[0]}${profile.last_name[0]}`
      : 'U';

  return (
    <div>
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-10 w-10 rounded-full p-0 hover:bg-accent"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={processAvatarUrl(profile.avatar)}
                alt={displayName}
              />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {fallbackText}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60" align="end" forceMount>
          {/* User Info Header - Chrome Style */}
          <div className="p-4 bg-muted/30">
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarImage
                  src={processAvatarUrl(profile.avatar)}
                  alt={displayName}
                />
                <AvatarFallback className="bg-primary/10 text-primary font-medium text-lg">
                  {fallbackText}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-none truncate">
                  {displayName || 'User'}
                </p>
                <p className="text-xs leading-none text-muted-foreground mt-1 truncate">
                  {profile.email}
                </p>
              </div>
            </div>
          </div>

          <DropdownMenuSeparator />

          {/* Profile */}
          <DropdownMenuItem
            onClick={handleProfileClick}
            className="cursor-pointer"
          >
            <User className="mr-3 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>

          {/* Theme Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <Palette className="mr-3 h-4 w-4" />
              <span className="ml-2">Theme</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onClick={() => handleThemeChange('light')}
                className="cursor-pointer"
              >
                <Sun className="mr-2 h-4 w-4" />
                <span>Light</span>
                {theme === 'light' && (
                  <Check className="ml-auto h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleThemeChange('dark')}
                className="cursor-pointer"
              >
                <Moon className="mr-2 h-4 w-4" />
                <span>Dark</span>
                {theme === 'dark' && (
                  <Check className="ml-auto h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleThemeChange('system')}
                className="cursor-pointer"
              >
                <Monitor className="mr-2 h-4 w-4" />
                <span>System</span>
                {theme === 'system' && (
                  <Check className="ml-auto h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Layout Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <Layout className="mr-3 h-4 w-4" />
              <span className="ml-2">Layout</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onClick={() => setLayoutMode('sidebar')}
                className="cursor-pointer"
              >
                <PanelLeft className="mr-2 h-4 w-4" />
                <span>Modern Sidebar</span>
                {layoutMode === 'sidebar' && (
                  <Check className="ml-auto h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLayoutMode('topnav')}
                className="cursor-pointer"
              >
                <PanelTop className="mr-2 h-4 w-4" />
                <span>Top Navigation</span>
                {layoutMode === 'topnav' && (
                  <Check className="ml-auto h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLayoutMode('stacked')}
                className="cursor-pointer"
              >
                <Layers className="mr-2 h-4 w-4" />
                <span>Classic Layout</span>
                {layoutMode === 'stacked' && (
                  <Check className="ml-auto h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLayoutMode('grid')}
                className="cursor-pointer"
              >
                <LayoutGrid className="mr-2 h-4 w-4" />
                <span>Grid Layout</span>
                {layoutMode === 'grid' && (
                  <Check className="ml-auto h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem
            onClick={handleSettingsClick}
            className="cursor-pointer"
          >
            <Settings className="mr-3 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>

          {isElectron() && (
            <DropdownMenuItem
              onClick={handleCheckForUpdates}
              className="cursor-pointer"
            >
              <Download className="mr-3 h-4 w-4" />
              <span>Check for Updates</span>
              {hasUpdate && (
                <div className="ml-auto h-2 w-2 rounded-full bg-green-500" />
              )}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Help */}
          <HelpDrawer>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={(e) => e.preventDefault()}
            >
              <HelpCircle className="mr-3 h-4 w-4" />
              <span>Help</span>
            </DropdownMenuItem>
          </HelpDrawer>

          {/* Contact FMT */}
          <DropdownMenuItem
            onClick={handleContactFMT}
            className="cursor-pointer"
          >
            <Mail className="mr-3 h-4 w-4" />
            <span>Contact FMT</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Logout */}
          <DropdownMenuItem
            onClick={handleSignOut}
            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
          >
            <LogOut className="mr-3 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isElectron() && (
        <UpdateDrawer
          isOpen={isUpdateDrawerOpen}
          onOpenChange={setIsUpdateDrawerOpen}
        >
          {null}
        </UpdateDrawer>
      )}
    </div>
  );
}
