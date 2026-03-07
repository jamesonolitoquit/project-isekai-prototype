/**
 * Phase 41: Tactical Intent Overlay
 *
 * Purpose: Display NPC intent icons above combatants on the 3D board
 * 
 * Design:
 * - Subscribes to appState.npcs and their intent fields
 * - Renders "Intent Icons" above each NPC when in combat
 * - Icons change based on:
 *   1. The action type (attack, defend, heal, flee, cast-spell)
 *   2. The active narrative codec (Medieval, Noir, Cyberpunk, etc.)
 * - Icons are color-coded by intensity (0-100) to show commitment level
 * 
 * Codec-Specific Icons:
 * - **Medieval**: Sword (attack), Shield (defend), Cross (heal), Legs (flee)
 * - **Noir**: Gun (attack), Eye (defensive), Briefcase (investigate), Back (flee)
 * - **Cyberpunk**: Wifi/Signal (attack), Lock (defend), Monitor (hack), Exit (flee)
 * - **Glitch**: Skull (attack), Matrix (defend), Circuit (hack), Glitch effect (flee)
 * - **Dreamscape**: Star (attack), Moon (defend), Crystal (heal), Portal (flee)
 * - **Default**: Generic sword (attack), shield (defend), plus (heal), arrow (flee)
 * 
 * Lifecycle:
 * 1. Component mounts and subscribes to appState changes
 * 2. Filters NPCs that have valid intent fields
 * 3. Renders icon above each NPC, positioned relative to their 3D board position
 * 4. On unmount, cleans up subscription
 */

import React, { useState, useEffect, useMemo } from 'react';

interface IntentIcon {
  npcId: string;
  actionType: string;
  intensity: number; // 0-100
  predictedDamage?: number;
  position?: { x: number; y: number }; // Relative screen position
}

interface TacticalOverlayProps {
  appState?: any;
  boardElement?: HTMLElement | null;
}

/**
 * Map action type to SVG icon for different codecs
 */
function getIntentIcon(actionType: string, codec: string | undefined): React.ReactNode {
  const codecFamily = codec?.toUpperCase() || 'MEDIEVAL';
  
  // Medieval codec: traditional fantasy icons
  if (codecFamily.includes('MEDIEVAL') || !codec) {
    return getMediaevalIcon(actionType);
  }
  
  // Noir codec: hardboiled detective icons
  if (codecFamily.includes('NOIR')) {
    return getNoirIcon(actionType);
  }
  
  // Cyberpunk codec: tech/hacker icons
  if (codecFamily.includes('CYBERPUNK')) {
    return getCyberpunkIcon(actionType);
  }
  
  // Glitch codec: corrupted/digital icons
  if (codecFamily.includes('GLITCH')) {
    return getGlitchIcon(actionType);
  }
  
  // Dreamscape codec: ethereal/mystical icons
  if (codecFamily.includes('DREAMSCAPE')) {
    return getDeamscapeIcon(actionType);
  }
  
  // Solarpunk codec: eco-friendly icons
  if (codecFamily.includes('SOLARPUNK')) {
    return getSolarpunkIcon(actionType);
  }
  
  // Default fallback
  return getDefaultIcon(actionType);
}

/**
 * Medieval codec icons
 */
function getMediaevalIcon(actionType: string): React.ReactNode {
  switch (actionType) {
    case 'attack':
      return <SwordIcon />;
    case 'defend':
      return <ShieldIcon />;
    case 'heal':
      return <CrossIcon />;
    case 'cast-spell':
      return <WandIcon />;
    case 'surrender':
      return <WhiteFlagIcon />;
    case 'flee':
      return <RunningLegsIcon />;
    default:
      return <QuestionMarkIcon />;
  }
}

/**
 * Noir codec icons
 */
function getNoirIcon(actionType: string): React.ReactNode {
  switch (actionType) {
    case 'attack':
      return <GunIcon />;
    case 'defend':
      return <EyeIcon />;
    case 'heal':
      return <MedKitIcon />;
    case 'cast-spell':
      return <OfficeBriefcaseIcon />;
    case 'surrender':
      return <HandsUpIcon />;
    case 'flee':
      return <ExitSignIcon />;
    default:
      return <CigaretteIcon />;
  }
}

/**
 * Cyberpunk codec icons
 */
