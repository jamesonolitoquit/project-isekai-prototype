/**
 * M70: Analytics Dashboard
 * Operations team view for cohort metrics, engagement tracking, churn prediction, and campaign ROI
 */

import React, { useState } from 'react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface CohortMetrics {
  dau: number; // Daily Active Users
  mau: number; // Monthly Active Users
  sessionLength: number; // avg minutes
  retention: { day1: number; day7: number; day30: number }; // percentages
}

interface EngagementDistribution {
  ultra_core: number; // >85
  core: number; // 60-85
  regular: number; // 40-60
  casual: number; // <40
  at_risk: number; // >7 days inactive
}

interface ChurnPrediction {
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  playersAffected: number;
  confidence: number; // 0-100
  topReasons: string[];
}

interface CampaignPerformance {
  campaignId: string;
  name: string;
  type: 'friend_activity' | 'content_unlock' | 'cosmetic_reward' | 'vip_treatment';
  sentTo: number;
  accepted: number;
  reengaged: number;
  reuseRate: number; // percentage (0-100)
}

// ============================================================================
// ANALYTICS DASHBOARD COMPONENT
// ============================================================================

export const AnalyticsDashboard: React.FC<{
  cohortMetrics: CohortMetrics;
  segmentDistribution: EngagementDistribution;
  churnPredictions: ChurnPrediction[];
  campaignMetrics: CampaignPerformance[];
}> = ({ cohortMetrics, segmentDistribution, churnPredictions, campaignMetrics }) => {
  const [view, setView] = useState<'overview' | 'cohort' | 'churn' | 'campaigns'>('overview');

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <h2>📊 Retention Analytics Hub</h2>
        <p style={{ color: '#888', margin: '4px 0 0 0' }}>Real-time cohort performance & campaign ROI</p>
      </div>

      {/* VIEW SELECTOR */}
      <div style={styles.viewSelector}>
        {(['overview', 'cohort', 'churn', 'campaigns'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              ...styles.viewButton,
              backgroundColor: view === v ? '#FF9500' : '#333',
            }}
          >
            {v === 'overview' && '📈 Overview'}
            {v === 'cohort' && '👥 Cohort Metrics'}
            {v === 'churn' && '⚠️ Churn Forecast'}
            {v === 'campaigns' && '📢 Campaign ROI'}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={styles.content}>
        {view === 'overview' && (
          <OverviewPanel
            metrics={cohortMetrics}
            engagement={segmentDistribution}
            churnPredictions={churnPredictions}
          />
        )}

        {view === 'cohort' && <CohortPanel metrics={cohortMetrics} engagement={segmentDistribution} />}

        {view === 'churn' && <ChurnPanel predictions={churnPredictions} />}

        {view === 'campaigns' && <CampaignsPanel campaigns={campaignMetrics} />}
      </div>
    </div>
  );
};

// ============================================================================
// OVERVIEW PANEL
// ============================================================================

