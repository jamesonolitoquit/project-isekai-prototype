/**
 * M69: Moderation Console
 * Real-time admin dashboard for player reports, chat monitoring, behavior anomalies, and support tickets
 * 
 * **Phase 4 Update**: Integrated with Socket.IO real-time event streaming from server
 * - Connects to /api/admin/reports via POST (jwt-authenticated)
 * - Listens to Socket.IO events: exploit_detected, chat_flagged, anomaly_flagged
 * - Actions (Mute/Ban/Approve) POST to /api/admin/moderation/action
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSocketIO } from '../hooks/useSocketIO';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ReportItem {
  reportId: string;
  playerId: string;
  type: 'exploit' | 'rmt' | 'harassment' | 'behavioral';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  reportedAt: number;
  reviewed: boolean;
  autoFlags: string[];
}

interface FlaggedMessage {
  messageId: string;
  senderId: string;
  content: string;
  timestamp: number;
  flagType: 'profanity' | 'rmt' | 'spam' | 'exploit_hint';
  confidence: number;
  action: 'none' | 'muted' | 'removed';
}

interface AnomalyAlert {
  playerId: string;
  type: 'exploit_detected' | 'alt_account' | 'rmt_ring' | 'ledger_inconsistency';
  severity: number; // 0-100
  description: string;
  timestamp: number;
  evidence: string[];
}

// ============================================================================
// MODERATOR CONSOLE COMPONENT
// ============================================================================

// ============================================================================
// MODERATOR CONSOLE COMPONENT
// ============================================================================

export const ModeratorConsole: React.FC<{}> = () => {
  // =========================================================================
  // Socket.IO Connection for Real-Time Events
  // =========================================================================
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
  const { socket, isConnected, events } = useSocketIO({
    url: 'http://localhost:3002',
    token: token || undefined,
    autoConnect: true,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000
  });

  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  const [activeTab, setActiveTab] = useState<'reports' | 'chat' | 'anomalies' | 'tickets'>('reports');
  const [recentReports, setRecentReports] = useState<ReportItem[]>([]);
  const [flaggedMessages, setFlaggedMessages] = useState<FlaggedMessage[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // =========================================================================
  // Socket.IO Event Listeners & Processing
  // =========================================================================

  useEffect(() => {
    if (events.length === 0) return;

    // Process latest event
    const latestEvent = events[events.length - 1];

    // Extract the event data from Socket.IO broadcast
    const eventData = (latestEvent as any).data || latestEvent;

    // Route events to appropriate state
    if ((latestEvent as any).type === 'exploit_detected') {
      const newReport: ReportItem = {
        reportId: `report-${Date.now()}`,
        playerId: eventData.playerId || 'unknown',
        type: 'exploit',
        severity: eventData.severity === 'critical' ? 'critical' : eventData.severity === 'high' ? 'high' : 'medium',
        description: eventData.description || `${eventData.exploitType} detected`,
        reportedAt: Date.now(),
        reviewed: false,
        autoFlags: [eventData.exploitType || 'unknown']
      };

      setRecentReports(prev => [newReport, ...prev.slice(0, 49)]);
    }

    if ((latestEvent as any).type === 'chat_flagged') {
      const newMessage: FlaggedMessage = {
        messageId: `msg-${Date.now()}`,
        senderId: eventData.playerId || 'unknown',
        content: eventData.content || 'flagged message',
        timestamp: Date.now(),
        flagType: eventData.flagType || 'exploit_hint',
        confidence: eventData.confidence || 0.85,
        action: 'none'
      };

      setFlaggedMessages(prev => [newMessage, ...prev.slice(0, 49)]);
    }

    if ((latestEvent as any).type === 'anomaly_flagged') {
      const newAnomaly: AnomalyAlert = {
        playerId: eventData.playerId || 'unknown',
        type: (eventData.type as any) || 'exploit_detected',
        severity: eventData.severity || 75,
        description: eventData.description || 'behavioral anomaly detected',
        timestamp: Date.now(),
        evidence: eventData.evidence || []
      };

      setAnomalies(prev => [newAnomaly, ...prev.slice(0, 49)]);
    }
  }, [events]);

  // =========================================================================
  // Action Handlers (POST to /api/admin/moderation/action)
  // =========================================================================

  const performModerationAction = useCallback(
    async (playerId: string, action: 'mute' | 'unmute' | 'warn' | 'temp_ban' | 'permanent_ban', reason?: string) => {
      setActionLoading(true);
      setActionError(null);

      try {
        const response = await fetch('/api/admin/moderation/action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token || localStorage.getItem('authToken') || ''}`
          },
          body: JSON.stringify({
            playerId,
            action,
            reason: reason || `Moderator action: ${action}`,
            durationMinutes: action === 'temp_ban' ? 60 : undefined
          })
        });

        if (!response.ok) {
          throw new Error(`Moderation action failed: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('[ModeratorConsole] Action successful:', result);

        // Broadcast successful action via Socket.IO
        if (socket) {
          socket.emit('m69:moderation-action-applied', {
            playerId,
            action,
            appliedBy: 'moderator',
            timestamp: Date.now()
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        setActionError(errorMsg);
        console.error('[ModeratorConsole] Action error:', error);
      } finally {
        setActionLoading(false);
      }
    },
    [token, socket]
  );

  const onMutePlayer = useCallback((playerId: string) => {
    performModerationAction(playerId, 'mute', 'Muted by moderator');
  }, [performModerationAction]);

  const onResolveReport = useCallback((reportId: string) => {
    const report = recentReports.find(r => r.reportId === reportId);
    if (report) {
      performModerationAction(report.playerId, 'warn', 'Report resolved - warning issued');
      setRecentReports(prev => prev.filter(r => r.reportId !== reportId));
    }
  }, [recentReports, performModerationAction]);

  const onBanPlayer = useCallback((playerId: string) => {
    performModerationAction(playerId, 'permanent_ban', 'Banned by moderator - confirmed exploit');
  }, [performModerationAction]);

  // =========================================================================
  // Derived State
  // =========================================================================

  const filteredReports = recentReports.sort((a, b) => {
    if (a.reviewed !== b.reviewed) return a.reviewed ? 1 : -1;
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (a.severity !== b.severity) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.reportedAt - a.reportedAt;
  });

  const criticalCount = anomalies.filter((a) => a.severity >= 80).length;

  return (
    <div className="moderator-console" style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2>⚔️ Moderation Console</h2>
          {/* Socket.IO Connection Indicator */}
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: isConnected ? '#00ff00' : '#888',
            boxShadow: isConnected ? '0 0 8px #00ff00' : 'none'
          }} title={isConnected ? 'Connected to server' : 'Disconnected from server'} />
        </div>
        <div style={styles.alertBadges}>
          {filteredReports.filter((r) => !r.reviewed).length > 0 && (
            <div style={{ ...styles.badge, backgroundColor: '#ff6b6b' }}>
              {filteredReports.filter((r) => !r.reviewed).length} Reports
            </div>
          )}
          {flaggedMessages.filter((m) => m.action === 'none').length > 0 && (
            <div style={{ ...styles.badge, backgroundColor: '#ffa500' }}>
              {flaggedMessages.filter((m) => m.action === 'none').length} Flags
            </div>
          )}
          {criticalCount > 0 && (
            <div style={{ ...styles.badge, backgroundColor: '#ff0000' }}>
              🚨 {criticalCount} Critical
            </div>
          )}
        </div>
      </div>

      {/* ERROR MESSAGE */}
      {actionError && (
        <div style={{
          padding: '8px 12px',
          marginBottom: '12px',
          backgroundColor: '#4a1a1a',
          color: '#ff6b6b',
          borderRadius: '4px',
          fontSize: '0.9em'
        }}>
          ⚠️ {actionError}
        </div>
      )}

      {/* TAB NAVIGATION */}
      <div style={styles.tabNav}>
        {(['reports', 'chat', 'anomalies', 'tickets'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tabButton,
              backgroundColor: activeTab === tab ? '#4CAF50' : '#666',
              color: '#fff',
            }}
          >
            {tab === 'reports' && '📋 Reports'}
            {tab === 'chat' && '💬 Chat Monitor'}
            {tab === 'anomalies' && '🔴 Anomalies'}
            {tab === 'tickets' && '🎫 Tickets'}
          </button>
        ))}
      </div>

      {/* CONTENT PANE */}
      <div style={styles.contentPane}>
        {activeTab === 'reports' && (
          <ReportsTab
            reports={filteredReports}
            selected={selectedReport}
            onSelect={setSelectedReport}
            onResolve={onResolveReport}
            onMute={onMutePlayer}
          />
        )}

        {activeTab === 'chat' && (
          <ChatMonitorTab messages={flaggedMessages} onAction={onMutePlayer} />
        )}

        {activeTab === 'anomalies' && (
          <AnomaliesTab anomalies={anomalies} onAction={onMutePlayer} onBan={onBanPlayer} />
        )}

        {activeTab === 'tickets' && (
          <TicketsTab />
        )}
      </div>
    </div>
  );
};

