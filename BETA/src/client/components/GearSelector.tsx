import React, { useState } from 'react';
import styles from './CharacterWizard.module.css';

interface Props {
  gearChoices: any[];
  selectedGearId?: string;
  onSelectGear: (id: string) => void;
  onHoverGear: (id: string | null) => void;
}

/**
 * GearSelector - 3x3 Grid with Diablo-Style Icons
 * 
 * Features:
 * - Dual-column layout (Offense/Defense)
 * - Icon-based grid for visual scanning
 * - Hover tooltips with stat comparisons
 * - "Equip" animation feedback
 * - RPG aesthetic with glow effects
 */
export default function GearSelector({
  gearChoices,
  selectedGearId,
  onSelectGear,
  onHoverGear,
}: Props) {
  const [hoveredGearId, setHoveredGearId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  if (!gearChoices || gearChoices.length === 0) {
    return (
      <div className={styles.gear_selector_empty}>
        <p>No starting equipment available.</p>
      </div>
    );
  }

  // Separate gear by category
  const offense = gearChoices.filter((g) => g.category === 'offense' || g.category === 'OFFENSE');
  const defense = gearChoices.filter((g) => g.category === 'defense' || g.category === 'DEFENSE');

  const handleGearHover = (gearId: string | null, event?: React.MouseEvent) => {
    setHoveredGearId(gearId);
    onHoverGear(gearId);
    if (event) {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      });
    }
  };

  const renderGearGrid = (gearList: any[], title: string, icon: string) => (
    <div className={styles.gear_category}>
      <h3 className={styles.gear_category_title}>
        <span>{icon}</span>
        {title}
      </h3>
      <div className={styles.gear_grid}>
        {gearList.length === 0 ? (
          <div className={styles.gear_empty_placeholder}>
            <p>No {title.toLowerCase()} available</p>
          </div>
        ) : (
          gearList.map((gear) => (
            <button
              key={gear.id}
              className={`${styles.gear_item} ${selectedGearId === gear.id ? styles.gear_item_selected : ''} ${hoveredGearId === gear.id ? styles.gear_item_hovered : ''}`}
              onClick={() => onSelectGear(gear.id)}
              onMouseEnter={(e) => handleGearHover(gear.id, e)}
              onMouseLeave={() => handleGearHover(null)}
              title={gear.name}
            >
              {/* Gear Icon (Large, High-Contrast) */}
              <div className={styles.gear_item_icon}>{gear.icon || '⚔️'}</div>

              {/* Selection Highlight */}
              {selectedGearId === gear.id && <div className={styles.gear_item_selection_ring} />}
            </button>
          ))
        )}
      </div>
    </div>
  );

  // Get current gear for tooltip
  const hoveredGear = gearChoices.find((g) => g.id === hoveredGearId);

  return (
    <div className={styles.gear_selector_container}>
      <div className={styles.gear_columns}>
        {renderGearGrid(offense, 'Offense', '⚔️')}
        {renderGearGrid(defense, 'Defense', '🛡️')}
      </div>

      {/* Hover Tooltip with Stats */}
      {hoveredGear && (
        <div
          className={styles.gear_tooltip}
          style={{
            position: 'fixed',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
          }}
        >
          <div className={styles.gear_tooltip_content}>
            <div className={styles.gear_tooltip_icon}>{hoveredGear.icon || '⚔️'}</div>
            <div className={styles.gear_tooltip_name}>{hoveredGear.name}</div>
            <div className={styles.gear_tooltip_desc}>{hoveredGear.flavorText || 'A piece of starting equipment.'}</div>

            {/* Stat Comparisons */}
            {hoveredGear.statModifiers && (
              <div className={styles.gear_tooltip_stats}>
                {Object.entries(hoveredGear.statModifiers).map(([stat, modifier]: [string, any]) => (
                  <div key={stat} className={styles.gear_stat_row}>
                    <span className={styles.gear_stat_name}>{stat}:</span>
                    <span
                      className={`${styles.gear_stat_value} ${modifier > 0 ? styles.stat_positive : modifier < 0 ? styles.stat_negative : ''}`}
                    >
                      {modifier > 0 ? '+' : ''}{modifier}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tooltip Arrow */}
          <div className={styles.gear_tooltip_arrow} />
        </div>
      )}
    </div>
  );
}
