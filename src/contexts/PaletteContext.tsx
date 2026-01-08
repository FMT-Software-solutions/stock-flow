import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CompleteTheme } from '@/types/theme';
import { useOrganization } from './OrganizationContext';
import { PREDEFINED_PALETTES } from '@/data/predefined-palettes';
import { themeMap } from '@/themes';
import { applyTheme, batchUpdateThemeProperties } from '@/utils/theme-util';
import { getOrgTheme, setOrgTheme } from '@/lib/dexie';

export interface PaletteContextType {
  selectedTheme: CompleteTheme | null;
  selectedThemeKey: string;
  applySelectedTheme: (themeKey: string) => void;
  updateThemeColor: (
    colorKey: string,
    value: string,
    mode: 'light' | 'dark'
  ) => void;
  resetToOrganizationTheme: () => void;
  allThemes: Record<string, CompleteTheme>;
}

const PaletteContext = createContext<PaletteContextType | undefined>(undefined);

interface PaletteProviderProps {
  children: ReactNode;
}

export function PaletteProvider({ children }: PaletteProviderProps) {
  const { selectedOrgId, currentOrganization } = useOrganization();
  const [selectedTheme, setSelectedTheme] = useState<CompleteTheme | null>(
    null
  );
  const [selectedThemeKey, setSelectedThemeKey] = useState<string>('');

  // Combine predefined palettes with themes from themes folder
  const allThemes = useMemo(() => {
    const combined: Record<string, CompleteTheme> = { ...PREDEFINED_PALETTES };

    // Add themes from themes folder
    themeMap.forEach((theme, key) => {
      combined[key] = theme;
    });

    return combined;
  }, []);

  useEffect(() => {
    const loadTheme = () => {
      if (selectedOrgId || currentOrganization) {
        if (selectedOrgId) {
          getOrgTheme(selectedOrgId).then((row) => {
            if (row) {
              setSelectedTheme(row.selectedTheme);
              setSelectedThemeKey(row.selectedThemeKey);
              applyTheme(row.selectedTheme);
              return;
            }
            if (currentOrganization?.brand_colors) {
              setSelectedTheme(currentOrganization.brand_colors);
              setSelectedThemeKey(currentOrganization.brand_colors.id);
              applyTheme(currentOrganization.brand_colors);
              setOrgTheme(
                selectedOrgId,
                currentOrganization.brand_colors.id,
                currentOrganization.brand_colors
              );
              return;
            }
            const defaultTheme = PREDEFINED_PALETTES['default'];
            setSelectedTheme(defaultTheme);
            setSelectedThemeKey('default');
            applyTheme(defaultTheme);
          });
        } else if (currentOrganization?.brand_colors) {
          setSelectedTheme(currentOrganization.brand_colors);
          setSelectedThemeKey(currentOrganization.brand_colors.id);
          applyTheme(currentOrganization.brand_colors);
          const orgId = currentOrganization.id;
          setOrgTheme(
            orgId,
            currentOrganization.brand_colors.id,
            currentOrganization.brand_colors
          );
        }
      } else {
        const defaultTheme = PREDEFINED_PALETTES['default'];
        setSelectedTheme(defaultTheme);
        setSelectedThemeKey('default');
        applyTheme(defaultTheme);
      }
    };

    loadTheme();
  }, [selectedOrgId, currentOrganization?.id]);

  const applySelectedTheme = (themeKey: string) => {
    const nextTheme = allThemes[themeKey];
    if (nextTheme) {
      setSelectedTheme(nextTheme);
      setSelectedThemeKey(themeKey);
      applyTheme(nextTheme);
      const orgId = selectedOrgId || currentOrganization?.id;
      if (orgId) {
        setOrgTheme(orgId, themeKey, nextTheme);
      }
    }
  };

  const updateThemeColor = (
    colorKey: string,
    value: string,
    mode: 'light' | 'dark'
  ) => {
    if (!selectedTheme) return;

    const updatedTheme = {
      ...selectedTheme,
      id: 'custom',
      name: 'Custom',
      [mode]: {
        ...selectedTheme[mode],
        [colorKey]: value,
      },
    };

    setSelectedTheme(updatedTheme);
    setSelectedThemeKey('custom');
    batchUpdateThemeProperties({
      colors: { [colorKey]: value },
      isDark: mode === 'dark',
    });
    const orgId = selectedOrgId || currentOrganization?.id;
    if (orgId) {
      setOrgTheme(orgId, 'custom', updatedTheme);
    }
  };

  const resetToOrganizationTheme = () => {
    if (currentOrganization?.brand_colors) {
      setSelectedTheme(currentOrganization.brand_colors);
      setSelectedThemeKey(currentOrganization.brand_colors.id);
      applyTheme(currentOrganization.brand_colors);
      const orgId = selectedOrgId || currentOrganization.id;
      if (orgId) {
        setOrgTheme(
          orgId,
          currentOrganization.brand_colors.id,
          currentOrganization.brand_colors
        );
      }
    }
  };

  const value: PaletteContextType = {
    selectedTheme,
    selectedThemeKey,
    allThemes,
    applySelectedTheme,
    updateThemeColor,
    resetToOrganizationTheme,
  };

  return (
    <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>
  );
}

export function usePalette(): PaletteContextType {
  const context = useContext(PaletteContext);
  if (context === undefined) {
    throw new Error('usePalette must be used within a PaletteProvider');
  }
  return context;
}
