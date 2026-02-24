-- Migration 003: Initialize Conflict Log Table
-- Phase 23: Production Hardening Sprint
-- Purpose: Track state merge conflicts for analysis and debugging

CREATE TABLE IF NOT EXISTS conflict_log (
  conflict_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tick INTEGER NOT NULL,
  timestamp BIGINT NOT NULL,
  client_a_id VARCHAR(255) NOT NULL,
  client_b_id VARCHAR(255) NOT NULL,
  target_id VARCHAR(255) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  mutation_type VARCHAR(50) NOT NULL,
  resolution_type VARCHAR(50) NOT NULL,
  reason TEXT NOT NULL,
  winner_client_id VARCHAR(255),
  loser_mutation JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index on tick for temporal queries
CREATE INDEX IF NOT EXISTS idx_conflict_tick ON conflict_log(tick ASC);

-- Index on client_id for audit trail
CREATE INDEX IF NOT EXISTS idx_conflict_client_a ON conflict_log(client_a_id);
CREATE INDEX IF NOT EXISTS idx_conflict_client_b ON conflict_log(client_b_id);

-- Index on target for per-entity audit
CREATE INDEX IF NOT EXISTS idx_conflict_target ON conflict_log(target_id, target_type);

-- Comment: Used for debugging the state synchronization system.
-- Query: SELECT * FROM conflict_log WHERE tick BETWEEN ? AND ? ORDER BY tick ASC
-- Metrics: Count conflicts per client to identify problematic players
