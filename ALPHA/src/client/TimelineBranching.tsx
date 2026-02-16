/**
 * ALPHA_M17 - Timeline Branching UI Component
 * 
 * Purpose: Display an interactive visual timeline showing:
 * - Player's journey through story (tick progression)
 * - Turning points vs incremental shifts
 * - Temporal debt accumulation (save/reload markers)
 * - Branching paths (where choices diverged)
 * - Faction control changes
 * - Major discoveries and lore unlocks
 * 
 * Visual Design:
 * - Horizontal timeline with tick markers
 * - Color-coded event types (turning point = gold, shift = blue, incremental = gray)
 * - Temporal debt shown as "fractures" or "echoes" on timeline
 * - Hover reveals event details
 * - Click to jump to that point in session replay
 */

import React, { useState } from 'react';
import type { TurningPoint, ChronosLedger } from '../engine/chronosLedgerEngine';

interface TimelineProps {
  ledger: ChronosLedger;
  worldInstanceId: string;
  currentTick?: number;
  temporalDebt?: number;
  onEventClick?: (event: TimelineEvent) => void;
  compact?: boolean; // Compact vs detailed view
}

interface TimelineEvent {
  id: string;
  tick: number;
  type: 'turning_point' | 'significant_shift' | 'incremental' | 'temporal_echo' | 'branch_point';
  description: string;
  color: string;
  intensity: number; // 0-1 for opacity/size
  metadata?: Record<string, any>;
}

/**
 * TimelineBranching - Main timeline UI component
 */
