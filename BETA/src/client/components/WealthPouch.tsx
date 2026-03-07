/**
 * WealthPouch.tsx - Phase 46: Material Wealth Tracking
 * 
 * 3D pouch asset displaying player's wealth in multiple currencies.
 * Currency labels and icons adapt based on the active Narrative Codec.
 */

import React, { useMemo } from 'react';
import type { NarrativeCodec } from '../services/themeManager';

export interface WealthPouchProps {
  gold: number;
  credits: number;
  scrip: number;
  currentCodec: NarrativeCodec;
  onChange?: (currency: 'gold' | 'credits' | 'scrip', newAmount: number) => void;
}

export const WealthPouch: React.FC<WealthPouchProps> = ({
  gold,
  credits,
  scrip,
  currentCodec,
  onChange
}) => {
  // Get codec-specific currency metadata
  const getCurrencyMetadata = useMemo(() => {
    const metadata: Record<NarrativeCodec, {
      primary: { name: string; icon: string; color: string };
      secondary: { name: string; icon: string; color: string };
      tertiary: { name: string; icon: string; color: string };
      pouch: { label: string; style: string };
    }> = {
      'CODENAME_MEDIEVAL': {
        primary: { name: 'Gold Crowns', icon: '👑', color: '#d4af37' },
        secondary: { name: 'Silver Marks', icon: '⚱️', color: '#c0c0c0' },
        tertiary: { name: 'Copper Bits', icon: '🪙', color: '#b87333' },
        pouch: { label: 'LEATHER POUCH', style: 'leather' }
      },
      'CODENAME_CYBERPUNK': {
        primary: { name: 'Crypt-Creds', icon: '💿', color: '#00ff41' },
        secondary: { name: 'DATA-SHARDS', icon: '📦', color: '#00ccff' },
        tertiary: { name: 'PROC-TOKENS', icon: '⚙️', color: '#ffff00' },
        pouch: { label: 'HOLO-WALLET', style: 'digital' }
      },
      'CODENAME_NOIR': {
        primary: { name: 'Cold Cash', icon: '💵', color: '#d3d3d3' },
        secondary: { name: 'Hot Stamps', icon: '🎫', color: '#a9a9a9' },
        tertiary: { name: 'Scrip', icon: '📄', color: '#808080' },
        pouch: { label: 'THICK STASH', style: 'worn' }
      },
      'CODENAME_GLITCH': {
        primary: { name: '₩₹₰₳', icon: '◆', color: '#ff00ff' },
        secondary: { name: 'F₹₲₰̸', icon: '▲', color: '#00ffff' },
        tertiary: { name: '₳̸₰₳̸', icon: '✕', color: '#ffff00' },
        pouch: { label: 'FRACTURED STORE', style: 'glitched' }
      },
      'CODENAME_STORYBOOK': {
        primary: { name: 'Gold Talents', icon: '✨', color: '#ffd700' },
        secondary: { name: 'Silver Talents', icon: '🌟', color: '#c0c0c0' },
        tertiary: { name: 'Bronze Talents', icon: '◊', color: '#cd7f32' },
        pouch: { label: 'ENCHANTED PURSE', style: 'ornate' }
      },
      'CODENAME_MINIMAL': {
        primary: { name: 'Credits', icon: '●', color: '#333333' },
        secondary: { name: 'Units', icon: '○', color: '#666666' },
        tertiary: { name: 'Points', icon: '◌', color: '#999999' },
        pouch: { label: 'WALLET', style: 'clean' }
      },
      'CODENAME_SOLARPUNK': {
        primary: { name: 'Seed Credits', icon: '🌱', color: '#00b050' },
        secondary: { name: 'Sol-Marks', icon: '☀️', color: '#ffd700' },
        tertiary: { name: 'Leaf-Scrip', icon: '🍃', color: '#7cb342' },
        pouch: { label: 'LIVING PURSE', style: 'green' }
      },
      'CODENAME_VOIDSYNC': {
        primary: { name: 'Void Echoes', icon: '●', color: '#cc99ff' },
        secondary: { name: 'Echoes', icon: '◐', color: '#9966ff' },
        tertiary: { name: 'Shadows', icon: '◑', color: '#6633ff' },
        pouch: { label: 'VOID CONTAINER', style: 'ethereal' }
      },
      'CODENAME_OVERLAND': {
        primary: { name: 'Merchant Gold', icon: '🏪', color: '#daa520' },
        secondary: { name: 'Trade Routes', icon: '🛤️', color: '#8b6914' },
        tertiary: { name: 'Passage', icon: '🧭', color: '#cd853f' },
        pouch: { label: 'CARAVAN CHEST', style: 'weathered' }
      },
      'CODENAME_VINTAGE': {
        primary: { name: 'Brass Credits', icon: '⚙️', color: '#cd7f32' },
        secondary: { name: 'Copper Marks', icon: '⚡', color: '#b87333' },
        tertiary: { name: 'Steam-Bits', icon: '💨', color: '#8b4513' },
        pouch: { label: 'GEAR VAULT', style: 'mechanical' }
      },
      'CODENAME_DREAMSCAPE': {
        primary: { name: 'Dream Essence', icon: '🌙', color: '#b19cd9' },
        secondary: { name: 'Starlight', icon: '⭐', color: '#e6ccff' },
        tertiary: { name: 'Whispers', icon: '💫', color: '#d8bfd8' },
        pouch: { label: 'TWILIGHT POUCH', style: 'ethereal' }
      }
    };

    return metadata[currentCodec] || metadata['CODENAME_MEDIEVAL'];
  }, [currentCodec]);

  const getPouchStyle = (): React.CSSProperties => {
    const styles: Record<string, React.CSSProperties> = {
      leather: {
        backgroundColor: '#3d2817',
        border: '2px solid #8b7355',
        boxShadow: '0 4px 12px rgba(139, 115, 85, 0.4), inset 0 1px 3px rgba(255,255,255,0.1)'
      },
      digital: {
        backgroundColor: '#0a0a0a',
        border: '1px solid #00ff41',
        boxShadow: '0 0 10px rgba(0, 255, 65, 0.3), inset 0 0 10px rgba(0, 255, 65, 0.05)'
      },
      worn: {
        backgroundColor: '#2a2a2a',
        border: '2px dashed #8a7a6a',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.6)'
      },
      glitched: {
        backgroundColor: '#1a001a',
        border: '1px solid #ff00ff',
        boxShadow: '0 0 8px rgba(255, 0, 255, 0.4), 1px 1px 0px #ff00ff'
      },
      ornate: {
        backgroundColor: '#8b6914',
        border: '2px solid #d4af37',
        boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3), inset 0 0 8px rgba(212, 175, 55, 0.1)'
      },
      clean: {
        backgroundColor: '#eeeeee',
        border: '1px solid #cccccc',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)'
      },
      green: {
        backgroundColor: '#1a5c3a',
        border: '2px solid #00b050',
        boxShadow: '0 0 8px rgba(0, 176, 80, 0.25), inset 0 0 8px rgba(0, 176, 80, 0.05)'
      },
      ethereal: {
        backgroundColor: '#001a33',
        border: '1px solid #6600ff',
        boxShadow: '0 0 8px rgba(102, 0, 255, 0.3), inset 0 0 8px rgba(102, 0, 255, 0.05)'
      },
      weathered: {
        backgroundColor: '#4a3a2a',
        border: '2px solid #8b6914',
        boxShadow: '0 2px 8px rgba(139, 105, 20, 0.3)'
      },
      mechanical: {
        backgroundColor: '#3a3a2a',
        border: '2px solid #cd7f32',
        boxShadow: '0 2px 8px rgba(205, 133, 63, 0.3)'
      }
    };

    return styles[getCurrencyMetadata.pouch.style] || styles.leather;
  };

  const getCurrencyColor = (type: 'primary' | 'secondary' | 'tertiary'): string => {
    return getCurrencyMetadata[type].color;
  };

  const CurrencyDisplay = ({ 
    amount, 
    name, 
    icon, 
    color 
  }: { 
    amount: number; 
    name: string; 
    icon: string; 
    color: string;
  }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 0',
        fontSize: '13px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        paddingBottom: '6px',
        marginBottom: '6px'
      }}
    >
      <div style={{ fontSize: '16px', minWidth: '20px' }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '10px', opacity: 0.6 }}>{name}</div>
        <div style={{ fontWeight: 'bold', color: color }}>
          {amount.toLocaleString()}
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        ...getPouchStyle(),
        borderRadius: '6px',
        padding: '12px',
        width: '200px',
        color: 'inherit',
        fontFamily: 'inherit'
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: '11px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '10px',
          opacity: 0.8,
          textAlign: 'center'
        }}
      >
        {getCurrencyMetadata.pouch.label}
      </div>

      {/* Currency displays */}
      <CurrencyDisplay
        amount={gold}
        name={getCurrencyMetadata.primary.name}
        icon={getCurrencyMetadata.primary.icon}
        color={getCurrencyMetadata.primary.color}
      />

      <CurrencyDisplay
        amount={credits}
        name={getCurrencyMetadata.secondary.name}
        icon={getCurrencyMetadata.secondary.icon}
        color={getCurrencyMetadata.secondary.color}
      />

      <CurrencyDisplay
        amount={scrip}
        name={getCurrencyMetadata.tertiary.name}
        icon={getCurrencyMetadata.tertiary.icon}
        color={getCurrencyMetadata.tertiary.color}
      />

      {/* Total indicator */}
      <div
        style={{
          fontSize: '11px',
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          textAlign: 'center',
          opacity: 0.65
        }}
      >
        Total Assets: {(gold + credits + scrip).toLocaleString()}
      </div>
    </div>
  );
};
