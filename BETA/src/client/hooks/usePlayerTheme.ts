/**
 * usePlayerTheme Hook
 * 
 * Manages theme configuration for the Hero's Reliquary HUD system.
 * Supports multiple theme profiles and is extensible for future themes.
 * 
 * Themes define:
 * - Base colors (primary, secondary, accent)
 * - Text colors and contrast
 * - Rarity color mappings
 * - Gauge colors (health, mana, paradox, xp)
 * - UI element styles
 * 
 * Phase 1: Implement 3 core themes (Dark Arcane, Vale Twilight, Ethereal)
 * Future: Player-selectable themes via settings
 */

import { useMemo } from 'react';

export type ThemeId = 'dark-arcane' | 'vale-twilight' | 'ethereal';

export interface GameTheme {
  id: ThemeId;
  name: string;
  description: string;
  colors: {
    // Primary palette
    primary: string;        // Main UI color
    secondary: string;      // Secondary UI color
    accent: string;         // Highlight/interactive color
    background: string;     // Window/panel background
    border: string;         // UI borders
    text: string;           // Primary text
    textSecondary: string;  // Secondary text
    textAccent: string;     // Accent text
    
    // Gauge colors
    health: {
      bar: string;          // Health bar fill
      border: string;       // Health bar border
      background: string;   // Health bar background
    };
    mana: {
      bar: string;
      border: string;
      background: string;
    };
    paradox: {
      bar: string;
      border: string;
      background: string;
      glitch: string;       // Paradox glow/glitch color
    };
    xp: {
      bar: string;
      border: string;
      background: string;
    };
    
    // Rarity colors
    rarity: {
      common: string;
      uncommon: string;
      rare: string;
      epic: string;
      legendary: string;
      artifact: string;
    };
    
    // UI state colors
    success: string;
    warning: string;
    error: string;
    disabled: string;
  };
  shadows: {
    light: string;
    medium: string;
    heavy: string;
  };
  fonts: {
    primary: string;        // Body font
    heading: string;        // Header font
    mono: string;           // Monospace font (for values)
  };
}

// ============================================================================
// THEME DEFINITIONS
// ============================================================================

const DARK_ARCANE: GameTheme = {
  id: 'dark-arcane',
  name: 'Dark Arcane',
  description: 'Deep mystical blues and purples with arcane runes',
  colors: {
    primary: '#2d3561',
    secondary: '#1a1f2e',
    accent: '#74b9ff',
    background: 'rgba(20, 30, 60, 0.9)',
    border: '#2d3561',
    text: '#e0e0e0',
    textSecondary: '#a0a0a0',
    textAccent: '#74b9ff',
    
    health: {
      bar: '#e74c3c',
      border: '#c0392b',
      background: 'rgba(44, 62, 80, 0.3)',
    },
    mana: {
      bar: '#6c5ce7',
      border: '#5f3dc4',
      background: 'rgba(44, 62, 80, 0.3)',
    },
    paradox: {
      bar: '#f39c12',
      border: '#e67e22',
      background: 'rgba(44, 62, 80, 0.3)',
      glitch: '#f39c12',
    },
    xp: {
      bar: '#f1c40f',
      border: '#f39c12',
      background: 'rgba(44, 62, 80, 0.3)',
    },
    
    rarity: {
      common: '#95a5a6',
      uncommon: '#2ecc71',
      rare: '#3498db',
      epic: '#9b59b6',
      legendary: '#f39c12',
      artifact: '#e74c3c',
    },
    
    success: '#2ecc71',
    warning: '#f39c12',
    error: '#e74c3c',
    disabled: '#7f8c8d',
  },
  shadows: {
    light: '0 2px 4px rgba(0, 0, 0, 0.2)',
    medium: '0 4px 8px rgba(0, 0, 0, 0.4)',
    heavy: '0 8px 16px rgba(0, 0, 0, 0.6)',
  },
  fonts: {
    primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    heading: '"Cinzel", serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
  },
};