// ============================================================================
// REPORTS TAB
// ============================================================================

const ReportsTab: React.FC<{
  reports: ReportItem[];
  selected: ReportItem | null;
  onSelect: (report: ReportItem) => void;
  onResolve: (id: string) => void;
  onMute: (playerId: string) => void;
}> = ({ reports, selected, onSelect, onResolve, onMute }) => (
  <div style={styles.splitPane}>
    <div style={styles.listPane}>
      <h3>Report Queue</h3>
      {reports.length === 0 ? (
        <p style={{ color: '#aaa' }}>✨ No reports</p>
      ) : (
        reports.map((report) => (
          <div
            key={report.reportId}
            onClick={() => onSelect(report)}
            style={{
              ...styles.reportItem,
              backgroundColor:
                selected?.reportId === report.reportId ? '#2a3f2f' : '#1a1a1a',
              borderLeft: `4px solid ${report.severity === 'critical' ? '#ff0000' : report.severity === 'high' ? '#ff6b6b' : '#ffa500'}`,
            }}
          >
            <div style={{ fontWeight: 'bold' }}>
              {report.playerId} • {report.type}
            </div>
            <div style={{ fontSize: '0.9em', color: '#aaa' }}>
              {new Date(report.reportedAt).toLocaleTimeString()}
            </div>
            <div style={{ fontSize: '0.85em', color: report.reviewed ? '#888' : '#0f0' }}>
              {report.reviewed ? '✓ Reviewed' : '⚠ Unreviewed'}
            </div>
          </div>
        ))
      )}
    </div>

    <div style={styles.detailPane}>
      {selected ? (
        <>
          <h3>{selected.playerId}</h3>
          <p><strong>Type:</strong> {selected.type}</p>
          <p><strong>Severity:</strong> {selected.severity.toUpperCase()}</p>
          <p><strong>Description:</strong> {selected.description}</p>
          <p><strong>Auto-Flags:</strong> {selected.autoFlags.join(', ') || 'None'}</p>
          <div style={styles.actionButtons}>
            <button
              onClick={() => onMute(selected.playerId)}
              style={{ ...styles.button, backgroundColor: '#ff6b6b' }}
            >
              🔇 Mute Player
            </button>
            <button
              onClick={() => onResolve(selected.reportId)}
              style={{ ...styles.button, backgroundColor: '#4CAF50' }}
            >
              ✓ Resolve
            </button>
          </div>
        </>
      ) : (
        <p style={{ color: '#aaa' }}>Select a report to view details</p>
      )}
    </div>
  </div>
);

