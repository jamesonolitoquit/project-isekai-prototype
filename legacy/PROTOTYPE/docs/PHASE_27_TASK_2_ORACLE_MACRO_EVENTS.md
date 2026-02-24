/**
 * PHASE 27 TASK 2 INTEGRATION: ORACLE CONSENSUS FOR MACRO-EVENTS
 * 
 * This document describes how to synchronize global macro-events (SOCIAL_OUTBURST, PARADOX_ANOMALY)
 * via the Oracle to prevent duplicate triggers in multiplayer sessions.
 * 
 * Current State (Pre-Multiplayer):
 * - SOCIAL_OUTBURST triggers on every peer when socialTension >= 1.0
 * - PARADOX_ANOMALY triggers on every peer when paradox points cross 100-point thresholds
 * - In a 6-player session, same event triggers 6 times (undesired)
 * 
 * Solution: Oracle Gating for Macro-Events
 * 
 * Pattern 1: Centralized Oracle Triggering
 * ==========================================
 * Only the Oracle (host, clientId: '0') generates macro-events.
 * Non-Oracle peers receive and replicate the events but don't generate new ones.
 * 
 * Implementation:
 * 1. Pass `isOracle` flag to advanceTick(state, isOracle):
 *    - If isOracle === true and trigger condition met: Generate event, broadcast to peers
 *    - If isOracle === false: Skip generation, trust Oracle's broadcast
 * 
 * 2. Event structure includes `oracleVerified: true` to distinguish Oracle-generated from local:
 *    ```typescript
 *    const outburstEv: Event = {
 *      ...
 *      payload: {
 *        oracleVerified: true,  // Marks this as Oracle-generated
 *        oracleTick: state.tick,
 *        ...existingPayload
 *      }
 *    };
 *    ```
 * 
 * 3. On peers, check for oracleVerified before applying:
 *    ```typescript
 *    if (event.type === 'SOCIAL_OUTBURST' && !event.payload?.oracleVerified) {
 *      // Ignore local generation; wait for Oracle broadcast
 *      return;
 *    }
 *    ```
 * 
 * Pattern 2: Oracle Throttling (Alternative)
 * ============================================
 * All peers can attempt to generate events, but Oracle broadcasts a "canonical instance".
 * Peers receiving Oracle broadcast update their own event log to match.
 * 
 * Trade-off: More complex, but handles edge cases better.
 * 
 * Pattern 3: Event Deduplication (For Now)
 * =========================================
 * Use event ID hash-chaining to detect and reject duplicate events in state rebuild.
 * This is less efficient but works without modifying advanceTick logic.
 * 
 * Recommended Approach: Pattern 1 (Oracle Gating)
 * ================================================
 * 
 * Steps to Implement in worldEngine.ts:
 * 
 * 1. Update advanceTick signature:
 *    ```typescript
 *    export function advanceTick(state: WorldState, isOracle: boolean = true): Event[] {
 *      // defaults to true for single-player (backward compatible)
 *    ```
 * 
 * 2. Wrap macro-event generation with isOracle check:
 *    ```typescript
 *    if (isOracle) {
 *      // SOCIAL_OUTBURST generation
 *      if (currentSocialTension >= 1.0) {
 *        const outburstResult = triggerSocialOutburst(state, currentSocialTension);
 *        if (outburstResult.triggered) {
 *          const outburstEv: Event = { ... oracleVerified: true ... };
 *          appendEvent(outburstEv);
 *        }
 *      }
 *      
 *      // PARADOX_ANOMALY generation
 *      if (shouldManifestPhase27Anomaly(state)) {
 *        const anomaly = triggerPhase27AgeRotAnomaly(state);
 *        if (anomaly) {
 *          const anomalyEv: Event = { ... oracleVerified: true ... };
 *          appendEvent(anomalyEv);
 *        }
 *      }
 *    }
 *    ```
 * 
 * 3. On P2P server, pass Oracle info to game loop:
 *    ```typescript
 *    const isOracle = clientId === oracleClientId;
 *    const events = advanceTick(state, isOracle);
 *    ```
 * 
 * Benefits:
 * - ✅ Deterministic: Oracle is single source of truth
 * - ✅ Low latency: No extra round-trips
 * - ✅ Backward compatible: Single-player still works (isOracle defaults to true)
 * - ✅ Scales: Works with any number of players
 * 
 * Testing:
 * - Verify: socialTension reaches 1.0 with 6 players → only 1 SOCIAL_OUTBURST event
 * - Verify: Paradox points reach 100 with 6 players → only 1 PARADOX_ANOMALY_CREATED event
 * - Verify: Non-Oracle peers replicate events correctly from mutation log replay
 */
