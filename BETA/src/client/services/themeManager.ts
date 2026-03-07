/**
 * themeManager.ts - Phase 30 Task 9: Diegetic Theme Manager
 * Phase 33 Extension: Multi-Genre Theme Support
 * 
 * Singleton service managing "Narrative Codecs" that represent
 * different visual lenses through which the player perceives reality.
 * Supports 11 genres: Medieval, Glitch, Minimal, Cyberpunk, Solarpunk,
 * Voidsync, Noir, Overland, Vintage, Storybook, and Dreamscape.
 * 
 * CODEC AESTHETICS:
 * - CODENAME_MEDIEVAL: Parchment/mystical (Cinzel serif, gold/blood-red)
 * - CODENAME_GLITCH: Synthetic/neon (Share Tech Mono, magenta/cyan)
 * - CODENAME_MINIMAL: Administrative/clean (sans-serif, gray/blue)
 * - CODENAME_CYBERPUNK: High-tech/low-life (Roboto Mono, neon grid)
 * - CODENAME_SOLARPUNK: Ecological future (soft earth tones, sage)
 * - CODENAME_VOIDSYNC: Deep space (titanium, nebula purple, sterile)
 * - CODENAME_NOIR: Hardboiled mystery (grayscale + case color)
 * - CODENAME_OVERLAND: Military survival (olive drab, tactical)
 * - CODENAME_VINTAGE: 1920s pulp (sepia, brass, leather)
 * - CODENAME_STORYBOOK: Fable/watercolor (soft pastels, whimsy)
 * - CODENAME_DREAMSCAPE: Surreal/abstract (iridescent, floating)
 */

export type NarrativeCodec = 
  | 'CODENAME_MEDIEVAL' 
  | 'CODENAME_GLITCH' 
  | 'CODENAME_MINIMAL'
  | 'CODENAME_CYBERPUNK'
  | 'CODENAME_SOLARPUNK'
  | 'CODENAME_VOIDSYNC'
  | 'CODENAME_NOIR'
  | 'CODENAME_OVERLAND'
  | 'CODENAME_VINTAGE'
  | 'CODENAME_STORYBOOK'
  | 'CODENAME_DREAMSCAPE';

export type ParticleProfile = 'spirit' | 'ember' | 'chronoshard' | 'void' | 'stardust' | 'leaf' | 'ash' | 'ink' | 'dream';

export interface CodecDefinition {
  name: NarrativeCodec;
  label: string;
  description: string;
  particleProfile?: ParticleProfile; // Visual particle effect profile for this theme
  // Phase 40: Mechanical modifiers that influence gameplay
  costMultiplier?: number; // AP/Mana cost multiplier (1.0 = normal, 1.1 = 10% more expensive)
  powerBonus?: number; // Damage/healing bonus multiplier (1.0 = normal, 1.15 = 15% more powerful)
  // Phase 42: Proficiency system tempo and passion indicators
  xpTempoMultiplier?: number; // XP gain modifier (1.0 = normal, 1.5 = 50% faster progression)
  passionIcons?: {
    low?: string;    // Icon for low passion (0 - cold)
    medium?: string; // Icon for medium passion (1 - normal)
    high?: string;   // Icon for high passion (2 - burning)
  };
  colors: {
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    borderAccent: string;
    borderSecondary: string;
    textPrimary: string;
    textSecondary: string;
    accentMain: string;
    accentAlt: string;
    glitchColor: string;
    warningColor: string;
  };
  materials?: {
    woodBase?: string;
    woodBorder?: string;
    stoneBase?: string;
    stoneBorder?: string;
    paperBase?: string;
    paperText?: string;
  };
  typography: {
    fontFamily: string;
    headingFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
    };
    fontWeight: {
      normal: number;
      bold: number;
      heavy: number;
    };
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
  animations: {
    transitionSpeed: string;
    pulseSpeed: string;
  };
}

/**
 * Complete codec definitions for all narrative perspectives (Medieval, Glitch, Minimal + 8 Genre Packs)
 */