// ============================================================================
// CHAT MONITOR TAB
// ============================================================================

const ChatMonitorTab: React.FC<{
  messages: FlaggedMessage[];
  onAction: (playerId: string) => void;
}> = ({ messages, onAction }) => (
  <div style={styles.listPane}>
    <h3>Flagged Messages</h3>
    {messages.filter((m) => m.action === 'none').length === 0 ? (
      <p style={{ color: '#aaa' }}>✨ All messages clear</p>
    ) : (
      messages
        .filter((m) => m.action === 'none')
        .map((msg) => (
          <div
            key={msg.messageId}
            style={{
              ...styles.messageItem,
              backgroundColor: '#1a252a',
              borderLeft: `4px solid ${msg.flagType === 'rmt' ? '#ff0000' : '#ffa500'}`,
              padding: '10px',
              marginBottom: '8px',
            }}
          >
            <div style={{ fontWeight: 'bold', color: '#0f0' }}>
              {msg.senderId} • {msg.flagType} ({Math.round(msg.confidence * 100)}%)
            </div>
            <div style={{ fontSize: '0.9em', color: '#ccc' }}>&quot;{msg.content}&quot;</div>
            <button
              onClick={() => onAction(msg.senderId)}
              style={{ ...styles.button, marginTop: '5px', backgroundColor: '#ff6b6b' }}
            >
              Mute
            </button>
          </div>
        ))
    )}
  </div>
);

