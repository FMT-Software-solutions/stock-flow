import { useRoleCheck } from '@/components/auth/RoleGuard';
import { useDebounce } from '@/hooks/useDebounce';
import { hexToOklch, oklchToHex } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePalette } from '../../contexts/PaletteContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export function ThemeSelector() {
  const { resolvedTheme } = useTheme();
  const {
    applySelectedTheme,
    selectedThemeKey,
    selectedTheme,
    allThemes,
    updateThemeColor,
    resetToOrganizationTheme,
  } = usePalette();
  const {
    updateOrganization,
    selectedOrgId,
    currentOrganization,
  } = useOrganization();
  const { checkPermission } = useRoleCheck();
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);

  const canManageAppearance = checkPermission(
    'settings',
    'manage_org_appearance_prefs'
  );

  const handleThemeSelect = async (themeKey: string) => {
    applySelectedTheme(themeKey);
  };

  const saveSelectedTheme = async () => {
    if (!canManageAppearance) {
      toast.error('You do not have permission to save organization themes');
      return;
    }

    setIsSavingTheme(true);
    setThemeError(null);

    try {
      await updateOrganization({
        id: selectedOrgId || '',
        brand_colors: selectedTheme,
      });

      // Show success message
      toast.success('Theme saved successfully!');
    } catch (error) {
      console.error('Error applying colors:', error);
      setThemeError('Failed to apply theme. Please try again.');
      toast.error('Failed to apply theme. Please try again.');
    } finally {
      setIsSavingTheme(false);
    }
  };

  // Debounced color change handler
  const { debouncedCallback: debouncedColorChange } = useDebounce(
    (colorKey: string, value: string, mode: 'light' | 'dark') => {
      if (value && /^#[0-9A-F]{6}$/i.test(value)) {
        updateThemeColor(colorKey, hexToOklch(value), mode);
      }
    },
    500
  );

  const handleCustomColorChange = useCallback(
    (colorKey: string, value: string, mode: 'light' | 'dark') => {
      // Validate hex color format
      if (!/^#[0-9A-F]{6}$/i.test(value)) {
        return;
      }

      debouncedColorChange(colorKey, value, mode);
    },
    [debouncedColorChange]
  );

  return (
    <div className="space-y-2">
      <Label className="text-base font-medium">Theme Selector</Label>
      <Select value={selectedThemeKey || ''} onValueChange={handleThemeSelect}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a theme">
            {selectedTheme && (
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1">
                  <div
                    className="w-4 h-4 rounded border border-border"
                    style={{
                      backgroundColor:
                        resolvedTheme === 'light'
                          ? selectedTheme.light.primary
                          : selectedTheme.dark.primary,
                    }}
                  />
                  <div
                    className="w-4 h-4 rounded border border-border"
                    style={{
                      backgroundColor:
                        resolvedTheme === 'light'
                          ? selectedTheme.light.secondary
                          : selectedTheme.dark.secondary,
                    }}
                  />
                  <div
                    className="w-4 h-4 rounded border border-border"
                    style={{
                      backgroundColor:
                        resolvedTheme === 'light'
                          ? selectedTheme.light.accent
                          : selectedTheme.dark.accent,
                    }}
                  />
                </div>
                <span>{selectedTheme.name}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(allThemes).map(([key, theme]) => (
            <SelectItem key={key} value={key}>
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1">
                  <div
                    className="w-4 h-4 rounded border border-border"
                    style={{ backgroundColor: theme.light.primary }}
                  />
                  <div
                    className="w-4 h-4 rounded border border-border"
                    style={{ backgroundColor: theme.light.secondary }}
                  />
                  <div
                    className="w-4 h-4 rounded border border-border"
                    style={{ backgroundColor: theme.light.accent }}
                  />
                  <div
                    className="w-4 h-4 rounded border border-border"
                    style={{ backgroundColor: theme.light.card }}
                  />
                  <div
                    className="w-4 h-4 rounded border border-border"
                    style={{ backgroundColor: theme.light.muted }}
                  />
                </div>
                <span>{theme.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mt-4">
        <Label className="text-base font-medium">Customize Colors</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-3">
          <div>
            <h4 className="font-medium mb-3">Light Mode</h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Label htmlFor="lightPrimary" className="w-20">
                  Primary
                </Label>
                <Input
                  id="lightPrimary"
                  type="color"
                  value={oklchToHex(selectedTheme?.light.primary || '')}
                  onChange={(e) =>
                    handleCustomColorChange('primary', e.target.value, 'light')
                  }
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={oklchToHex(selectedTheme?.light.primary || '')}
                  onChange={(e) =>
                    handleCustomColorChange('primary', e.target.value, 'light')
                  }
                  className="flex-1"
                  placeholder="#3b82f6"
                />
              </div>
              <div className="flex items-center space-x-3">
                <Label htmlFor="lightSecondary" className="w-20">
                  Secondary
                </Label>
                <Input
                  id="lightSecondary"
                  type="color"
                  value={oklchToHex(selectedTheme?.light.secondary || '')}
                  onChange={(e) =>
                    handleCustomColorChange(
                      'secondary',
                      e.target.value,
                      'light'
                    )
                  }
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={oklchToHex(selectedTheme?.light.secondary || '')}
                  onChange={(e) =>
                    handleCustomColorChange(
                      'secondary',
                      e.target.value,
                      'light'
                    )
                  }
                  className="flex-1"
                  placeholder="#f1f5f9"
                />
              </div>
              <div className="flex items-center space-x-3">
                <Label htmlFor="lightAccent" className="w-20">
                  Accent
                </Label>
                <Input
                  id="lightAccent"
                  type="color"
                  value={oklchToHex(selectedTheme?.light.accent || '')}
                  onChange={(e) =>
                    handleCustomColorChange('accent', e.target.value, 'light')
                  }
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={oklchToHex(selectedTheme?.light.accent || '')}
                  onChange={(e) =>
                    handleCustomColorChange('accent', e.target.value, 'light')
                  }
                  className="flex-1"
                  placeholder="#10b981"
                />
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-3">Dark Mode</h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Label htmlFor="darkPrimary" className="w-20">
                  Primary
                </Label>
                <Input
                  id="darkPrimary"
                  type="color"
                  value={oklchToHex(selectedTheme?.dark.primary || '')}
                  onChange={(e) =>
                    handleCustomColorChange('primary', e.target.value, 'dark')
                  }
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={oklchToHex(selectedTheme?.dark.primary || '')}
                  onChange={(e) =>
                    handleCustomColorChange('primary', e.target.value, 'dark')
                  }
                  className="flex-1"
                  placeholder="#3b82f6"
                />
              </div>
              <div className="flex items-center space-x-3">
                <Label htmlFor="darkSecondary" className="w-20">
                  Secondary
                </Label>
                <Input
                  id="darkSecondary"
                  type="color"
                  value={oklchToHex(selectedTheme?.dark.secondary || '')}
                  onChange={(e) =>
                    handleCustomColorChange('secondary', e.target.value, 'dark')
                  }
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={oklchToHex(selectedTheme?.dark.secondary || '')}
                  onChange={(e) =>
                    handleCustomColorChange('secondary', e.target.value, 'dark')
                  }
                  className="flex-1"
                  placeholder="#1e293b"
                />
              </div>
              <div className="flex items-center space-x-3">
                <Label htmlFor="darkAccent" className="w-20">
                  Accent
                </Label>
                <Input
                  id="darkAccent"
                  type="color"
                  value={oklchToHex(selectedTheme?.dark.accent || '')}
                  onChange={(e) =>
                    handleCustomColorChange('accent', e.target.value, 'dark')
                  }
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={oklchToHex(selectedTheme?.dark.accent || '')}
                  onChange={(e) =>
                    handleCustomColorChange('accent', e.target.value, 'dark')
                  }
                  className="flex-1"
                  placeholder="#06b6d4"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center">
          {/* Reset button - show when theme is custom or different from org theme */}
          {(selectedThemeKey === 'custom' ||
            (currentOrganization?.brand_colors &&
              selectedThemeKey !== currentOrganization.brand_colors.id)) && (
            <Button
              variant="outline"
              onClick={resetToOrganizationTheme}
              className="mt-4"
            >
              Reset to Organization Theme
            </Button>
          )}
          <div className="flex-1" />
          {canManageAppearance ? (
            <Button
              onClick={saveSelectedTheme}
              disabled={isSavingTheme}
              className="mt-4"
            >
              {isSavingTheme ? 'Saving...' : 'Save Theme'}
            </Button>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground italic"></div>
          )}
        </div>
        {themeError && (
          <p className="text-sm text-destructive mt-2">{themeError}</p>
        )}
      </div>
    </div>
  );
}