const CODECS: Record<NarrativeCodec, CodecDefinition> = {
  CODENAME_MEDIEVAL: {
    name: 'CODENAME_MEDIEVAL',
    label: 'Medieval',
    description: 'Parchment scrolls and mystical runes',
    particleProfile: 'spirit',
    costMultiplier: 1.0,  // Balanced baseline
    powerBonus: 1.0,
    xpTempoMultiplier: 1.5,  // High XP - slower action speed compensated with high XP yield
    passionIcons: {
      low: '❄️',    // Cold flame
      medium: '🔥', // Normal flame
      high: '🔥🔥' // Burning passion
    },
    colors: {
      bgPrimary: '#2a2416',
      bgSecondary: '#3a3426',
      bgTertiary: '#4a4436',
      borderAccent: '#d4af37',
      borderSecondary: '#8b4513',
      textPrimary: '#e8d7c3',
      textSecondary: '#c9b596',
      accentMain: '#b8341d',
      accentAlt: '#d4af37',
      glitchColor: '#ff4444',
      warningColor: '#ff9944'
    },
    materials: {
      woodBase: '#3d2b1f',
      woodBorder: '#5c4033',
      stoneBase: '#2a2a2e',
      stoneBorder: '#5c5c5c',
      paperBase: '#f4e4bc',
      paperText: '#2a2a2a'
    },
    typography: {
      fontFamily: "'Georgia', serif",
      headingFamily: "'Cinzel', serif",
      fontSize: {
        xs: '12px',
        sm: '14px',
        base: '16px',
        lg: '20px',
        xl: '24px'
      },
      fontWeight: {
        normal: 400,
        bold: 600,
        heavy: 700
      }
    },
    shadows: {
      sm: '0 2px 8px rgba(0, 0, 0, 0.4)',
      md: '0 4px 16px rgba(0, 0, 0, 0.6)',
      lg: '0 8px 32px rgba(0, 0, 0, 0.8)'
    },
    animations: {
      transitionSpeed: '0.4s',
      pulseSpeed: '3s'
    }
  },

  CODENAME_GLITCH: {
    name: 'CODENAME_GLITCH',
    label: 'Glitch',
    description: 'Void-violet synthwave, living paradox',
    particleProfile: 'chronoshard',
    costMultiplier: 1.25,  // Paradox costs extra AP
    powerBonus: 1.2,
    xpTempoMultiplier: 0.7,  // Fast actions, low XP yield
    passionIcons: {
      low: '❄️',    // Cold
      medium: '⚡', // Electric
      high: '⚡⚡' // Electrified
    },
    colors: {
      bgPrimary: '#0a0a1a',
      bgSecondary: '#1a0a2e',
      bgTertiary: '#260a4e',
      borderAccent: '#ff00c4',
      borderSecondary: '#00ffc8',
      textPrimary: '#e8d7c3',
      textSecondary: '#00ffc8',
      accentMain: '#ff00c4',
      accentAlt: '#00ffff',
      glitchColor: '#ff0080',
      warningColor: '#ff00c4'
    },
    materials: {
      woodBase: '#1a0a1a',
      woodBorder: '#ff00c4',
      stoneBase: '#0a0a1a',
      stoneBorder: '#00ffc8',
      paperBase: '#1a1a1a',
      paperText: '#00ff41'
    },
    typography: {
      fontFamily: "'Share Tech Mono', monospace",
      headingFamily: "'Share Tech Mono', monospace",
      fontSize: {
        xs: '11px',
        sm: '13px',
        base: '14px',
        lg: '18px',
        xl: '22px'
      },
      fontWeight: {
        normal: 400,
        bold: 500,
        heavy: 600
      }
    },
    shadows: {
      sm: '0 0 10px rgba(255, 0, 196, 0.3)',
      md: '0 0 20px rgba(0, 255, 200, 0.4)',
      lg: '0 0 40px rgba(255, 0, 196, 0.5)'
    },
    animations: {
      transitionSpeed: '0.2s',
      pulseSpeed: '1.5s'
    }
  },

  CODENAME_MINIMAL: {
    name: 'CODENAME_MINIMAL',
    label: 'Minimal',
    description: 'Observer administrative interface',
    particleProfile: 'stardust',
    costMultiplier: 0.9,  // Efficient protocols
    powerBonus: 0.95,
    xpTempoMultiplier: 1.0,  // Neutral progression
    passionIcons: {
      low: '○',    // Empty circle
      medium: '◐', // Half circle
      high: '●'   // Full circle
    },
    colors: {
      bgPrimary: '#f5f5f5',
      bgSecondary: '#ececec',
      bgTertiary: '#e0e0e0',
      borderAccent: '#2c3e50',
      borderSecondary: '#95a5a6',
      textPrimary: '#2c3e50',
      textSecondary: '#7f8c8d',
      accentMain: '#3498db',
      accentAlt: '#2ecc71',
      glitchColor: '#e74c3c',
      warningColor: '#f39c12'
    },
    materials: {
      woodBase: '#d4a373',
      woodBorder: '#999999',
      stoneBase: '#cccccc',
      stoneBorder: '#666666',
      paperBase: '#ffffff',
      paperText: '#333333'
    },
    typography: {
      fontFamily: "'Inter', '-apple-system', 'Segoe UI', sans-serif",
      headingFamily: "'Inter', '-apple-system', 'Segoe UI', sans-serif",
      fontSize: {
        xs: '12px',
        sm: '13px',
        base: '14px',
        lg: '16px',
        xl: '18px'
      },
      fontWeight: {
        normal: 400,
        bold: 500,
        heavy: 600
      }
    },
    shadows: {
      sm: '0 1px 3px rgba(0, 0, 0, 0.12)',
      md: '0 2px 8px rgba(0, 0, 0, 0.16)',
      lg: '0 4px 16px rgba(0, 0, 0, 0.2)'
    },
    animations: {
      transitionSpeed: '0.3s',
      pulseSpeed: '2.5s'
    }
  },

  CODENAME_CYBERPUNK: {
    name: 'CODENAME_CYBERPUNK',
    label: 'Cyberpunk',
    description: 'Neon circuits, corporate chrome, digital rebellion',
    particleProfile: 'chronoshard',
    costMultiplier: 1.1,  // Tech overhead
    powerBonus: 1.15,
    xpTempoMultiplier: 0.85,  // Fast-paced, moderate XP
    passionIcons: {
      low: '🔒',    // Locked
      medium: '📋', // Data
      high: '📋📋' // Double data
    },
    colors: {
      bgPrimary: '#09090b',
      bgSecondary: '#1a1a2e',
      bgTertiary: '#16213e',
      borderAccent: '#8b5cf6',
      borderSecondary: '#22c55e',
      textPrimary: '#e0e0e0',
      textSecondary: '#22c55e',
      accentMain: '#8b5cf6',
      accentAlt: '#22c55e',
      glitchColor: '#ec4899',
      warningColor: '#f97316'
    },
    materials: {
      woodBase: '#0f1419',
      woodBorder: '#8b5cf6',
      stoneBase: '#1a1a2e',
      stoneBorder: '#22c55e',
      paperBase: '#1a1a2e',
      paperText: '#22c55e'
    },
    typography: {
      fontFamily: "'Roboto Mono', monospace",
      headingFamily: "'Orbitron', sans-serif",
      fontSize: {
        xs: '11px',
        sm: '12px',
        base: '13px',
        lg: '16px',
        xl: '20px'
      },
      fontWeight: {
        normal: 400,
        bold: 600,
        heavy: 700
      }
    },
    shadows: {
      sm: '0 0 8px rgba(139, 92, 246, 0.4)',
      md: '0 0 16px rgba(34, 197, 94, 0.3)',
      lg: '0 0 32px rgba(139, 92, 246, 0.5)'
    },
    animations: {
      transitionSpeed: '0.2s',
      pulseSpeed: '1.8s'
    }
  },

  CODENAME_SOLARPUNK: {
    name: 'CODENAME_SOLARPUNK',
    label: 'Solarpunk',
    description: 'Green future, flourishing ecosystems, solar power',
    particleProfile: 'leaf',
    costMultiplier: 0.95,  // Solar efficiency
    powerBonus: 1.05,
    xpTempoMultiplier: 1.2,  // Steady, sustained progression
    passionIcons: {
      low: '🧑',    // Person
      medium: '😊', // Smiling
      high: '😊😊' // Very happy
    },
    colors: {
      bgPrimary: '#fef3c7',
      bgSecondary: '#fcd34d',
      bgTertiary: '#f59e0b',
      borderAccent: '#4ade80',
      borderSecondary: '#0ea5e9',
      textPrimary: '#1f2937',
      textSecondary: '#4ade80',
      accentMain: '#4ade80',
      accentAlt: '#0ea5e9',
      glitchColor: '#ef4444',
      warningColor: '#f97316'
    },
    materials: {
      woodBase: '#a16207',
      woodBorder: '#4ade80',
      stoneBase: '#d1d5db',
      stoneBorder: '#0ea5e9',
      paperBase: '#fef3c7',
      paperText: '#1f2937'
    },
    typography: {
      fontFamily: "'Poppins', sans-serif",
      headingFamily: "'Poppins', sans-serif",
      fontSize: {
        xs: '12px',
        sm: '14px',
        base: '16px',
        lg: '18px',
        xl: '22px'
      },
      fontWeight: {
        normal: 400,
        bold: 600,
        heavy: 700
      }
    },
    shadows: {
      sm: '0 2px 6px rgba(74, 222, 128, 0.2)',
      md: '0 4px 12px rgba(14, 165, 233, 0.25)',
      lg: '0 8px 24px rgba(74, 222, 128, 0.3)'
    },
    animations: {
      transitionSpeed: '0.35s',
      pulseSpeed: '3.5s'
    }
  },

  CODENAME_VOIDSYNC: {
    name: 'CODENAME_VOIDSYNC',
    label: 'Voidsync',
    description: 'Deep space exploration, cosmic isolation, pure technology',
    particleProfile: 'void',
    costMultiplier: 1.0,  // Cosmic balance
    powerBonus: 1.1,
    xpTempoMultiplier: 1.1,  // Slow but rewarding
    passionIcons: {
      low: '⦿',    // Circled void
      medium: '🌌', // Galaxy
      high: '🌌🌌' // Double galaxy
    },
    colors: {
      bgPrimary: '#020617',
      bgSecondary: '#0f172a',
      bgTertiary: '#1e293b',
      borderAccent: '#d8b4fe',
      borderSecondary: '#0ea5e9',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      accentMain: '#d8b4fe',
      accentAlt: '#0ea5e9',
      glitchColor: '#f43f5e',
      warningColor: '#fb923c'
    },
    materials: {
      woodBase: '#1e293b',
      woodBorder: '#d8b4fe',
      stoneBase: '#020617',
      stoneBorder: '#0ea5e9',
      paperBase: '#0f172a',
      paperText: '#d8b4fe'
    },
    typography: {
      fontFamily: "'IBM Plex Mono', monospace",
      headingFamily: "'IBM Plex Sans', sans-serif",
      fontSize: {
        xs: '11px',
        sm: '13px',
        base: '14px',
        lg: '18px',
        xl: '22px'
      },
      fontWeight: {
        normal: 400,
        bold: 600,
        heavy: 700
      }
    },
    shadows: {
      sm: '0 0 12px rgba(216, 180, 254, 0.2)',
      md: '0 0 24px rgba(14, 165, 233, 0.25)',
      lg: '0 0 48px rgba(216, 180, 254, 0.35)'
    },
    animations: {
      transitionSpeed: '0.4s',
      pulseSpeed: '4s'
    }
  },

  CODENAME_NOIR: {
    name: 'CODENAME_NOIR',
    label: 'Noir',
    description: 'Hardboiled mystery, grayscale + one "case color"',
    particleProfile: 'ash',
    costMultiplier: 0.95,  // Precise execution
    powerBonus: 1.0,
    xpTempoMultiplier: 1.0,  // Noir pacing
    passionIcons: {
      low: '🔍',    // Magnifying glass
      medium: '🕵️', // Detective
      high: '🕵️🕵️' // Double detective
    },
    colors: {
      bgPrimary: '#1c1917',
      bgSecondary: '#292524',
      bgTertiary: '#44403c',
      borderAccent: '#7c2d12',
      borderSecondary: '#78716c',
      textPrimary: '#e7e5e4',
      textSecondary: '#a8a29e',
      accentMain: '#dc2626',
      accentAlt: '#fbbf24',
      glitchColor: '#dc2626',
      warningColor: '#dc2626'
    },
    materials: {
      woodBase: '#292524',
      woodBorder: '#7c2d12',
      stoneBase: '#1c1917',
      stoneBorder: '#78716c',
      paperBase: '#d97706',
      paperText: '#1c1917'
    },
    typography: {
      fontFamily: "'Courier Prime', monospace",
      headingFamily: "'Courier Prime', monospace",
      fontSize: {
        xs: '12px',
        sm: '13px',
        base: '14px',
        lg: '16px',
        xl: '20px'
      },
      fontWeight: {
        normal: 400,
        bold: 700,
        heavy: 900
      }
    },
    shadows: {
      sm: '0 2px 6px rgba(0, 0, 0, 0.6)',
      md: '0 4px 12px rgba(0, 0, 0, 0.8)',
      lg: '0 8px 24px rgba(0, 0, 0, 0.9)'
    },
    animations: {
      transitionSpeed: '0.5s',
      pulseSpeed: '2.5s'
    }
  },

  CODENAME_OVERLAND: {
    name: 'CODENAME_OVERLAND',
    label: 'Overland',
    description: 'Military survival, tactical gear, weathered maps',
    particleProfile: 'leaf',
    costMultiplier: 1.05,  // Tactical overhead
    powerBonus: 1.05,
    xpTempoMultiplier: 1.3,  // High action yield
    passionIcons: {
      low: '📄',    // Page
      medium: '📓', // Notebook
      high: '📓📓' // Double notebook
    },
    colors: {
      bgPrimary: '#3f6212',
      bgSecondary: '#4b7c0f',
      bgTertiary: '#5a8a1f',
      borderAccent: '#a16207',
      borderSecondary: '#7c2d12',
      textPrimary: '#ecfdf5',
      textSecondary: '#d1fae5',
      accentMain: '#a16207',
      accentAlt: '#064e3b',
      glitchColor: '#dc2626',
      warningColor: '#f97316'
    },
    materials: {
      woodBase: '#5a8a1f',
      woodBorder: '#a16207',
      stoneBase: '#4b7c0f',
      stoneBorder: '#666666',
      paperBase: '#a16207',
      paperText: '#1f2937'
    },
    typography: {
      fontFamily: "'Courier Prime', monospace",
      headingFamily: "'Oswald', sans-serif",
      fontSize: {
        xs: '11px',
        sm: '12px',
        base: '13px',
        lg: '16px',
        xl: '18px'
      },
      fontWeight: {
        normal: 400,
        bold: 700,
        heavy: 900
      }
    },
    shadows: {
      sm: '0 2px 4px rgba(0, 0, 0, 0.4)',
      md: '0 4px 8px rgba(0, 0, 0, 0.6)',
      lg: '0 8px 16px rgba(0, 0, 0, 0.8)'
    },
    animations: {
      transitionSpeed: '0.25s',
      pulseSpeed: '2s'
    }
  },

  CODENAME_VINTAGE: {
    name: 'CODENAME_VINTAGE',
    label: 'Vintage',
    description: '1920s pulp fiction, brass, leather, and mystery',
    particleProfile: 'ash',
    costMultiplier: 0.95,  // Classic efficiency
    powerBonus: 1.0,
    xpTempoMultiplier: 1.1,  // Vintage pacing
    passionIcons: {
      low: '🎷',    // Saxophone
      medium: '🎶', // Musical note
      high: '🎶🎶' // Double note
    },
    colors: {
      bgPrimary: '#451a03',
      bgSecondary: '#7c2d12',
      bgTertiary: '#92400e',
      borderAccent: '#d97706',
      borderSecondary: '#b45309',
      textPrimary: '#fffbeb',
      textSecondary: '#fed7aa',
      accentMain: '#b45309',
      accentAlt: '#d97706',
      glitchColor: '#dc2626',
      warningColor: '#f97316'
    },
    materials: {
      woodBase: '#5c3d2e',
      woodBorder: '#d97706',
      stoneBase: '#3f2817',
      stoneBorder: '#8b7355',
      paperBase: '#d97706',
      paperText: '#2a1810'
    },
    typography: {
      fontFamily: "'Cousine', monospace",
      headingFamily: "'Playfair Display', serif",
      fontSize: {
        xs: '12px',
        sm: '13px',
        base: '14px',
        lg: '18px',
        xl: '22px'
      },
      fontWeight: {
        normal: 400,
        bold: 600,
        heavy: 700
      }
    },
    shadows: {
      sm: '0 2px 8px rgba(0, 0, 0, 0.5)',
      md: '0 4px 16px rgba(0, 0, 0, 0.7)',
      lg: '0 8px 32px rgba(0, 0, 0, 0.9)'
    },
    animations: {
      transitionSpeed: '0.35s',
      pulseSpeed: '3s'
    }
  },

  CODENAME_STORYBOOK: {
    name: 'CODENAME_STORYBOOK',
    label: 'Storybook',
    description: 'Fairy tales and whimsy, hand-drawn watercolor aesthetic',
    particleProfile: 'stardust',
    costMultiplier: 1.0,  // Balanced magic
    powerBonus: 1.2,
    xpTempoMultiplier: 1.4,  // Phase 42: Narrative boost
    passionIcons: {
      low: '📖',
      medium: '📚',
      high: '📚📚'
    },
    colors: {
      bgPrimary: '#fce7f3',
      bgSecondary: '#fbcfe8',
      bgTertiary: '#f9a8d4',
      borderAccent: '#059669',
      borderSecondary: '#10b981',
      textPrimary: '#1e1b4b',
      textSecondary: '#4c1d95',
      accentMain: '#059669',
      accentAlt: '#0891b2',
      glitchColor: '#dc2626',
      warningColor: '#f59e0b'
    },
    materials: {
      woodBase: '#a16207',
      woodBorder: '#059669',
      stoneBase: '#f3e8ff',
      stoneBorder: '#4c1d95',
      paperBase: '#fce7f3',
      paperText: '#1e1b4b'
    },
    typography: {
      fontFamily: "'Fredoka', sans-serif",
      headingFamily: "'Fredoka', sans-serif",
      fontSize: {
        xs: '13px',
        sm: '14px',
        base: '15px',
        lg: '18px',
        xl: '22px'
      },
      fontWeight: {
        normal: 400,
        bold: 600,
        heavy: 700
      }
    },
    shadows: {
      sm: '0 2px 6px rgba(0, 0, 0, 0.08)',
      md: '0 4px 12px rgba(0, 0, 0, 0.12)',
      lg: '0 8px 24px rgba(0, 0, 0, 0.15)'
    },
    animations: {
      transitionSpeed: '0.4s',
      pulseSpeed: '3.5s'
    }
  },

  CODENAME_DREAMSCAPE: {
    name: 'CODENAME_DREAMSCAPE',
    label: 'Dreamscape',
    description: 'Surreal and ethereal, reality defying, dreamlike floating',
    particleProfile: 'dream',
    costMultiplier: 1.15,  // Reality bending costs extra
    powerBonus: 1.25,
    xpTempoMultiplier: 1.25,  // Phase 42: Surreal progression
    passionIcons: {
      low: '🌀',
      medium: '✨',
      high: '✨✨'
    },
    colors: {
      bgPrimary: '#4c0519',
      bgSecondary: '#7c1c5c',
      bgTertiary: '#a855a8',
      borderAccent: '#c084fc',
      borderSecondary: '#e9d5ff',
      textPrimary: '#fce7f3',
      textSecondary: '#f0e7fe',
      accentMain: '#c084fc',
      accentAlt: '#e879f9',
      glitchColor: '#ec4899',
      warningColor: '#f472b6'
    },
    materials: {
      woodBase: '#9333ea',
      woodBorder: '#c084fc',
      stoneBase: '#6d28d9',
      stoneBorder: '#e879f9',
      paperBase: '#e9d5ff',
      paperText: '#4c0519'
    },
    typography: {
      fontFamily: "'Quicksand', sans-serif",
      headingFamily: "'Quicksand', sans-serif",
      fontSize: {
        xs: '13px',
        sm: '14px',
        base: '15px',
        lg: '18px',
        xl: '22px'
      },
      fontWeight: {
        normal: 300,
        bold: 500,
        heavy: 700
      }
    },
    shadows: {
      sm: '0 0 12px rgba(200, 132, 252, 0.3)',
      md: '0 0 24px rgba(232, 121, 249, 0.4)',
      lg: '0 0 48px rgba(192, 132, 252, 0.5)'
    },
    animations: {
      transitionSpeed: '0.5s',
      pulseSpeed: '4s'
    }
  }
};