export const TimelineBranching: React.FC<TimelineProps> = ({
  ledger,
  worldInstanceId,
  currentTick = 0,
  temporalDebt = 0,
  onEventClick,
  compact = false
}) => {
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

  // Convert turning points to timeline events
  const timelineEvents: TimelineEvent[] = ledger.turningPoints.map(tp => ({
    id: tp.eventId,
    tick: tp.tick,
    type: 
      tp.category === 'turning_point' ? 'turning_point' :
      tp.category === 'significant_shift' ? 'significant_shift' :
      'incremental',
    description: tp.description,
    color: getEventColor(tp.category),
    intensity: 0.3 + (tp.impactScore / 100) * 0.7,
    metadata: tp
  }));

  // Add temporal echo markers for each temporal debt point
  const temporalEchoes: TimelineEvent[] = [];
  if (temporalDebt > 0) {
    // Create echo events at specific debt thresholds
    for (let debt = 10; debt <= temporalDebt; debt += 10) {
      temporalEchoes.push({
        id: `echo_${debt}`,
        tick: Math.floor(ledger.turningPoints.length > 0 ? ledger.turningPoints[0].tick + (debt * 50) : debt * 50),
        type: 'temporal_echo',
        description: `Temporal echo: +${debt} debt`,
        color: '#ff6b6b',
        intensity: 0.5
      });
    }
  }

  const allEvents = [...timelineEvents, ...temporalEchoes].sort((a, b) => a.tick - b.tick);
  const maxTick = Math.max(...allEvents.map(e => e.tick), currentTick, 1000);
  const minTick = 0;

  const handleEventClick = (event: TimelineEvent) => {
    setSelectedEvent(event.id);
    if (event.metadata && onEventClick) {
      onEventClick?.(event);
    }
  };

  return (
    <div className="timeline-branching">
      <style>{timelineStyles}</style>

      <div className="timeline-container">
        {/* Timeline header info */}
        <div className="timeline-header">
          <div className="timeline-title">Session Timeline</div>
          <div className="timeline-stats">
            <span className="stat">
              Turning Points: <strong>{ledger.turningPointCount}</strong>
            </span>
            <span className="stat">
              Total Events: <strong>{ledger.totalEvents}</strong>
            </span>
            {temporalDebt > 0 && (
              <span className="stat temporal-warning">
                Temporal Debt: <strong>{temporalDebt}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Main timeline */}
        <div className="timeline-track">
          {/* Background gradient for current progress */}
          <div
            className="timeline-progress"
            style={{ width: `${(currentTick / maxTick) * 100}%` }}
          />

          {/* Event markers */}
          {allEvents.map(event => {
            const position = ((event.tick - minTick) / (maxTick - minTick)) * 100;
            const isSelected = selectedEvent === event.id;
            const isHovered = hoveredEvent === event.id;

            return (
              <div
                key={event.id}
                className={`timeline-marker ${event.type} ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                style={{
                  left: `${position}%`,
                  opacity: event.intensity,
                  backgroundColor: event.color
                }}
                onClick={() => handleEventClick(event)}
                onMouseEnter={() => setHoveredEvent(event.id)}
                onMouseLeave={() => setHoveredEvent(null)}
                title={event.description}
              >
                {/* Size varies by intensity */}
                <div className="marker-core" style={{
                  width: `${8 + event.intensity * 8}px`,
                  height: `${8 + event.intensity * 8}px`
                }} />
                
                {/* Hover tooltip */}
                {isHovered && (
                  <div className="marker-tooltip">
                    <div className="tooltip-type">{event.type.replace(/_/g, ' ')}</div>
                    <div className="tooltip-description">{event.description}</div>
                    <div className="tooltip-tick">Tick: {event.tick}</div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Current position indicator */}
          <div
            className="current-position"
            style={{ left: `${(currentTick / maxTick) * 100}%` }}
          >
            <div className="position-marker">Now</div>
          </div>
        </div>

        {/* Tick axis labels */}
        <div className="timeline-axis">
          <div className="axis-label" style={{ left: '0%' }}>0</div>
          <div className="axis-label" style={{ left: '25%' }}>{Math.floor(maxTick * 0.25)}</div>
          <div className="axis-label" style={{ left: '50%' }}>{Math.floor(maxTick * 0.5)}</div>
          <div className="axis-label" style={{ left: '75%' }}>{Math.floor(maxTick * 0.75)}</div>
          <div className="axis-label" style={{ left: '100%' }}>{maxTick}</div>
        </div>
      </div>

      {/* Narrative phases breakdown */}
      <div className="timeline-phases">
        <div className="phases-title">Narrative Phases</div>
        {ledger.narrativePath.map((phase, idx) => (
          <div
            key={phase.phase}
            className="phase-block"
            onClick={() => setExpandedPhase(expandedPhase === phase.phase ? null : phase.phase)}
          >
            <div className="phase-header">
              <span className="phase-number">Phase {phase.phase}</span>
              <span className="phase-name">{phase.description}</span>
              <span className="phase-duration">
                {Math.floor((phase.endTick - phase.startTick) / 100)}m
              </span>
            </div>

            {expandedPhase === phase.phase && (
              <div className="phase-details">
                {phase.majorEvents.length > 0 ? (
                  <ul className="major-events">
                    {phase.majorEvents.map(event => (
                      <li key={event.eventId}>
                        <span className="event-type">{event.type}</span>
                        <span className="event-description">{event.description}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="no-events">No major turning points in this phase</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Temporal echo visualization (if debt present) */}
      {temporalDebt > 0 && (
        <div className="temporal-echoes">
          <div className="echoes-title">Reality Fractures (Temporal Debt: {temporalDebt})</div>
          <div className="echoes-list">
            {temporalEchoes.slice(0, 5).map(echo => (
              <div key={echo.id} className="echo-item">
                <span className="echo-marker">⚡</span>
                <span className="echo-label">{echo.description}</span>
                <div className="echo-bar" style={{
                  width: `${(parseInt(echo.id.split('_')[1]) / temporalDebt) * 100}%`
                }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="timeline-legend">
        <div className="legend-item turning-point">
          <span className="legend-marker" />
          <span className="legend-label">Turning Point</span>
        </div>
        <div className="legend-item significant-shift">
          <span className="legend-marker" />
          <span className="legend-label">Significant Shift</span>
        </div>
        <div className="legend-item incremental">
          <span className="legend-marker" />
          <span className="legend-label">Incremental Progress</span>
        </div>
        {temporalDebt > 0 && (
          <div className="legend-item temporal-echo">
            <span className="legend-marker" />
            <span className="legend-label">Temporal Echo</span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Get color for event type
 */
function getEventColor(category: 'turning_point' | 'significant_shift' | 'incremental'): string {
  switch (category) {
    case 'turning_point':
      return '#ffd700'; // Gold
    case 'significant_shift':
      return '#4a9eff'; // Blue
    case 'incremental':
      return '#888888'; // Gray
  }
}

/**
 * CSS-in-JS styles for timeline component
 */
const timelineStyles = `
  .timeline-branching {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    padding: 20px;
    background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
    border-radius: 8px;
    color: #ecf0f1;
  }

  .timeline-container {
    margin-bottom: 30px;
  }

  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    border-bottom: 2px solid #3498db;
    padding-bottom: 10px;
  }

  .timeline-title {
    font-size: 20px;
    font-weight: bold;
    color: #3498db;
  }

  .timeline-stats {
    display: flex;
    gap: 15px;
    font-size: 12px;
  }

  .stat {
    background: rgba(52, 152, 219, 0.2);
    padding: 4px 8px;
    border-radius: 4px;
  }

  .stat.temporal-warning {
    background: rgba(231, 76, 60, 0.3);
  }

  .stat strong {
    color: #f39c12;
  }

  .timeline-track {
    position: relative;
    height: 60px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid #3498db;
    border-radius: 4px;
    margin-bottom: 10px;
    overflow: hidden;
  }

  .timeline-progress {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: linear-gradient(90deg, transparent, #3498db);
    opacity: 0.2;
    transition: width 0.3s ease;
  }

  .timeline-marker {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 10;
  }

  .timeline-marker.turning-point {
    filter: drop-shadow(0 0 4px #ffd700);
  }

  .timeline-marker.significant-shift {
    filter: drop-shadow(0 0 2px #4a9eff);
  }

  .timeline-marker.temporal-echo {
    filter: drop-shadow(0 0 6px #ff6b6b);
    animation: pulse-echo 2s infinite;
  }

  @keyframes pulse-echo {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  .timeline-marker.selected {
    filter: drop-shadow(0 0 8px #fff) !important;
    transform: translate(-50%, -50%) scale(1.3);
  }

  .timeline-marker.hovered {
    transform: translate(-50%, -50%) scale(1.2);
  }

  .marker-core {
    border-radius: 50%;
    margin: auto;
    border: 2px solid rgba(255, 255, 255, 0.4);
  }

  .marker-tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: #1c2833;
    border: 1px solid #3498db;
    border-radius: 4px;
    padding: 8px 12px;
    white-space: nowrap;
    font-size: 11px;
    z-index: 100;
    margin-bottom: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }

  .tooltip-type {
    font-weight: bold;
    color: #f39c12;
    text-transform: uppercase;
  }

  .tooltip-description {
    color: #ecf0f1;
    margin-top: 2px;
  }

  .tooltip-tick {
    font-size: 10px;
    color: #95a5a6;
    margin-top: 2px;
  }

  .current-position {
    position: absolute;
    top: 0;
    height: 100%;
    width: 2px;
    background: #f39c12;
    z-index: 20;
    opacity: 0.8;
  }

  .position-marker {
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 11px;
    color: #f39c12;
    font-weight: bold;
    white-space: nowrap;
  }

  .timeline-axis {
    position: relative;
    height: 20px;
    font-size: 11px;
    color: #95a5a6;
  }

  .axis-label {
    position: absolute;
    transform: translateX(-50%);
    top: 0;
  }

  .timeline-phases {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    padding: 15px;
    margin-bottom: 20px;
  }

  .phases-title {
    font-size: 14px;
    font-weight: bold;
    color: #3498db;
    margin-bottom: 10px;
  }

  .phase-block {
    background: rgba(52, 152, 219, 0.1);
    border-left: 3px solid #3498db;
    padding: 10px;
    margin-bottom: 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .phase-block:hover {
    background: rgba(52, 152, 219, 0.2);
  }

  .phase-header {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 12px;
  }

  .phase-number {
    background: #3498db;
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: bold;
  }

  .phase-name {
    flex: 1;
  }

  .phase-duration {
    color: #95a5a6;
    font-size: 11px;
  }

  .phase-details {
    margin-top: 8px;
    font-size: 11px;
    color: #ecf0f1;
  }

  .major-events {
    list-style: none;
    padding: 0;
    margin: 0;
    padding-left: 10px;
    border-left: 1px solid #3498db;
  }

  .major-events li {
    margin: 4px 0;
    padding: 2px 0 2px 8px;
  }

  .event-type {
    background: #f39c12;
    color: #1c2833;
    padding: 0 4px;
    border-radius: 2px;
    font-weight: bold;
    margin-right: 4px;
  }

  .event-description {
    color: #ecf0f1;
  }

  .no-events {
    color: #95a5a6;
    font-style: italic;
    margin: 4px 0;
  }

  .temporal-echoes {
    background: rgba(231, 76, 60, 0.1);
    border-left: 3px solid #e74c3c;
    border-radius: 4px;
    padding: 15px;
    margin-bottom: 20px;
  }

  .echoes-title {
    font-size: 12px;
    font-weight: bold;
    color: #e74c3c;
    margin-bottom: 10px;
  }

  .echoes-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .echo-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
  }

  .echo-marker {
    font-size: 14px;
    animation: blink 1s infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .echo-label {
    min-width: 80px;
    color: #e74c3c;
  }

  .echo-bar {
    height: 4px;
    background: linear-gradient(90deg, #e74c3c, #ed3a3a);
    border-radius: 2px;
    flex: 1;
  }

  .timeline-legend {
    display: flex;
    gap: 20px;
    font-size: 11px;
    background: rgba(0, 0, 0, 0.3);
    padding: 10px;
    border-radius: 4px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend-marker {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
  }

  .legend-item.turning-point .legend-marker {
    background: #ffd700;
  }

  .legend-item.significant-shift .legend-marker {
    background: #4a9eff;
  }

  .legend-item.incremental .legend-marker {
    background: #888888;
  }

  .legend-item.temporal-echo .legend-marker {
    background: #ff6b6b;
  }

  .legend-label {
    color: #ecf0f1;
  }
`;

export default TimelineBranching;
