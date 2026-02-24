-- Migration 001: Initialize World Snapshots Table
-- Phase 23: Production Hardening Sprint
-- Purpose: Periodic point-in-time world state snapshots for recovery

CREATE TABLE IF NOT EXISTS world_snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tick INTEGER NOT NULL,
  world_state_json JSONB NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  timestamp BIGINT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index on tick for DESC ordering (latest snapshot lookup)
CREATE INDEX IF NOT EXISTS idx_snapshots_tick_desc ON world_snapshots(tick DESC);

-- Index on created_at for pruning old snapshots
CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON world_snapshots(created_at DESC);

-- Strategy comment: Keep last 20 snapshots, total size <500MB
-- Pruning script: DELETE FROM world_snapshots WHERE snapshot_id NOT IN (
--   SELECT snapshot_id FROM world_snapshots ORDER BY tick DESC LIMIT 20
-- );