class ThemeManager {
  private static instance: ThemeManager;
  private currentCodec: NarrativeCodec = 'CODENAME_GLITCH';
  private listeners: Set<(codec: NarrativeCodec) => void> = new Set();

  private constructor() {
    // Load persisted theme from localStorage or use default (only in browser)
    if (typeof window !== 'undefined') {
      const persisted = this.loadPersistedTheme();
      if (persisted) {
        this.currentCodec = persisted;
      }
      this.applyCodec(this.currentCodec);
    }
  }

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  /**
   * Load the previously selected codec from localStorage
   */
  private loadPersistedTheme(): NarrativeCodec | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage?.getItem('isekai:narrativeCodec');
      if (stored && Object.keys(CODECS).includes(stored)) {
        return stored as NarrativeCodec;
      }
    } catch (error) {
      console.warn('[ThemeManager] Failed to load persisted theme:', error);
    }
    return null;
  }

  /**
   * Persist theme choice to localStorage
   */
  private persistTheme(codec: NarrativeCodec): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage?.setItem('isekai:narrativeCodec', codec);
    } catch (error) {
      console.warn('[ThemeManager] Failed to persist theme:', error);
    }
  }

  /**
   * Apply codec by injecting CSS custom properties into :root
   */
  private applyCodec(codec: NarrativeCodec): void {
    if (typeof window === 'undefined') return;
    const definition = CODECS[codec];
    if (!definition) {
      console.error('[ThemeManager] Unknown codec:', codec);
      return;
    }

    const root = document.documentElement;
    const vars = definition.colors;
    const typo = definition.typography;
    const shadow = definition.shadows;
    const anim = definition.animations;
    const mats = definition.materials;

    // Colors
    root.style.setProperty('--bg-primary', vars.bgPrimary);
    root.style.setProperty('--bg-secondary', vars.bgSecondary);
    root.style.setProperty('--bg-tertiary', vars.bgTertiary);
    root.style.setProperty('--border-accent', vars.borderAccent);
    root.style.setProperty('--border-secondary', vars.borderSecondary);
    root.style.setProperty('--text-primary', vars.textPrimary);
    root.style.setProperty('--text-secondary', vars.textSecondary);
    root.style.setProperty('--accent-main', vars.accentMain);
    root.style.setProperty('--accent-alt', vars.accentAlt);
    root.style.setProperty('--glitch-color', vars.glitchColor);
    root.style.setProperty('--warning-color', vars.warningColor);

    // Materials (Phase 33)
    if (mats) {
      root.style.setProperty('--mat-wood-base', mats.woodBase || '#3d2b1f');
      root.style.setProperty('--mat-wood-border', mats.woodBorder || '#5c4033');
      root.style.setProperty('--mat-stone-base', mats.stoneBase || '#2a2a2e');
      root.style.setProperty('--mat-stone-border', mats.stoneBorder || '#5c5c5c');
      root.style.setProperty('--mat-paper-base', mats.paperBase || '#f4e4bc');
      root.style.setProperty('--mat-paper-text', mats.paperText || '#2a2a2a');
    }

    // Typography
    root.style.setProperty('--font-family-body', typo.fontFamily);
    root.style.setProperty('--font-family-heading', typo.headingFamily);
    root.style.setProperty('--font-size-xs', typo.fontSize.xs);
    root.style.setProperty('--font-size-sm', typo.fontSize.sm);
    root.style.setProperty('--font-size-base', typo.fontSize.base);
    root.style.setProperty('--font-size-lg', typo.fontSize.lg);
    root.style.setProperty('--font-size-xl', typo.fontSize.xl);
    root.style.setProperty('--font-weight-normal', String(typo.fontWeight.normal));
    root.style.setProperty('--font-weight-bold', String(typo.fontWeight.bold));
    root.style.setProperty('--font-weight-heavy', String(typo.fontWeight.heavy));

    // Shadows
    root.style.setProperty('--shadow-sm', shadow.sm);
    root.style.setProperty('--shadow-md', shadow.md);
    root.style.setProperty('--shadow-lg', shadow.lg);

    // Animations
    root.style.setProperty('--transition-speed', anim.transitionSpeed);
    root.style.setProperty('--pulse-speed', anim.pulseSpeed);

    console.log('[ThemeManager] Applied codec:', codec);
  }

  /**
   * Set the current narrative codec
   */
  setCodec(codec: NarrativeCodec): void {
    if (!Object.keys(CODECS).includes(codec)) {
      console.error('[ThemeManager] Unknown codec:', codec);
      return;
    }

    this.currentCodec = codec;
    this.applyCodec(codec);
    this.persistTheme(codec);

    // Notify all listeners
    this.listeners.forEach(listener => listener(codec));
  }

  /**
   * Get the current narrative codec
   */
  getCodec(): NarrativeCodec {
    return this.currentCodec;
  }

  /**
   * Get definition for a specific codec
   */
  getCodecDefinition(codec: NarrativeCodec): CodecDefinition {
    return CODECS[codec];
  }

  /**
   * Get all available codecs
   */
  getAllCodecs(): NarrativeCodec[] {
    return Object.keys(CODECS) as NarrativeCodec[];
  }

  /**
   * Subscribe to codec changes
   */
  subscribe(listener: (codec: NarrativeCodec) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Apply paradox-induced glitch state (temporarily override colors)
   * Returns a cleanup function to restore original theme
   */
  applyParadoxGlitch(intensity: number): () => void {
    if (typeof window === 'undefined') return () => {};
    const root = document.documentElement;
    const original = {
      bgPrimary: root.style.getPropertyValue('--bg-primary'),
      borderAccent: root.style.getPropertyValue('--border-accent')
    };

    if (intensity > 60) {
      // Heavy glitch: swap colors randomly
      root.style.setProperty('--bg-primary', `rgba(255, 0, 196, ${intensity / 300})`);
      root.style.setProperty('--border-accent', '#00ffff');
    } else if (intensity > 30) {
      // Light glitch: tint colors
      root.style.setProperty('--bg-primary', `rgba(255, 0, 196, ${intensity / 500})`);
    }

    // Return cleanup function
    return () => {
      root.style.setProperty('--bg-primary', original.bgPrimary);
      root.style.setProperty('--border-accent', original.borderAccent);
    };
  }

  /**
   * Get CSS variable declaration string for preview purposes
   */
  getCodecPreviewCSS(codec: NarrativeCodec): string {
    const def = CODECS[codec];
    const vars = def.colors;
    return `
      --bg-primary: ${vars.bgPrimary};
      --border-accent: ${vars.borderAccent};
      --text-primary: ${vars.textPrimary};
      --accent-main: ${vars.accentMain};
    `;
  }
}

// Export singleton instance
export const themeManager = ThemeManager.getInstance();
