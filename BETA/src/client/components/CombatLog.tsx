import React, { useMemo } from 'react';

interface CombatLogProps {
  events?: any[];
  maxEntries?: number;
}

export default function CombatLog({ events = [], maxEntries = 10 }: CombatLogProps) {
  // Filter only combat-related events from the event list
  const combatEvents = useMemo(() => {
    const combat = events
      .filter((e: any) =>
        e.type.includes('COMBAT_') || e.type.includes('PLAYER_')
      )
      .slice(0, maxEntries);
    return combat;
  }, [events, maxEntries]);

  // Map event types to visual styles
  const getEventStyle = (eventType: string) => {
    const baseStyle = {
      padding: '6px 8px',
      borderRadius: 3,
      fontSize: 12,
      marginBottom: 4,
      fontWeight: 500 as const,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    };

    switch (eventType) {
      case 'COMBAT_HIT':
        return {
          ...baseStyle,
          backgroundColor: '#ffcdd2',
          color: '#b71c1c',
          label: '⚔️ HIT'
        };
      case 'COMBAT_MISS':
        return {
          ...baseStyle,
          backgroundColor: '#f5f5f5',
          color: '#666',
          label: '❌ MISS'
        };
      case 'COMBAT_DODGE':
        return {
          ...baseStyle,
          backgroundColor: '#c8e6c9',
          color: '#1b5e20',
          label: '🏃 DODGE'
        };
      case 'COMBAT_BLOCK':
        return {
          ...baseStyle,
          backgroundColor: '#bbdefb',
          color: '#0d47a1',
          label: '🛡️ BLOCK'
        };
      case 'COMBAT_PARRY':
        return {
          ...baseStyle,
          backgroundColor: '#ffe0b2',
          color: '#e65100',
          label: '⚡ PARRY'
        };
      case 'PLAYER_HEALED':
        return {
          ...baseStyle,
          backgroundColor: '#f8bbd0',
          color: '#880e4f',
          label: '💊 HEALED'
        };
      case 'PLAYER_REST':
        return {
          ...baseStyle,
          backgroundColor: '#d1c4e9',
          color: '#512da8',
          label: '😴 REST'
        };
      case 'HAZARD_DAMAGE':
        return {
          ...baseStyle,
          backgroundColor: '#ffccbc',
          color: '#bf360c',
          label: '⚠️ HAZARD'
        };
      case 'STATUS_APPLIED':
        return {
          ...baseStyle,
          backgroundColor: '#f0f4c3',
          color: '#9e9d24',
          label: '🔗 STATUS'
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: '#eceff1',
          color: '#37474f',
          label: eventType
        };
    }
  };

  if (combatEvents.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#999', padding: 8 }}>
        <em>No combat events yet</em>
      </div>
    );
  }

  return (
    <div style={{ fontSize: 12 }}>
      {combatEvents.map((event: any, idx: number) => {
        const style = getEventStyle(event.type);
        const { label, ...containerStyle } = style as any;

        let detail = '';
        if (event.payload?.damage) {
          detail = `-${event.payload.damage} HP`;
        } else if (event.payload?.hpRestored) {
          detail = `+${event.payload.hpRestored} HP`;
        } else if (event.payload?.damageReduced) {
          detail = `Reduced: -${event.payload.damageReduced}`;
        } else if (event.payload?.counterDamage) {
          detail = `Counter: ${event.payload.counterDamage} dmg`;
        }

        const timestamp = new Date(event.timestamp).toLocaleTimeString();

        return (
          <div key={idx} style={containerStyle}>
            <span>
              <strong>{label}</strong>
              {detail && <span style={{ marginLeft: 8, opacity: 0.9 }}>{detail}</span>}
            </span>
            <span style={{ fontSize: 11, opacity: 0.7 }}>{timestamp}</span>
          </div>
        );
      })}
    </div>
  );
}