const OverviewPanel: React.FC<{
  metrics: CohortMetrics;
  engagement: EngagementDistribution;
  churnPredictions: ChurnPrediction[];
}> = ({ metrics, engagement, churnPredictions }) => (
  <div>
    <h3>🎯 Today's Snapshot</h3>

    {/* KEY METRICS ROW */}
    <div style={styles.metricsGrid}>
      <MetricCard
        label="Daily Active Users"
        value={metrics.dau.toLocaleString()}
        trend={2.3}
        icon="👥"
      />
      <MetricCard
        label="Avg Session Length"
        value={`${metrics.sessionLength}m`}
        trend={-0.5}
        icon="⏱️"
      />
      <MetricCard
        label="Day 7 Retention"
        value={`${metrics.retention.day7}%`}
        trend={1.2}
        icon="📈"
      />
      <MetricCard
        label="At-Risk Players"
        value={engagement.at_risk.toLocaleString()}
        trend={-3.1}
        icon="⚠️"
      />
    </div>

    {/* SEGMENT DISTRIBUTION */}
    <div style={styles.card}>
      <h4>Player Segment Distribution</h4>
      <div style={styles.segmentBars}>
        {[
          { label: 'Ultra Core', value: engagement.ultra_core, color: '#00FF00' },
          { label: 'Core', value: engagement.core, color: '#32CD32' },
          { label: 'Regular', value: engagement.regular, color: '#FFD700' },
          { label: 'Casual', value: engagement.casual, color: '#FF9500' },
          { label: 'At-Risk', value: engagement.at_risk, color: '#FF6B6B' },
        ].map((seg) => {
          const total = Object.values(engagement).reduce((a, b) => a + b, 0);
          const percent = total > 0 ? (seg.value / total) * 100 : 0;
          return (
            <div key={seg.label} style={styles.segmentBar}>
              <span style={{ width: '80px' }}>{seg.label}</span>
              <div style={styles.barContainer}>
                <div
                  style={{
                    width: `${percent}%`,
                    height: '100%',
                    backgroundColor: seg.color,
                  }}
                />
              </div>
              <span style={{ width: '60px', textAlign: 'right' }}>{Math.round(percent)}%</span>
            </div>
          );
        })}
      </div>
    </div>

    {/* CHURN FORECAST SUMMARY */}
    {churnPredictions.length > 0 && (
      <div style={styles.card}>
        <h4>Churn Risk Summary</h4>
        {churnPredictions.slice(0, 3).map((pred, idx) => (
          <div key={idx} style={styles.churnSummaryItem}>
            <span style={styles.riskBadge(pred.riskLevel)}>
              {pred.riskLevel.toUpperCase()}
            </span>
            <span>{pred.playersAffected} players at risk</span>
            <span style={{ color: '#888' }}>
              ({pred.confidence}% confidence)
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ============================================================================
// COHORT PANEL
// ============================================================================

const CohortPanel: React.FC<{
  metrics: CohortMetrics;
  engagement: EngagementDistribution;
}> = ({ metrics, engagement }) => (
  <div>
    <h3>👥 Cohort Performance Metrics</h3>

    <div style={styles.metricsGrid}>
      <div style={styles.card}>
        <h4>Active Users</h4>
        <p style={{ fontSize: '1.8em', margin: '8px 0', color: '#00FF00' }}>
          {metrics.dau.toLocaleString()}
        </p>
        <p style={{ fontSize: '0.9em', color: '#888' }}>
          MAU: {metrics.mau.toLocaleString()}
        </p>
      </div>

      <div style={styles.card}>
        <h4>Retention Cohort</h4>
        <p style={{ fontSize: '0.9em', margin: '6px 0' }}>
          <strong>Day 1:</strong> {metrics.retention.day1}%
        </p>
        <p style={{ fontSize: '0.9em', margin: '6px 0' }}>
          <strong>Day 7:</strong> <span style={{ color: '#FFD700' }}>{metrics.retention.day7}%</span>
        </p>
        <p style={{ fontSize: '0.9em', margin: '6px 0' }}>
          <strong>Day 30:</strong> <span style={{ color: '#32CD32' }}>{metrics.retention.day30}%</span>
        </p>
      </div>

      <div style={styles.card}>
        <h4>Session Analytics</h4>
        <p style={{ fontSize: '1.4em', margin: '8px 0', color: '#00FFFF' }}>
          {metrics.sessionLength}m
        </p>
        <p style={{ fontSize: '0.9em', color: '#888' }}>average session length</p>
      </div>
    </div>

    {/* RETENTION TREND */}
    <div style={styles.card}>
      <h4>Retention Trend (Cohort Curve)</h4>
      <div style={styles.retentionCurve}>
        <div style={styles.retentionPoint}>
          <div style={{ height: `${metrics.retention.day1}%`, backgroundColor: '#00FF00' }} />
          <span>Day 1</span>
          <span>{metrics.retention.day1}%</span>
        </div>
        <div style={styles.retentionPoint}>
          <div style={{ height: `${metrics.retention.day7}%`, backgroundColor: '#FFD700' }} />
          <span>Day 7</span>
          <span>{metrics.retention.day7}%</span>
        </div>
        <div style={styles.retentionPoint}>
          <div style={{ height: `${metrics.retention.day30}%`, backgroundColor: '#FF9500' }} />
          <span>Day 30</span>
          <span>{metrics.retention.day30}%</span>
        </div>
      </div>
    </div>
  </div>
);

// ============================================================================
// CHURN PANEL
// ============================================================================

const ChurnPanel: React.FC<{ predictions: ChurnPrediction[] }> = ({ predictions }) => (
  <div>
    <h3>⚠️ Churn Risk Forecast</h3>

    {predictions.length === 0 ? (
      <p style={{ color: '#888' }}>No churn predictions available.</p>
    ) : (
      <div style={styles.predictionList}>
        {predictions.map((pred, idx) => (
          <div key={idx} style={styles.predictionCard}>
            <div style={styles.predictionHeader}>
              <span style={styles.riskBadge(pred.riskLevel)}>
                {pred.riskLevel.toUpperCase()}
              </span>
              <span style={{ marginLeft: 'auto' }}>
                {pred.confidence}% confidence
              </span>
            </div>

            <div style={styles.predictionDetails}>
              <p style={{ margin: '4px 0' }}>
                <strong>{pred.playersAffected.toLocaleString()}</strong> players at risk
              </p>
              <p style={{ fontSize: '0.9em', color: '#888', margin: '4px 0' }}>
                <strong>Top reasons:</strong>
              </p>
              <ul style={{ fontSize: '0.85em', color: '#aaa', marginLeft: '16px', margin: '4px 0' }}>
                {pred.topReasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>

            <button
              style={{
                ...styles.actionButton,
                backgroundColor: pred.riskLevel === 'critical' ? '#FF6B6B' : '#FF9500',
              }}
            >
              Launch Campaign →
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ============================================================================
// CAMPAIGNS PANEL
// ============================================================================

const CampaignsPanel: React.FC<{ campaigns: CampaignPerformance[] }> = ({ campaigns }) => (
  <div>
    <h3>📢 Campaign Performance & ROI</h3>

    {campaigns.length === 0 ? (
      <p style={{ color: '#888' }}>No campaigns active.</p>
    ) : (
      <div style={styles.campaignList}>
        {campaigns.map((camp) => {
          const acceptanceRate = camp.sentTo > 0 ? (camp.accepted / camp.sentTo) * 100 : 0;
          const reengagementRate = camp.accepted > 0 ? (camp.reengaged / camp.accepted) * 100 : 0;
          return (
            <div key={camp.campaignId} style={styles.campaignCard}>
              <div style={styles.campaignHeader}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0' }}>{camp.name}</h4>
                  <span style={styles.campaignType(camp.type)}>
                    {camp.type.replaceAll('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0', fontSize: '1.2em', color: '#00FF00' }}>
                    {Math.round(reengagementRate)}%
                  </p>
                  <span style={{ fontSize: '0.8em', color: '#888' }}>Re-engagement</span>
                </div>
              </div>

              <div style={styles.campaignMetrics}>
                <div>
                  <span style={{ color: '#888' }}>Sent:</span>
                  <strong>{camp.sentTo.toLocaleString()}</strong>
                </div>
                <div>
                  <span style={{ color: '#888' }}>Accepted:</span>
                  <strong style={{ color: '#FFD700' }}>{camp.accepted} ({Math.round(acceptanceRate)}%)</strong>
                </div>
                <div>
                  <span style={{ color: '#888' }}>Re-engaged:</span>
                  <strong style={{ color: '#00FF00' }}>{camp.reengaged}</strong>
                </div>
                <div>
                  <span style={{ color: '#888' }}>Reuse Rate:</span>
                  <strong style={{ color: '#32CD32' }}>{camp.reuseRate}%</strong>
                </div>
              </div>

              <div style={styles.progressBar}>
                <div
                  style={{
                    width: `${acceptanceRate}%`,
                    height: '100%',
                    backgroundColor: '#FFD700',
                  }}
                />
                <span style={{ marginLeft: '8px' }}>{Math.round(acceptanceRate)}% acceptance</span>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

// ============================================================================
// METRIC CARD COMPONENT
// ============================================================================

const MetricCard: React.FC<{
  label: string;
  value: string;
  trend: number;
  icon: string;
}> = ({ label, value, trend, icon }) => (
  <div style={styles.card}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <p style={{ fontSize: '0.9em', color: '#888', margin: '0 0 8px 0' }}>{label}</p>
        <p style={{ fontSize: '1.6em', margin: '0', fontWeight: 'bold' }}>{value}</p>
      </div>
      <span style={{ fontSize: '2em' }}>{icon}</span>
    </div>
    <p
      style={{
        fontSize: '0.85em',
        margin: '8px 0 0 0',
        color: trend > 0 ? '#00FF00' : '#FF6B6B',
      }}
    >
      {trend > 0 ? '📈' : '📉'} {Math.abs(trend)}% {trend > 0 ? 'up' : 'down'}
    </p>
  </div>
);

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    backgroundColor: '#0a0a0a',
    color: '#fff',
    borderRadius: '8px',
    padding: '16px',
    fontFamily: 'monospace',
    border: '1px solid #333',
  },
  header: {
    marginBottom: '16px',
    borderBottom: '2px solid #444',
    paddingBottom: '12px',
  },
  viewSelector: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  viewButton: {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#fff',
    fontFamily: 'monospace',
    transition: 'background-color 0.2s',
  },
  content: {
    backgroundColor: '#0a0a0a',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
    marginBottom: '16px',
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid #333',
    marginBottom: '12px',
  },
  segmentBars: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  segmentBar: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    fontSize: '0.85em',
  },
  barContainer: {
    flex: 1,
    height: '20px',
    backgroundColor: '#0a0a0a',
    borderRadius: '4px',
    overflow: 'hidden',
    border: '1px solid #333',
  },
  churnSummaryItem: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    padding: '6px',
    borderBottom: '1px solid #333',
    fontSize: '0.9em',
  },
  riskBadge: (risk: string) => ({
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '0.75em',
    fontWeight: 'bold' as const,
    backgroundColor:
      risk === 'critical'
        ? '#FF6B6B'
        : risk === 'high'
        ? '#FF9500'
        : risk === 'medium'
        ? '#FFD700'
        : '#32CD32',
    color: '#000',
    minWidth: '50px',
    textAlign: 'center' as const,
  }),
  retentionCurve: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: '150px',
    gap: '16px',
    marginTop: '12px',
  },
  retentionPoint: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    flex: 1,
  },
  predictionList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  predictionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid #333',
  },
  predictionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  predictionDetails: {
    backgroundColor: '#0a0a0a',
    borderRadius: '4px',
    padding: '8px',
    marginBottom: '8px',
  },
  actionButton: {
    padding: '6px 12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#000',
    fontWeight: 'bold' as const,
    width: '100%',
  },
  campaignList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  campaignCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid #333',
  },
  campaignHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    justifyItems: 'center',
    marginBottom: '8px',
  },
  campaignType: (type: string) => ({
    display: 'inline-block',
    fontSize: '0.7em',
    color: '#888',
    padding: '2px 4px',
    backgroundColor: '#0a0a0a',
    borderRadius: '2px',
  }),
  campaignMetrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
    fontSize: '0.8em',
    marginBottom: '8px',
    padding: '8px',
    backgroundColor: '#0a0a0a',
    borderRadius: '4px',
  },
  progressBar: {
    display: 'flex',
    alignItems: 'center',
    height: '16px',
    backgroundColor: '#0a0a0a',
    borderRadius: '4px',
    overflow: 'hidden',
    border: '1px solid #333',
    fontSize: '0.75em',
  },
};

export default AnalyticsDashboard;