function getCyberpunkIcon(actionType: string): React.ReactNode {
  switch (actionType) {
    case 'attack':
      return <WifiSignalIcon />;
    case 'defend':
      return <LockClosedIcon />;
    case 'heal':
      return <MonitorIcon />;
    case 'cast-spell':
      return <CircuitIcon />;
    case 'surrender':
      return <ShutdownIcon />;
    case 'flee':
      return <ExitPortIcon />;
    default:
      return <GlitchSquareIcon />;
  }
}

/**
 * Glitch codec icons
 */
function getGlitchIcon(actionType: string): React.ReactNode {
  switch (actionType) {
    case 'attack':
      return <SkullIcon />;
    case 'defend':
      return <MatrixIcon />;
    case 'heal':
      return <NullByteIcon />;
    case 'cast-spell':
      return <CorruptedDataIcon />;
    case 'surrender':
      return <StaticNoiseIcon />;
    case 'flee':
      return <SegmentationFaultIcon />;
    default:
      return <GlitchWaveformIcon />;
  }
}

/**
 * Dreamscape codec icons
 */
function getDeamscapeIcon(actionType: string): React.ReactNode {
  switch (actionType) {
    case 'attack':
      return <StarIcon />;
    case 'defend':
      return <MoonIcon />;
    case 'heal':
      return <CrystalIcon />;
    case 'cast-spell':
      return <MysteryBoxIcon />;
    case 'surrender':
      return <PeaceDoveIcon />;
    case 'flee':
      return <PortalIcon />;
    default:
      return <NebulaIcon />;
  }
}

/**
 * Solarpunk codec icons
 */
function getSolarpunkIcon(actionType: string): React.ReactNode {
  switch (actionType) {
    case 'attack':
      return <SunIcon />;
    case 'defend':
      return <LeafIcon />;
    case 'heal':
      return <FlowerIcon />;
    case 'cast-spell':
      return <TreeIcon />;
    case 'surrender':
      return <HandshakeIcon />;
    case 'flee':
      return <BirdIcon />;
    default:
      return <SproutIcon />;
  }
}

/**
 * Default codec icons (fallback)
 */
function getDefaultIcon(actionType: string): React.ReactNode {
  switch (actionType) {
    case 'attack':
      return <SwordIcon />;
    case 'defend':
      return <ShieldIcon />;
    case 'heal':
      return <PlusIcon />;
    case 'cast-spell':
      return <SparklesIcon />;
    case 'flee':
      return <ArrowIcon />;
    default:
      return <CircleIcon />;
  }
}

// SVG Icon Components
const SwordIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 2L14 8H10L12 2M8 9H16L15 22H9L8 9"></path>
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 2C12 2 6 5 6 10V15C6 20 12 22 12 22C12 22 18 20 18 15V10C18 5 12 2 12 2Z"></path>
  </svg>
);

const CrossIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="2" fill="none"></path>
  </svg>
);

const WandIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M4 4L8 8L12 4L16 8L20 4L18 12L20 20L12 18L4 20L6 12L4 4M12 12L14 14"></path>
  </svg>
);

const WhiteFlagIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M4 2V20H6V12L14 10V18H16V2L6 4V8L4 2"></path>
  </svg>
);

const RunningLegsIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M8 2C9 2 10 3 10 4C10 5 9 6 8 6C7 6 6 5 6 4C6 3 7 2 8 2M6 7L8 12L6 13L4 10L3 14L5 15L4 20L6 20L7 15L10 14L8 8L10 10L13 14L12 20L14 20L15 14L18 11L20 14L22 12L19 8L21 7L18 6L16 8L14 4L12 6L10 8L6 7"></path>
  </svg>
);

const QuestionMarkIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <text x="12" y="16" fontSize="16" textAnchor="middle">?</text>
  </svg>
);

const GunIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M4 12H14L16 10L20 14L16 18L14 16H4V14H14L14 12Z"></path>
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 5C6 5 2 12 2 12C2 12 6 19 12 19C18 19 22 12 22 12C22 12 18 5 12 5M12 15C14 15 15 13.65 15 12C15 10.35 14 9 12 9C10 9 9 10.35 9 12C9 13.65 10 15 12 15Z"></path>
  </svg>
);

const MedKitIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2"></rect>
    <path d="M12 8V16M8 12H16" stroke="currentColor" strokeWidth="2" fill="none"></path>
  </svg>
);

const OfficeBriefcaseIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M8 2H16V4H22V20H2V4H8V2M12 6V10"></path>
  </svg>
);

const HandsUpIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M8 8V2L10 6V8M12 8V2L12 8M16 8V2L14 6V8M8 8H16V20H8M6 12H8M16 12H18"></path>
  </svg>
);

const ExitSignIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <rect x="2" y="3" width="20" height="18" rx="1"></rect>
  </svg>
);

const CigaretteIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M4 10H18L20 8L20 14L18 12H4V10"></path>
  </svg>
);

const WifiSignalIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 18C13.1 18 14 18.9 14 20C14 21.1 13.1 22 12 22C10.9 22 10 21.1 10 20C10 18.9 10.9 18 12 18M12 14C10.3 14 8.7 14.6 7.571 15.689L9.16 17.278C9.88 16.85 10.9 16.63 12 16.63C13.1 16.63 14.12 16.85 14.84 17.278L16.429 15.689C15.3 14.6 13.7 14 12 14M12 10C9.06 10 6.3 10.9 4.04 12.6L5.76 14.31C7.48 13.16 9.63 12.45 12 12.45C14.37 12.45 16.52 13.16 18.24 14.31L19.96 12.6C17.7 10.9 14.94 10 12 10Z"></path>
  </svg>
);

const LockClosedIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <rect x="5" y="11" width="14" height="10" rx="1"></rect>
    <path d="M8 10V7C8 4.24 10.24 2 13 2C15.76 2 18 4.24 18 7V10M12 14V18" stroke="currentColor" strokeWidth="2" fill="none"></path>
  </svg>
);

const MonitorIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <rect x="2" y="2" width="20" height="14" rx="1"></rect>
    <path d="M6 16H18M10 20H14" stroke="currentColor" strokeWidth="2" fill="none"></path>
  </svg>
);

const CircuitIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <circle cx="6" cy="6" r="2"></circle>
    <circle cx="18" cy="6" r="2"></circle>
    <circle cx="6" cy="18" r="2"></circle>
    <circle cx="18" cy="18" r="2"></circle>
    <path d="M6 8V16M8 18H16M18 8V16M16 6H8" stroke="currentColor" strokeWidth="1" fill="none"></path>
  </svg>
);

const ShutdownIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M13 3H11V11H13V3M5 5C3 7 2 9.5 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 9.5 21 7 19 5"></path>
  </svg>
);

const ExitPortIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M4 2H20L18 12L20 22H4L6 12L4 2M8 8H16M8 16H16"></path>
  </svg>
);

const GlitchSquareIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <rect x="4" y="4" width="16" height="16"></rect>
    <path d="M6 6H18M6 18H18M6 6V18M18 6V18" stroke="#666" strokeWidth="1" opacity="0.5"></path>
  </svg>
);

const SkullIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <circle cx="9" cy="10" r="2"></circle>
    <circle cx="15" cy="10" r="2"></circle>
    <path d="M7 5C5 5 4 6 4 8C4 10 5 12 7 13L7 18H17L17 13C19 12 20 10 20 8C20 6 19 5 17 5C17 3 15 2 12 2C9 2 7 3 7 5Z"></path>
  </svg>
);

const MatrixIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <text x="4" y="8" fontSize="6">01</text>
    <text x="10" y="8" fontSize="6">10</text>
    <text x="16" y="8" fontSize="6">11</text>
    <text x="4" y="14" fontSize="6">10</text>
    <text x="10" y="14" fontSize="6">01</text>
    <text x="16" y="14" fontSize="6">10</text>
  </svg>
);

const NullByteIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <circle cx="12" cy="12" r="8"></circle>
    <path d="M12 6V18M6 12H18" stroke="white" strokeWidth="1" fill="none"></path>
  </svg>
);

const CorruptedDataIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M2 4H22V20H2V4M6 8H8M12 8H14M18 8H20M6 12H8M12 12H14M18 12H20M6 16H8M12 16H14M18 16H20" stroke="currentColor" strokeWidth="1" fill="none"></path>
  </svg>
);

const StaticNoiseIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <rect x="2" y="2" width="20" height="20" fill="white" opacity="0.2"></rect>
    <path d="M4 4L20 20M20 4L4 20" stroke="currentColor" strokeWidth="2"></path>
  </svg>
);

const SegmentationFaultIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M4 4L10 10L4 16M20 4L14 10L20 16" stroke="currentColor" strokeWidth="2" fill="none"></path>
    <path d="M10 8L14 8L12 14L10 8" fill="currentColor"></path>
  </svg>
);

const GlitchWaveformIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M2 12L6 8L10 14L14 6L18 12L22 8L22 16" stroke="currentColor" strokeWidth="2" fill="none"></path>
  </svg>
);

const StarIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 2L15 10H23L17 15L19 23L12 18L5 23L7 15L1 10H9L12 2Z"></path>
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"></path>
  </svg>
);

const CrystalIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 2L18 6V12L12 16L6 12V6L12 2M12 6L14 9L12 12L10 9L12 6"></path>
  </svg>
);

const MysteryBoxIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2"></rect>
  </svg>
);

const PeaceDoveIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M8 12C6 11 5 10 5 8C5 6 6 5 8 5C9 5 10 6 10 7M16 12C18 11 19 10 19 8C19 6 18 5 16 5C15 5 14 6 14 7M12 8L16 4M12 8L8 4M12 8V18L10 16L14 16L12 18"></path>
  </svg>
);

const PortalIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <circle cx="12" cy="12" r="8"></circle>
    <circle cx="12" cy="12" r="5" fill="white" opacity="0.3"></circle>
    <path d="M12 6L14 11L12 16L10 11L12 6" stroke="currentColor" strokeWidth="1" fill="none"></path>
  </svg>
);

const NebulaIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <circle cx="8" cy="8" r="3" opacity="0.6"></circle>
    <circle cx="16" cy="8" r="3" opacity="0.6"></circle>
    <circle cx="12" cy="16" r="3" opacity="0.6"></circle>
    <path d="M8 8L16 8L12 16L8 8" stroke="currentColor" strokeWidth="1" opacity="0.4" fill="none"></path>
  </svg>
);

const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <circle cx="12" cy="12" r="5"></circle>
    <path d="M12 1V3M23 12H21M3 12H1M20.49 3.51L19.07 4.93M4.93 19.07L3.51 20.49M20.49 20.49L19.07 19.07M4.93 4.93L3.51 3.51" stroke="currentColor" strokeWidth="1" fill="none"></path>
  </svg>
);

const LeafIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C12 18.67 14.67 16 18 16C21.33 16 24 18.67 24 22C24 19.41 22.84 17.12 21 15.65C22.7 14.47 24 12.4 24 9.95C24 8.27 23.46 6.72 22.55 5.47C21.64 4.22 20.37 3.34 19 2.98M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12Z"></path>
  </svg>
);

const FlowerIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <circle cx="12" cy="12" r="2"></circle>
    <circle cx="12" cy="5" r="2"></circle>
    <circle cx="12" cy="19" r="2"></circle>
    <circle cx="5" cy="12" r="2"></circle>
    <circle cx="19" cy="12" r="2"></circle>
    <circle cx="7.07" cy="7.07" r="2"></circle>
    <circle cx="16.93" cy="16.93" r="2"></circle>
    <circle cx="16.93" cy="7.07" r="2"></circle>
    <circle cx="7.07" cy="16.93" r="2"></circle>
  </svg>
);

const TreeIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 2L14 8H18L14 11L16 17H12L8 14L4 17H8L10 11L6 8H10L12 2M11 19H13V22H11V19"></path>
  </svg>
);

const HandshakeIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M17 10C15.9 10 15 9.1 15 8C15 6.9 15.9 6 17 6C18.1 6 19 6.9 19 8C19 9.1 18.1 10 17 10M7 10C5.9 10 5 9.1 5 8C5 6.9 5.9 6 7 6C8.1 6 9 6.9 9 8C9 9.1 8.1 10 7 10M5 12H3V14C3 15.1 3.9 16 5 16H9L7 14L5 12M19 12L17 14L21 14H23V12H19M9 14L7 16H19L17 14H9"></path>
  </svg>
);

const BirdIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M23 11.5C23 11.5 18 6 12 6C6 6 1 11.5 1 11.5C1 11.5 6 17 12 17C18 17 23 11.5 23 11.5M12 8C14.76 8 17 10.24 17 13C17 15.76 14.76 18 12 18C9.24 18 7 15.76 7 13C7 10.24 9.24 8 12 8M12 10C10.34 10 9 11.34 9 13C9 14.66 10.34 16 12 16C13.66 16 15 14.66 15 13C15 11.34 13.66 10 12 10Z"></path>
  </svg>
);

const SproutIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 2C10.9 2 10 2.9 10 4V8C10 9.1 10.9 10 12 10C13.1 10 14 9.1 14 8V4C14 2.9 13.1 2 12 2M8 12C6.9 12 6 12.9 6 14C6 15.1 6.9 16 8 16H12V14C12 12.9 11.1 12 10 12H8M16 12C14.9 12 14 12.9 14 14V16H18C19.1 16 20 15.1 20 14C20 12.9 19.1 12 18 12H16M12 18V22M7 22H17"></path>
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="2" fill="none"></path>
  </svg>
);

const SparklesIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 2L15 10H23L17 15L19 23L12 18L5 23L7 15L1 10H9L12 2"></path>
  </svg>
);

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M5 12H19M12 5L19 12L12 19" stroke="currentColor" strokeWidth="2" fill="none"></path>
  </svg>
);

const CircleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <circle cx="12" cy="12" r="10"></circle>
  </svg>
);

const TacticalOverlay: React.FC<TacticalOverlayProps> = ({ appState, boardElement }) => {
  const [intents, setIntents] = useState<IntentIcon[]>([]);

  useMemo(() => {
    // Extract intent data from NPCs in combat
    if (!appState?.npcs || !appState?.combatState?.active) {
      setIntents([]);
      return;
    }

    const inCombatNpcs = appState.npcs
      .filter((npc: any) => appState.combatState?.participants?.includes(npc.id))
      .filter((npc: any) => npc.intent); // Only NPCs with intent

    const newIntents: IntentIcon[] = inCombatNpcs.map((npc: any) => ({
      npcId: npc.id,
      actionType: npc.intent.actionTypeId,
      intensity: npc.intent.intensity,
      predictedDamage: npc.intent.predictedDamage
    }));

    setIntents(newIntents);
  }, [appState?.npcs, appState?.combatState?.active, appState?.combatState?.participants]);

  if (!appState?.combatState?.active) {
    return null;
  }

  const currentCodec = appState?.player?.currentCodec;

  return (
    <div className="tactical-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 500 }}>
      {intents.map((intent) => (
        <IntentIcon
          key={intent.npcId}
          intent={intent}
          codec={currentCodec}
          npc={appState.npcs.find((n: any) => n.id === intent.npcId)}
        />
      ))}
    </div>
  );
};

/**
 * Individual intent icon renderer
 */
const IntentIcon: React.FC<{ intent: IntentIcon; codec?: string; npc?: any }> = ({ intent, codec, npc }) => {
  const intensityColor = getIntensityColor(intent.intensity);
  const iconElement = getIntentIcon(intent.actionType, codec);

  // Rough calculation of NPC position on screen (would need actual 3D board data for precision)
  const tooltipText = `${intent.actionType.toUpperCase()}${intent.predictedDamage ? ` (${intent.predictedDamage} DMG)` : ''}`;

  return (
    <div
      className="intent-icon"
      title={tooltipText}
      style={{
        position: 'absolute',
        left: `${Math.random() * 100}%`, // Placeholder - should use actual NPC position
        top: `${Math.random() * 100}%`,
        width: '40px',
        height: '40px',
        backgroundColor: intensityColor,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px solid white',
        boxShadow: `0 0 10px ${intensityColor}`,
        transform: 'translate(-50%, -50%)',
        color: 'white',
        cursor: 'help'
      }}
    >
      {iconElement}
    </div>
  );
};

/**
 * Get color based on action intensity (0-100)
 */
function getIntensityColor(intensity: number): string {
  if (intensity >= 80) return '#ff3333'; // High intensity - red (aggressive)
  if (intensity >= 60) return '#ff9900'; // Medium-high - orange (committed)
  if (intensity >= 40) return '#ffff00'; // Medium - yellow (neutral)
  if (intensity >= 20) return '#66ff66'; // Low - light green (conservative)
  return '#3366ff'; // Very low - blue (passive)
}

export default TacticalOverlay;
