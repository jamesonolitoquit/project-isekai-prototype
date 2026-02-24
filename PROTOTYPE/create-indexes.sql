-- Phase 5A-OPT: Database Index Optimization
-- M69 Exploit Detection Indexes
CREATE INDEX IF NOT EXISTS idx_incidents_player ON m69_incidents(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON m69_incidents(severity DESC);
CREATE INDEX IF NOT EXISTS idx_cheat_rings_severity ON m69_cheat_rings(severity DESC);
CREATE INDEX IF NOT EXISTS idx_cheat_rings_player_count ON m69_cheat_rings(player_count DESC);

-- M70 Retention Indexes
CREATE INDEX IF NOT EXISTS idx_predictions_at_risk ON m70_predictions(churn_score DESC) WHERE churn_score > 0.7;
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON m70_campaigns(status) WHERE status IN ('active', 'pending');
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON m70_campaigns(created_at DESC);

-- General Indexes
CREATE INDEX IF NOT EXISTS idx_players_active ON players(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(expires_at DESC) WHERE expires_at > NOW();
CREATE INDEX IF NOT EXISTS idx_moderators_role ON moderators(role) WHERE role IN ('admin', 'support');

-- Composite Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_incidents_player_time ON m69_incidents(player_id, created_at DESC, severity DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_segment ON m70_predictions(player_segment, churn_score DESC);