const VALE_TWILIGHT: GameTheme = {
  id: 'vale-twilight',
  name: 'Vale Twilight',
  description: 'Warm sunset hues with earthen tones and twilight purples',
  colors: {
    primary: '#6b4423',
    secondary: '#3d2817',
    accent: '#d4a373',
    background: 'rgba(61, 40, 23, 0.9)',
    border: '#8b5a3c',
    text: '#f5e6d3',
    textSecondary: '#d4a373',
    textAccent: '#f0d9b5',
    
    health: {
      bar: '#c0392b',
      border: '#a93226',
      background: 'rgba(75, 50, 30, 0.3)',
    },
    mana: {
      bar: '#8e44ad',
      border: '#7d3c98',
      background: 'rgba(75, 50, 30, 0.3)',
    },
    paradox: {
      bar: '#e67e22',
      border: '#d35400',
      background: 'rgba(75, 50, 30, 0.3)',
      glitch: '#e67e22',
    },
    xp: {
      bar: '#f4d03f',
      border: '#f39c12',
      background: 'rgba(75, 50, 30, 0.3)',
    },
    
    rarity: {
      common: '#bdc3c7',
      uncommon: '#27ae60',
      rare: '#2980b9',
      epic: '#8e44ad',
      legendary: '#e67e22',
      artifact: '#c0392b',
    },
    
    success: '#27ae60',
    warning: '#e67e22',
    error: '#c0392b',
    disabled: '#95a5a6',
  },
  shadows: {
    light: '0 2px 4px rgba(0, 0, 0, 0.3)',
    medium: '0 4px 8px rgba(0, 0, 0, 0.5)',
    heavy: '0 8px 16px rgba(0, 0, 0, 0.7)',
  },
  fonts: {
    primary: '"Georgia", serif',
    heading: '"Cinzel", serif',
    mono: '"JetBrains Mono", "Courier New", monospace',
  },
};

const ETHEREAL: GameTheme = {
  id: 'ethereal',
  name: 'Ethereal',
  description: 'Luminous pastels with celestial silvers and iridescent effects',
  colors: {
    primary: '#b8e6f0',
    secondary: '#e0f4ff',
    accent: '#a78bfa',
    background: 'rgba(224, 242, 254, 0.85)',
    border: '#c5e4f3',
    text: '#1e40af',
    textSecondary: '#3b82f6',
    textAccent: '#7c3aed',
    
    health: {
      bar: '#f87171',
      border: '#dc2626',
      background: 'rgba(226, 232, 240, 0.3)',
    },
    mana: {
      bar: '#c4b5fd',
      border: '#a78bfa',
      background: 'rgba(226, 232, 240, 0.3)',
    },
    paradox: {
      bar: '#fbbf24',
      border: '#f59e0b',
      background: 'rgba(226, 232, 240, 0.3)',
      glitch: '#fbbf24',
    },
    xp: {
      bar: '#bfdbfe',
      border: '#93c5fd',
      background: 'rgba(226, 232, 240, 0.3)',
    },
    
    rarity: {
      common: '#cbd5e1',
      uncommon: '#4ade80',
      rare: '#60a5fa',
      epic: '#d084dc',
      legendary: '#fbbf24',
      artifact: '#f87171',
    },
    
    success: '#4ade80',
    warning: '#fbbf24',
    error: '#f87171',
    disabled: '#cbd5e1',
  },
  shadows: {
    light: '0 2px 4px rgba(0, 0, 0, 0.1)',
    medium: '0 4px 8px rgba(0, 0, 0, 0.15)',
    heavy: '0 8px 16px rgba(0, 0, 0, 0.25)',
  },
  fonts: {
    primary: '"Quicksand", sans-serif',
    heading: '"Playfair Display", serif',
    mono: '"IBM Plex Mono", monospace',
  },
};

// ============================================================================
// THEME REGISTRY & HOOK
// ============================================================================

const THEMES: Record<ThemeId, GameTheme> = {
  'dark-arcane': DARK_ARCANE,
  'vale-twilight': VALE_TWILIGHT,
  'ethereal': ETHEREAL,
};

export function getTheme(themeId: ThemeId | string): GameTheme {
  return THEMES[themeId as ThemeId] || DARK_ARCANE; // Default to Dark Arcane
}

export function getAllThemes(): GameTheme[] {
  return Object.values(THEMES);
}

/**
 * Hook: usePlayerTheme
 * 
 * Returns current theme and provides utilities for theme management.
 * Can accept a themeId (either from player settings, props, or defaults to Dark Arcane).
 * 
 * Usage:
 *   const { theme, colors } = usePlayerTheme('vale-twilight');
 *   const hpBar = styled.div`background: ${colors.health.bar};`;
 */
export interface UsePlayerThemeReturn {
  theme: GameTheme;
  colors: GameTheme['colors'];
  fonts: GameTheme['fonts'];
  shadows: GameTheme['shadows'];
  themeId: ThemeId;
}

export function usePlayerTheme(
  playerThemeId?: ThemeId | string | null,
  fallback: ThemeId = 'dark-arcane'
): UsePlayerThemeReturn {
  return useMemo(() => {
    const themeId = (playerThemeId as ThemeId) || fallback;
    const theme = getTheme(themeId);
    
    return {
      theme,
      colors: theme.colors,
      fonts: theme.fonts,
      shadows: theme.shadows,
      themeId: theme.id,
    };
  }, [playerThemeId, fallback]);
}

// Export for future extensibility
export const ThemeExports = {
  DARK_ARCANE,
  VALE_TWILIGHT,
  ETHEREAL,
  getTheme,
  getAllThemes,
};
