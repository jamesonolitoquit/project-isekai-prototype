/**
 * BranchingTimeline.tsx - Phase 17: Branching Timeline Visualizer
 * 
 * Extends ChronicleArchive to show "Alternate History" paths.
 * Visualizes what WOULD have happened if a different faction won a key conflict,
 * based on WorldDelta divergence metrics.
 */

import React, { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface TimelineBranch {
  branchId: string;
  branchName: string;
  epoch: number;
  divergencePoint: string;         // e.g., "Faction Shadows Edge defeats Duskbringer"
  potentialOutcome: string;        // Alternate history description
  factionPowerDeltas: Record<string, number>;  // What power would be if this won
  locationChanges: string[];       // Different locations that would change
  npcOutcomes: string[];          // Different NPC fates
  relevanceScore: number;         // 0-1: How likely this outcome was
  isCanonical: boolean;           // Did this actually happen?
}

interface DivergencePoint {
  pointId: string;
  epoch: number;
  description: string;
  actualOutcome: TimelineBranch;
  alternateOutcomes: TimelineBranch[];
  decisionInfluence: number;      // How much this decision mattered (1-10)
}

interface BranchingTimelineProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  chronicles?: any[];
}

interface BranchingTimelineState {
  divergencePoints: DivergencePoint[];
  selectedPoint: DivergencePoint | null;
  selectedBranch: TimelineBranch | null;
  loading: boolean;
  error: string | null;
  showAlternates: boolean;
  legacyPoints: number;                         // Phase 18: Currency for timeline manipulation
  confirmModal: { visible: boolean; action: 'collapse' | 'converge' | null; cost: number } | null;  // Phase 18
  collapsedBranches: string[];                  // Phase 18: Tracking pruned branches
}

/**
 * BranchingTimeline Component
 * Displays timeline branches and alternate history paths
 */
