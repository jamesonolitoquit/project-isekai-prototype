import React, { useState, useMemo } from 'react';
import type { SoulEcho } from '../../engine/legacyEngine';

/**
 * M47-A2: The Soul Mirror (Legacy UI)
 * 
 * Visualizes inherited Soul Echoes from ancestors.
 * Shows the "Spirit Trace" back to the ancestral hero, turning meta-progression
 * into a narrative journey through generations.
 */

interface SoulMirrorProps {
  character?: {
    id: string;
    name: string;
    generation: number; // Which generation (1 = no ancestry, 2+ = inherited)
  };
  unlockedSoulEchoes?: SoulEcho[];
  ancestralTree?: {
    [characterId: string]: {
      name: string;
      generation: number;
      deeds: string[];
      mythStatus: number;
    };
  };
  isDeveloperMode?: boolean;
  onEchoClick?: (echoId: string) => void;
}

interface DisplaySoulEcho {
  id: string;
  name: string;
  ancestorName: string;
  deedTriggered: string;
  echoType: 'relic_item' | 'ethereal_power' | 'bloodline_blessing' | 'ancestral_memory';
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  powerLevel: number; // 0-100
  mechanicalEffect: string;
  narrativeEffect: string;
  generationsSince: number; // How many generations back was the deed?
  bondStrength: number; // 0-100: how strong is the connection?
}

/**
 * Get color based on rarity tier
 */
function getRarityColor(rarity: string): { light: string; dark: string; text: string } {
  switch (rarity) {
    case 'legendary':
      return { light: '#fbbf24', dark: '#78350f', text: '#fef3c7' };
    case 'rare':
      return { light: '#a78bfa', dark: '#3f0f63', text: '#ede9fe' };
    case 'uncommon':
      return { light: '#60a5fa', dark: '#0c2d48', text: '#dbeafe' };
    default:
      return { light: '#6b7280', dark: '#1f2937', text: '#e5e7eb' };
  }
}

/**
 * Soul Echo Card - displays one echo with connection to ancestor
 */