// ============================================================================
// ANOMALIES TAB
// ============================================================================

const AnomaliesTab: React.FC<{
  anomalies: AnomalyAlert[];
  onAction: (playerId: string) => void;
  onBan: (playerId: string) => void;
}> = ({ anomalies, onAction, onBan }) => {
  const criticalAnomalies = anomalies.filter((a) => a.severity >= 80);
  const warningAnomalies = anomalies.filter((a) => a.severity >= 50 && a.severity < 80);

  return (
    <div style={styles.listPane}>
      <h3>Behavioral Anomalies</h3>

      {criticalAnomalies.length > 0 && (
        <>
          <h4 style={{ color: '#ff0000' }}>🚨 Critical</h4>
          {criticalAnomalies.map((a, idx) => (
            <div
              key={idx}
              style={{
                ...styles.anomalyItem,
                backgroundColor: '#4a1a1a',
                borderLeft: '4px solid #ff0000',
              }}
            >
              <div style={{ fontWeight: 'bold', color: '#ff6b6b' }}>
                {a.playerId} • {a.type} ({a.severity}%)
              </div>
              <div style={{ fontSize: '0.9em', color: '#ccc' }}>{a.description}</div>
              <div style={{ fontSize: '0.8em', color: '#aaa' }}>
                Evidence: {a.evidence.join(', ')}
              </div>
              <button
                onClick={() => onBan(a.playerId)}
                style={{ ...styles.button, marginTop: '5px', backgroundColor: '#ff0000' }}
              >
                🚫 Ban Player
              </button>
            </div>
          ))}
        </>
      )}

      {warningAnomalies.length > 0 && (
        <>
          <h4 style={{ color: '#ffa500' }}>⚠ Warning</h4>
          {warningAnomalies.map((a, idx) => (
            <div
              key={idx}
              style={{
                ...styles.anomalyItem,
                backgroundColor: '#4a3a1a',
                borderLeft: '4px solid #ffa500',
              }}
            >
              <div style={{ fontWeight: 'bold', color: '#ffb347' }}>
                {a.playerId} • {a.type} ({a.severity}%)
              </div>
              <div style={{ fontSize: '0.9em', color: '#ccc' }}>{a.description}</div>
              <button
                onClick={() => onAction(a.playerId)}
                style={{ ...styles.button, marginTop: '5px', backgroundColor: '#ffa500' }}
              >
                ⚠ Investigate
              </button>
            </div>
          ))}
        </>
      )}

      {anomalies.length === 0 && <p style={{ color: '#aaa' }}>✨ No anomalies</p>}
    </div>
  );
};

// ============================================================================
// TICKETS TAB
// ============================================================================

const TicketsTab: React.FC = () => (
  <div style={styles.listPane}>
    <h3>Support Tickets</h3>
    <p style={{ color: '#aaa' }}>📋 Ticket queue empty (integrated with M64 support system)</p>
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
    border: '1px solid #444',
    minHeight: '600px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    borderBottom: '2px solid #444',
    paddingBottom: '12px',
  },
  alertBadges: {
    display: 'flex',
    gap: '8px',
  },
  badge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.9em',
    fontWeight: 'bold',
    color: '#fff',
  },
  tabNav: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  tabButton: {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9em',
    fontFamily: 'monospace',
    transition: 'background-color 0.2s',
  },
  contentPane: {
    backgroundColor: '#111',
    borderRadius: '4px',
    padding: '12px',
    minHeight: '500px',
  },
  splitPane: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  listPane: {
    maxHeight: '500px',
    overflowY: 'auto' as const,
  },
  detailPane: {
    padding: '12px',
    backgroundColor: '#1a1a1a',
    borderRadius: '4px',
    fontSize: '0.9em',
  },
  reportItem: {
    padding: '8px',
    marginBottom: '8px',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  messageItem: {
    padding: '8px',
    marginBottom: '8px',
    borderRadius: '4px',
  },
  anomalyItem: {
    padding: '8px',
    marginBottom: '8px',
    borderRadius: '4px',
  },
  button: {
    padding: '6px 12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '0.85em',
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  },
};

export default ModeratorConsole;
