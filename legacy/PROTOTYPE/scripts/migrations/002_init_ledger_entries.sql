-- Migration 002: Initialize Ledger Entries Table
-- Phase 23: Production Hardening Sprint
-- Purpose: Immutable append-only ledger of all world mutations for recovery

CREATE TABLE IF NOT EXISTS ledger_entries (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tick INTEGER NOT NULL,
  timestamp BIGINT NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  mutation_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(255) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  changes JSONB NOT NULL,
  checksum_before VARCHAR(64) NOT NULL,
  checksum_after VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index on tick for sequential replay
CREATE INDEX IF NOT EXISTS idx_ledger_tick_asc ON ledger_entries(tick ASC);

-- Index on client_id for per-player query audit
CREATE INDEX IF NOT EXISTS idx_ledger_client_id ON ledger_entries(client_id);

-- Index on created_at for temporal queries
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_entries(created_at DESC);

-- Comment: This table is APPEND-ONLY. Never UPDATE or DELETE entries.
-- Each entry represents an atomic unit of game state change.
-- Recovery process: SELECT * FROM ledger_entries WHERE tick > ? ORDER BY tick ASC