export function BranchingTimeline(props: BranchingTimelineProps): ReactNode {
  const { isOpen, onClose, sessionId } = props;
  const [state, setState] = useState<BranchingTimelineState>({
    divergencePoints: [],
    selectedPoint: null,
    selectedBranch: null,
    loading: false,
    error: null,
    showAlternates: false,
    legacyPoints: 100,                    // Phase 18: Starting points
    confirmModal: null,
    collapsedBranches: []
  });

  // Fetch divergence points when component opens
  useEffect(() => {
    if (!isOpen || !sessionId) return;

    const fetchDivergenceData = async () => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        // Fetch chronicle archive
        const response = await fetch(`/api/chronicle/delta/${sessionId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch chronicle data');
        }

        const data = await response.json();
        const divergencePoints = generateDivergencePoints(data.deltas || []);

        setState(prev => ({
          ...prev,
          divergencePoints,
          loading: false,
          selectedPoint: divergencePoints.length > 0 ? divergencePoints[0] : null
        }));
      } catch (err) {
        setState(prev => ({
          ...prev,
          error: (err as Error).message,
          loading: false
        }));
      }
    };

    fetchDivergenceData();
  }, [isOpen, sessionId]);

  /**
   * Generate divergence points from chronicle deltas
   */
  function generateDivergencePoints(deltas: any[]): DivergencePoint[] {
    const points: DivergencePoint[] = [];

    deltas.forEach((delta, index) => {
      if (!delta.worldDelta || !delta.worldDelta.eventLog) return;

      // Analyze faction shifts
      const factionShifts = delta.worldDelta.factionPowerShifts || {};
      const factionEntries = Object.entries(factionShifts).sort(
        (a, b) => Math.abs((b[1] as number)) - Math.abs((a[1] as number))
      );

      if (factionEntries.length > 0) {
        const [topFaction, topShift] = factionEntries[0];
        const topShiftValue = topShift as number;

        // Only create point if significant shift
        if (Math.abs(topShiftValue) > 5) {
          const eventLog = delta.worldDelta.eventLog as string[];
          const relevantEvent = eventLog.find(e => e.includes(topFaction as string)) || '';

          // Generate alternate branch
          const canonicalBranch: TimelineBranch = {
            branchId: `canonical-${delta.epochNumber}`,
            branchName: 'Actual History',
            epoch: delta.epochNumber,
            divergencePoint: relevantEvent,
            potentialOutcome: `Faction ${topFaction} power: +${topShiftValue}`,
            factionPowerDeltas: factionShifts as Record<string, number>,
            locationChanges: (delta.worldDelta.locationChanges || []).map(
              (c: any) => c.locationId
            ),
            npcOutcomes: (delta.worldDelta.npcStateShifts || []).map(
              (n: any) => `${n.npcId}: ${n.changes.alive ? 'Survived' : 'Died'}`
            ),
            relevanceScore: 1.0,
            isCanonical: true
          };

          // Generate alternate branches (what if different faction won?)
          const alternates: TimelineBranch[] = [];
          factionEntries.slice(1, 3).forEach((entry, altIndex) => {
            const [altFaction, altShift] = entry;
            const altShiftValue = altShift as number;

            alternates.push({
              branchId: `alt-${delta.epochNumber}-${altIndex}`,
              branchName: `Alternate Path: ${altFaction}'s Victory`,
              epoch: delta.epochNumber,
              divergencePoint: `If ${altFaction} had defeated its opponents`,
              potentialOutcome: `Hypothetical faction power: +${Math.abs(altShiftValue) * 1.5}`,
              factionPowerDeltas: {
                [altFaction]: Math.abs(altShiftValue) * 1.5,
                [topFaction]: -Math.abs(topShiftValue) * 0.8
              },
              locationChanges: ['Geographic control would differ'],
              npcOutcomes: ['Some NPCs would have different fates'],
              relevanceScore: 0.5 + (altIndex * 0.15),
              isCanonical: false
            });
          });

          points.push({
            pointId: `point-${delta.epochNumber}`,
            epoch: delta.epochNumber,
            description: `Epoch ${delta.epochNumber}: Critical Faction Conflict`,
            actualOutcome: canonicalBranch,
            alternateOutcomes: alternates,
            decisionInfluence: Math.min(10, Math.ceil(Math.abs(topShiftValue) / 2))
          });
        }
      }
    });

    return points;
  }

  /**
   * Phase 18: Collapse a timeline branch
   * Costs 10-25 legacy points based on branch depth
   */
  function collapseBranch(branchId: string): void {
    const cost = 10 + Math.floor(Math.random() * 15);

    if (state.legacyPoints < cost) {
      setState(prev => ({
        ...prev,
        confirmModal: { visible: true, action: 'collapse', cost }
      }));
      return;
    }

    // Show confirmation
    setState(prev => ({
      ...prev,
      confirmModal: { visible: true, action: 'collapse', cost }
    }));
  }

  /**
   * Phase 18: Force convergence between two timeline branches
   * Costs 50 legacy points
   */
  function forceConvergence(nodeA: string, nodeB: string): void {
    const cost = 50;

    if (state.legacyPoints < cost) {
      alert(`Insufficient Legacy Points (need ${cost}, have ${state.legacyPoints})`);
      return;
    }

    setState(prev => ({
      ...prev,
      confirmModal: { visible: true, action: 'converge', cost }
    }));
  }

  /**
   * Phase 18: Execute confirmed action
   */
  function executeTimelineAction(action: 'collapse' | 'converge', cost: number): void {
    setState(prev => ({
      ...prev,
      legacyPoints: Math.max(0, prev.legacyPoints - cost),
      confirmModal: null,
      collapsedBranches: action === 'collapse' 
        ? [...prev.collapsedBranches, `${Date.now()}-${Math.random()}`]
        : prev.collapsedBranches
    }));

    // Log to chronicle
    if (action === 'collapse') {
      console.log('[BranchingTimeline] Timeline branch collapsed');
    } else {
      console.log('[BranchingTimeline] Timeline branches converged');
    }
  }

  /**
   * Render timeline branches
   */
  function renderTimeline(): ReactNode {
    if (state.loading) {
      return (
        <div style={{ padding: '20px', color: '#d4af37' }}>
          Loading timeline branches...
        </div>
      );
    }

    if (state.error) {
      return (
        <div style={{ padding: '20px', color: '#ff6b6b', backgroundColor: '#300' }}>
          Error: {state.error}
        </div>
      );
    }

    if (state.divergencePoints.length === 0) {
      return (
        <div style={{ padding: '20px', color: '#888' }}>
          No significant divergence points recorded in this chronicle.
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', gap: '15px', maxHeight: '400px', overflowY: 'auto' }}>
        {/* Divergence point list */}
        <div style={{ flex: '0 0 200px', borderRight: '1px solid #444' }}>
          <h4 style={{ color: '#d4af37', marginBottom: '10px' }}>Decision Points</h4>
          {state.divergencePoints.map(point => (
            <button
              key={point.pointId}
              onClick={() => setState(prev => ({ ...prev, selectedPoint: point }))}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px',
                marginBottom: '8px',
                background: state.selectedPoint?.pointId === point.pointId ? '#d4af37' : '#222',
                color: state.selectedPoint?.pointId === point.pointId ? '#000' : '#d4af37',
                border: '1px solid #d4af37',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '12px',
                borderRadius: '3px'
              }}
            >
              <div style={{ fontWeight: 'bold' }}>Epoch {point.epoch}</div>
              <div style={{ fontSize: '10px', opacity: 0.8 }}>
                Influence: {point.decisionInfluence}/10
              </div>
            </button>
          ))}
        </div>

        {/* Branch details */}
        <div style={{ flex: 1, paddingLeft: '15px' }}>
          {state.selectedPoint && renderBranchDetails(state.selectedPoint)}
        </div>
      </div>
    );
  }

  /**
   * Render branch details for selected divergence point
   */
  function renderBranchDetails(point: DivergencePoint): ReactNode {
    return (
      <div>
        <h4 style={{ color: '#d4af37', marginBottom: '15px' }}>
          {point.description}
        </h4>

        {/* Canonical branch */}
        <div
          style={{
            background: '#1a2a1a',
            border: '2px solid #4ade80',
            padding: '15px',
            marginBottom: '15px',
            borderRadius: '3px'
          }}
        >
          <div style={{ color: '#4ade80', fontWeight: 'bold', marginBottom: '8px' }}>
            ✓ CANONICAL (What Actually Happened)
          </div>
          <div style={{ color: '#ccc', fontSize: '13px' }}>
            <div>
              <strong>outcome:</strong> {point.actualOutcome.potentialOutcome}
            </div>
            <div style={{ marginTop: '8px', opacity: 0.8 }}>
              {point.actualOutcome.npcOutcomes.slice(0, 2).join(', ')}
            </div>
          </div>
        </div>

        {/* Alternate branches */}
        {state.showAlternates && point.alternateOutcomes.length > 0 && (
          <div>
            <h5 style={{ color: '#ffd700', marginBottom: '10px' }}>
              ◆ Alternate Paths (What Could Have Been)
            </h5>
            {point.alternateOutcomes.map(branch => (
              <div
                key={branch.branchId}
                onClick={() => setState(prev => ({ ...prev, selectedBranch: branch }))}
                style={{
                  background: state.selectedBranch?.branchId === branch.branchId
                    ? '#2a2a1a'
                    : '#1a1a1a',
                  border: `1px solid ${state.selectedBranch?.branchId === branch.branchId
                    ? '#ffd700'
                    : '#666'}`,
                  padding: '12px',
                  marginBottom: '10px',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ color: '#ffd700', fontWeight: 'bold', marginBottom: '5px' }}>
                  {branch.branchName}
                </div>
                <div style={{ color: '#aaa', fontSize: '12px' }}>
                  <div>{branch.divergencePoint}</div>
                  <div style={{ marginTop: '5px', opacity: 0.7 }}>
                    Likelihood: {(branch.relevanceScore * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={() => setState(prev => ({ ...prev, showAlternates: !prev.showAlternates }))}
          style={{
            marginTop: '15px',
            padding: '8px 12px',
            background: state.showAlternates ? '#d4af37' : '#444',
            color: state.showAlternates ? '#000' : '#d4af37',
            border: '1px solid #d4af37',
            cursor: 'pointer',
            borderRadius: '3px',
            fontSize: '12px'
          }}
        >
          {state.showAlternates ? 'Hide Alternate Paths' : 'Show Alternate Paths'}
        </button>
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0f0f0f',
          border: '2px solid #d4af37',
          padding: '20px',
          borderRadius: '5px',
          maxWidth: '800px',
          maxHeight: '600px',
          overflow: 'auto',
          color: '#d4af37',
          boxShadow: '0 0 20px rgba(212, 175, 55, 0.3)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>⚡ Branching Timeline: Alternate Histories</h2>
          {/* Phase 18: Legacy Points Counter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 12px',
            backgroundColor: '#1a2a1a',
            borderRadius: '3px',
            border: '1px solid #d4af37'
          }}>
            <span style={{ fontSize: '12px' }}>✦ Legacy Points:</span>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#4ade80' }}>{state.legacyPoints}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#d4af37',
              fontSize: '20px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {renderTimeline()}

        {/* Phase 18: Action Buttons */}
        {state.selectedBranch && !state.selectedBranch.isCanonical && (
          <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
            <button
              onClick={() => collapseBranch(state.selectedBranch?.branchId || '')}
              style={{
                padding: '8px 12px',
                background: '#a03030',
                color: '#fff',
                border: '1px solid #ff6b6b',
                cursor: 'pointer',
                borderRadius: '3px',
                fontSize: '12px'
              }}
            >
              🗑️ Collapse Branch (10-25 pts)
            </button>
            {state.selectedPoint && state.selectedPoint.alternateOutcomes.length > 1 && (
              <button
                onClick={() => forceConvergence(
                  state.selectedBranch?.branchId || '',
                  state.selectedPoint?.actualOutcome.branchId || ''
                )}
                style={{
                  padding: '8px 12px',
                  background: '#304a80',
                  color: '#fff',
                  border: '1px solid #4488ff',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  fontSize: '12px'
                }}
              >
                🔗 Force Convergence (50 pts)
              </button>
            )}
          </div>
        )}

        {/* Phase 18: Confirmation Modal */}
        {state.confirmModal?.visible && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1100
          }}>
            <div style={{
              background: '#1a1a2e',
              border: '2px solid #ff6b6b',
              padding: '20px',
              borderRadius: '5px',
              color: '#fff',
              maxWidth: '400px',
              textAlign: 'center'
            }}>
              <h3 style={{ color: '#ff6b6b', margin: '0 0 10px 0' }}>⚠️ Confirm Timeline Action</h3>
              <p style={{ marginBottom: '15px' }}>
                {state.confirmModal.action === 'collapse'
                  ? `Collapsing this branch will erase alternate timelines. Cost: ${state.confirmModal.cost} Legacy Points.`
                  : `Forcing convergence will merge branches at their common ancestor. Cost: ${state.confirmModal.cost} Legacy Points.`}
              </p>
              {state.legacyPoints < state.confirmModal.cost && (
                <p style={{ color: '#ff9999', fontSize: '12px', marginBottom: '15px' }}>
                  ❌ Insufficient Legacy Points ({state.legacyPoints}/{state.confirmModal.cost})
                </p>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setState(prev => ({ ...prev, confirmModal: null }))}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#333',
                    color: '#fff',
                    border: '1px solid #666',
                    cursor: 'pointer',
                    borderRadius: '3px'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => executeTimelineAction(
                    state.confirmModal.action || 'collapse',
                    state.confirmModal.cost
                  )}
                  disabled={state.legacyPoints < state.confirmModal.cost}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: state.legacyPoints < state.confirmModal.cost ? '#555' : '#d4af37',
                    color: state.legacyPoints < state.confirmModal.cost ? '#888' : '#000',
                    border: '1px solid #d4af37',
                    cursor: state.legacyPoints < state.confirmModal.cost ? 'not-allowed' : 'pointer',
                    borderRadius: '3px',
                    fontWeight: 'bold'
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: '20px',
            fontSize: '12px',
            color: '#888',
            borderTop: '1px solid #444',
            paddingTop: '15px'
          }}
        >
          <strong>Legend:</strong> Each decision point shows the actual outcome and hypothetical
          branches. Higher influence scores indicate more critical choices that shaped the timeline.
        </div>
      </div>
    </div>
  );
}

export default BranchingTimeline;