function SoulEchoCard({
  echo,
  isExpanded,
  onToggle,
  isDeveloperMode
}: {
  echo: DisplaySoulEcho;
  isExpanded: boolean;
  onToggle: () => void;
  isDeveloperMode?: boolean;
}) {
  const colors = getRarityColor(echo.rarity);
  const bondStrength = echo.bondStrength || 50;

  return (
    <div
      style={{
        backgroundColor: colors.dark,
        border: `2px solid ${colors.light}`,
        borderRadius: '8px',
        padding: '14px',
        marginBottom: '14px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden'
      }}
      onClick={onToggle}
    >
      {/* Ancestral glow effect */}
      <div
        style={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.light}33 0%, transparent 70%)`,
          pointerEvents: 'none'
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header: Echo Name + Rarity */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <div>
            <h3 style={{ margin: 0, color: colors.text, fontSize: '16px', fontWeight: 'bold' }}>
              {echo.name}
            </h3>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '12px',
                color: colors.light,
                fontStyle: 'italic'
              }}
            >
              Inherited from {echo.ancestorName}
            </p>
          </div>

          {/* Rarity Badge */}
          <div
            style={{
              backgroundColor: colors.light,
              color: colors.dark,
              padding: '6px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap'
            }}
          >
            {echo.rarity}
          </div>
        </div>

        {/* Spirit Trace - Connection to ancestor */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '10px',
            fontSize: '12px'
          }}
        >
          <div style={{ color: '#9ca3af' }}>
            ✦ Spirit Trace:
          </div>
          <div
            style={{
              flex: 1,
              height: '3px',
              backgroundColor: '#374151',
              borderRadius: '2px',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${bondStrength}%`,
                backgroundColor: colors.light,
                borderRadius: '2px',
                transition: 'width 0.5s ease',
                boxShadow: `0 0 8px ${colors.light}80`
              }}
            />
          </div>
          <div style={{ color: '#9ca3af', fontSize: '11px', minWidth: '30px', textAlign: 'right' }}>
            {bondStrength}%
          </div>
        </div>

        {/* Generational distance */}
        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '10px' }}>
          {echo.generationsSince === 1
            ? '← Direct descendant of the deed'
            : `← ${echo.generationsSince} generations removed`}
        </div>

        {/* Deed that triggered this echo */}
        <div
          style={{
            backgroundColor: '#1f2937',
            padding: '8px',
            borderRadius: '4px',
            marginBottom: '10px',
            fontSize: '12px',
            color: '#d1d5db',
            borderLeft: `3px solid ${colors.light}`
          }}
        >
          <strong style={{ color: colors.light }}>The Deed:</strong> {echo.deedTriggered}
        </div>

        {/* Power Level Indicator */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>Power Level</span>
            <span style={{ fontSize: '12px', color: colors.light }}>{echo.powerLevel}/100</span>
          </div>
          <div
            style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#1e293b',
              borderRadius: '3px',
              overflow: 'hidden',
              border: `1px solid ${colors.light}40`
            }}
          >
            <div
              style={{
                width: `${echo.powerLevel}%`,
                height: '100%',
                backgroundColor: colors.light,
                borderRadius: '3px',
                transition: 'width 0.5s ease',
                boxShadow: `0 0 8px ${colors.light}80`
              }}
            />
          </div>
        </div>

        {/* Effects (Mechanical + Narrative) */}
        {isExpanded && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${colors.light}40` }}>
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: colors.light, marginBottom: '4px' }}>
                ⚔️ Mechanical Effect
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#d1d5db', lineHeight: '1.5' }}>
                {echo.mechanicalEffect}
              </p>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: colors.light, marginBottom: '4px' }}>
                📖 Narrative Effect
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#d1d5db', lineHeight: '1.5', fontStyle: 'italic' }}>
                {echo.narrativeEffect}
              </p>
            </div>

            {isDeveloperMode && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '8px',
                  backgroundColor: '#0f172a',
                  borderRadius: '4px',
                  fontSize: '10px',
                  color: '#6b7280',
                  fontFamily: 'monospace',
                  borderLeft: `2px solid ${colors.light}`
                }}
              >
                <strong>DEBUG:</strong> echoType: {echo.echoType} | rarity: {echo.rarity} | powerLevel:{' '}
                {echo.powerLevel}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Ancestral Timeline - shows the lineage
 */
function AncestralTimeline({ ancestralTree }: { ancestralTree?: any }): React.ReactElement {
  if (!ancestralTree) return <></>;

  const ancestors = Object.values(ancestralTree).sort((a: any, b: any) => a.generation - b.generation);

  if (ancestors.length === 0) return <></>;

  return (
    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #374151' }}>
      <h3 style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 12px 0', fontWeight: 'bold' }}>
        📜 Ancestral Lineage
      </h3>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        {ancestors.map((ancestor: any, idx: number) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Generation marker */}
            <div
              style={{
                width: '24px',
                height: '24px',
                backgroundColor: '#1e293b',
                border: '1px solid #60a5fa',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 'bold',
                color: '#60a5fa',
                flexShrink: 0
              }}
            >
              {ancestor.generation}
            </div>

            {/* Connection line */}
            {idx < ancestors.length - 1 && (
              <div
                style={{
                  width: '2px',
                  height: '12px',
                  backgroundColor: '#60a5fa',
                  margin: '-4px 0'
                }}
              />
            )}

            {/* Ancestor info */}
            <div style={{ flex: 1, fontSize: '12px' }}>
              <div style={{ color: '#e5e7eb', fontWeight: 'bold' }}>
                {ancestor.name}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                Myth Status: {ancestor.mythStatus}% | {ancestor.deeds.length} deed
                {ancestor.deeds.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Main Soul Mirror Component
 */
export default function SoulMirrorOverlay({
  character,
  unlockedSoulEchoes = [],
  ancestralTree,
  isDeveloperMode,
  onEchoClick
}: SoulMirrorProps): React.ReactElement {
  const [expandedEchoId, setExpandedEchoId] = useState<string | null>(null);

  // Generate mock soul echoes if none provided
  const mockEchoes: DisplaySoulEcho[] = useMemo(() => {
    if (unlockedSoulEchoes && unlockedSoulEchoes.length > 0) {
      return (unlockedSoulEchoes as unknown as DisplaySoulEcho[]);
    }
    return [
      {
        id: 'echo_dragon_slayer',
        name: '🐉 Dragon Slayer',
        ancestorName: 'Thorne Blackblade',
        deedTriggered: 'Defeated the Great Wyrm of the Northern Peak',
        echoType: 'relic_item',
        rarity: 'legendary',
        powerLevel: 95,
        generationsSince: 2,
        bondStrength: 78,
        mechanicalEffect: '+20% damage to dragons, +2 fire resistance, once per day revive with 50% health',
        narrativeEffect: 'Your ancestor\'s final battle echoes in your bloodline. Dragons sense your legacy.'
      },
      {
        id: 'echo_liberator',
        name: '🗽 Liberator',
        ancestorName: 'Mira the Free',
        deedTriggered: 'Freed an enslaved kingdom from tyranny',
        echoType: 'bloodline_blessing',
        rarity: 'rare',
        powerLevel: 85,
        generationsSince: 3,
        bondStrength: 62,
        mechanicalEffect: '+15 charisma, +50 starting reputation with liberated peoples, faction cooldowns -50%',
        narrativeEffect: 'The oppressed remember your ancestor\'s name. You move freely in lands of freedom.'
      },
      {
        id: 'echo_sage',
        name: '📚 Sage',
        ancestorName: 'Eldor the Wise',
        deedTriggered: 'Discovered the Lost Library of Ancient Tongues',
        echoType: 'ethereal_power',
        rarity: 'uncommon',
        powerLevel: 72,
        generationsSince: 1,
        bondStrength: 88,
        mechanicalEffect: '+2 intelligence, +25% knowledge checks, unlock ancient language script',
        narrativeEffect: 'The knowledge of ages whispers through your thoughts. Secrets reveal themselves.'
      }
    ];
  }, [unlockedSoulEchoes]);

  const echoes: DisplaySoulEcho[] = mockEchoes;

  // Mock ancestral tree if not provided
  const mockTree = useMemo(() => {
    if (!ancestralTree) {
      return {
        ancestor_1: {
          name: 'Thorne Blackblade',
          generation: 1,
          deeds: ['Defeated the Great Wyrm', 'Defended the Northern Peak'],
          mythStatus: 92
        },
        ancestor_2: {
          name: 'Mira the Free',
          generation: 2,
          deeds: ['Liberated the kingdom', 'Ended the Tyrant\'s reign'],
          mythStatus: 85
        },
        ancestor_3: {
          name: 'Eldor the Wise',
          generation: 3,
          deeds: ['Found the Lost Library', 'Mastered the Ancient Tongues'],
          mythStatus: 78
        }
      };
    }
    return ancestralTree;
  }, [ancestralTree]);

  const charGeneration = character?.generation || 3;
  const daysToNextGeneration = Math.max(0, Math.floor(Math.random() * 365));

  const rarityGroups = useMemo(() => {
    const groups: Record<string, DisplaySoulEcho[]> = {
      legendary: [],
      rare: [],
      uncommon: [],
      common: []
    };
    for (const echo of echoes) {
      groups[echo.rarity].push(echo);
    }
    return groups;
  }, [echoes]);

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: '#0f172a',
        color: '#e5e7eb',
        borderRadius: '12px',
        border: '2px solid #60a5fa',
        maxHeight: '800px',
        overflowY: 'auto',
        maxWidth: '600px'
      }}
    >
      {/* Header with mystical styling */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: '20px',
          paddingBottom: '14px',
          borderBottom: '2px solid #60a5fa',
          position: 'relative'
        }}
      >
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>✧ ♦ ✧</div>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#60a5fa' }}>
          The Soul Mirror
        </h1>
        <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>
          {character?.name || 'Unknown'} — Generation {charGeneration}
        </p>
      </div>

      {/* Character Info Card */}
      <div
        style={{
          backgroundColor: '#1e293b',
          border: '1px solid #374151',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px'
        }}
      >
        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>
          <strong>Ancestral Resonance</strong>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>
              Soul Echoes Unlocked: {echoes.length}
            </div>
            <div style={{ width: '200px', height: '4px', backgroundColor: '#0f172a', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(echoes.length / 6) * 100}%`,
                  height: '100%',
                  backgroundColor: '#60a5fa'
                }}
              />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 'bold' }}>
            {echoes.length}/6
          </div>
        </div>
        {isDeveloperMode && (
          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '6px' }}>
            Days to next generation: {daysToNextGeneration}
          </div>
        )}
      </div>

      {/* Soul Echoes by Rarity */}
      {Object.entries(rarityGroups).map(([rarity, echoList]) => (
        echoList.length > 0 && (
          <div key={rarity} style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px' }}>
              {rarity} ({echoList.length})
            </div>
            {echoList.map(echo => (
              <SoulEchoCard
                key={echo.id}
                echo={echo}
                isExpanded={expandedEchoId === echo.id}
                onToggle={() => {
                  setExpandedEchoId(expandedEchoId === echo.id ? null : echo.id);
                  onEchoClick?.(echo.id);
                }}
                isDeveloperMode={isDeveloperMode}
              />
            ))}
          </div>
        )
      ))}

      {/* Locked Echoes Teaser */}
      {echoes.length < 6 && (
        <div
          style={{
            backgroundColor: '#1f2937',
            border: '2px dashed #374151',
            borderRadius: '8px',
            padding: '12px',
            textAlign: 'center',
            marginBottom: '14px',
            color: '#6b7280'
          }}
        >
          <div style={{ fontSize: '11px' }}>
            {6 - echoes.length} echo
            {6 - echoes.length !== 1 ? 's' : ''} remain locked...
          </div>
          <div style={{ fontSize: '10px', marginTop: '4px' }}>
            Perform great deeds to unlock ancestral power
          </div>
        </div>
      )}

      {/* Ancestral Timeline */}
      <AncestralTimeline ancestralTree={mockTree} />

      {/* Legend / Help */}
      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #374151' }}>
        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
          <div style={{ marginBottom: '6px', fontWeight: 'bold' }}>How Soul Echoes Work:</div>
          <ul style={{ margin: '0', paddingLeft: '16px', lineHeight: '1.6' }}>
            <li>
              <span style={{ color: '#60a5fa' }}>Deeds</span> performed by ancestors unlock echoes in future generations
            </li>
            <li>
              <span style={{ color: '#60a5fa' }}>Bond Strength</span> shows connection to ancestral power (0-100%)
            </li>
            <li>
              <span style={{ color: '#60a5fa' }}>Generational Distance</span> affects power levels and mechanics
            </li>
            <li>
              <span style={{ color: '#60a5fa' }}>Legendary</span> echoes remain rare across many generations
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
