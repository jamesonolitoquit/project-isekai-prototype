/**
 * M41 Task 5: Epoch Theme Manager
 * 
 * Manages epoch-based visual theme transitions with smooth CSS morphing.
 * Syncs with WorldState.epochId to automatically apply the appropriate theme.
 */

export type EpochTheme = 1 | 2 | 3;

export interface EpochThemeConfig {
  epoch: EpochTheme;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

/**
 * Epoch theme configurations
 * Maps each epoch to its visual identity
 */
export const EPOCH_THEMES: Record<EpochTheme, EpochThemeConfig> = {
  1: {
    epoch: 1,
    name: 'The Fracture of Radiance',
    description: 'Hope breaking through darkness - Blue and Purple',
    colors: {
      primary: '#6366f1',      // Indigo
      secondary: '#8b5cf6',    // Purple
      accent: '#0ea5e9'        // Cyan
    }
  },
  2: {
    epoch: 2,
    name: 'Age of Shattered Faith',
    description: 'Warning, danger, decay - Amber and Red',
    colors: {
      primary: '#d97706',      // Amber
      secondary: '#dc2626',    // Red
      accent: '#f97316'        // Orange
    }
  },
  3: {
    epoch: 3,
    name: 'The Waning Light',
    description: 'Nature reclaiming, hope from despair - Green and Teal',
    colors: {
      primary: '#10b981',      // Emerald
      secondary: '#06b6d4',    // Cyan
      accent: '#14b8a6'        // Teal
    }
  }
};

/**
 * Theme Manager Class
 * Handles dynamic theme application and transitions
 */
export class EpochThemeManager {
  private currentEpoch: EpochTheme = 1;
  private transitionInProgress = false;
  private transitionDuration = 800; // ms
  private listeners: Set<(epoch: EpochTheme) => void> = new Set();

  /**
   * Initialize the theme manager
   * Applies initial theme styling and sets up CSS
   */
  static initialize(): void {
    const manager = new EpochThemeManager();
    manager.applyTheme(1);
  }

  /**
   * Subscribe to theme changes
   * Listener will be called whenever epoch changes
   */
  onThemeChange(listener: (epoch: EpochTheme) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Unsubscribe from theme changes
   */
  offThemeChange(listener: (epoch: EpochTheme) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Apply theme for a given epoch
   * Includes smooth transition animation
   */
  applyTheme(epoch: EpochTheme, smooth = true): void {
    if (epoch === this.currentEpoch || this.transitionInProgress) {
      return;
    }

    this.transitionInProgress = true;

    // Add transitioning class to trigger morphing animation
    if (smooth) {
      document.documentElement.setAttribute('data-epoch-transitioning', 'true');
    }

    // Set the epoch attribute for CSS selectors
    document.documentElement.setAttribute('data-epoch', epoch.toString());

    // Re-apply CSS variables via data attribute
    this.updateCSSVariables(epoch);

    // Notify listeners
    this.currentEpoch = epoch;
    this.listeners.forEach(listener => listener(epoch));

    // Remove transitioning class after animation completes
    if (smooth) {
      setTimeout(() => {
        document.documentElement.removeAttribute('data-epoch-transitioning');
        this.transitionInProgress = false;
      }, this.transitionDuration);
    } else {
      this.transitionInProgress = false;
    }
  }

  /**
   * Update CSS variables for the current epoch
   * Ensures all component colors reflect the theme
   */
  private updateCSSVariables(epoch: EpochTheme): void {
    const theme = EPOCH_THEMES[epoch];
    const root = document.documentElement;

    // Update CSS custom properties
    root.style.setProperty('--current-epoch', epoch.toString());

    // Primary colors
    root.style.setProperty('--epoch-primary', theme.colors.primary);
    root.style.setProperty('--epoch-secondary', theme.colors.secondary);
    root.style.setProperty('--epoch-accent', theme.colors.accent);

    // Variant colors (lighter/darker) are handled by CSS [data-epoch] selectors
    // but we can also programmatically adjust opacity for variants
    const rgb = this.hexToRgb(theme.colors.primary);
    if (rgb) {
      root.style.setProperty('--epoch-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`);
      root.style.setProperty('--epoch-glow-strong', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
    }
  }

  /**
   * Convert hex color to RGB for dynamic glow effects
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : null;
  }

  /**
   * Get the current active epoch
   */
  getCurrentEpoch(): EpochTheme {
    return this.currentEpoch;
  }

  /**
   * Get theme info for current epoch
   */
  getCurrentTheme(): EpochThemeConfig {
    return EPOCH_THEMES[this.currentEpoch];
  }

  /**
   * Get theme info for a specific epoch
   */
  getTheme(epoch: EpochTheme): EpochThemeConfig {
    return EPOCH_THEMES[epoch];
  }

  /**
   * Trigger theme morph with visual feedback
   * Useful for epoch transition scenes
   */
  async morphTheme(toEpoch: EpochTheme, duration: number = 1000): Promise<void> {
    return new Promise(resolve => {
      this.transitionDuration = duration;
      this.applyTheme(toEpoch, true);
      setTimeout(resolve, duration);
    });
  }

  /**
   * Get CSS class for an epoch
   * Allows conditional styling
   */
  getEpochClass(epoch: EpochTheme): string {
    return `epoch-${epoch}`;
  }
}

/**
 * React Hook: useEpochTheme
 * Automatically syncs component theme with world state
 */
export function useEpochTheme(epoch: EpochTheme | undefined): EpochThemeConfig | null {
  if (!epoch || epoch < 1 || epoch > 3) {
    return null;
  }

  // Apply theme when epoch changes
  const manager = new EpochThemeManager();
  manager.applyTheme(epoch as EpochTheme);

  return EPOCH_THEMES[epoch as EpochTheme] || null;
}

/**
 * Get contrasting text color for a given background
 * Useful for dynamic component styling
 */
export function getContrastingTextColor(backgroundHex: string): 'white' | 'black' {
  const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(backgroundHex);
  if (!rgb) return 'white';

  const r = parseInt(rgb[1], 16);
  const g = parseInt(rgb[2], 16);
  const b = parseInt(rgb[3], 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? 'black' : 'white';
}

/**
 * CSS Selector Helper
 * Returns selector for current epoch
 */
export function getEpochSelector(epoch: EpochTheme): string {
  return `[data-epoch="${epoch}"]`;
}

/**
 * Animation Helper
 * Returns appropriate transition values for smooth morphing
 */
export function getEpochTransitionStyles(): React.CSSProperties {
  return {
    transition: 'all 800ms cubic-bezier(0.4, 0, 0.2, 1)',
    willChange: 'background-color, color, border-color, box-shadow'
  };
}

/**
 * Debug Helper
 * Logs current theme information
 */
export function debugTheme(epoch: EpochTheme | undefined): void {
  if (!epoch || epoch < 1 || epoch > 3) {
    console.warn('Invalid epoch:', epoch);
    return;
  }

  const theme = EPOCH_THEMES[epoch as EpochTheme];
  console.log(`
╔════════════════════════════════════════════╗
║ Epoch ${epoch} Theme: ${theme.name}
║ ${theme.description}
╠════════════════════════════════════════════╣
║ Primary:   ${theme.colors.primary}
║ Secondary: ${theme.colors.secondary}
║ Accent:    ${theme.colors.accent}
╚════════════════════════════════════════════╝
  `);
}

// Export singleton instance
export const themeManager = new EpochThemeManager();
