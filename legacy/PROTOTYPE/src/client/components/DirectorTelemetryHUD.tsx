/**
 * DirectorTelemetryHUD.tsx - M57-B1: Alpha HUD Stabilization
 * 
 * Real-time server health monitoring and persistence status display
 * Visible to director/admin only during gameplay
 * Shows:
 * - Server health status (healthy/degraded/unhealthy)
 * - Active session count
 * - Persistence sync status
 * - Network uptime
 */

import React, { useEffect, useState } from 'react';

interface ServerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  activeSessions: number;
  persistenceStatus: 'synced' | 'pending' | 'failed';
  lastHeartbeat: number;
}

interface TelemetryState {
  health: ServerHealth | null;
  loading: boolean;
  error: string | null;
  fetchInterval?: NodeJS.Timeout;
}

const DirectorTelemetryHUD: React.FC<{ visible?: boolean }> = ({ visible = false }) => {
  const [telemetry, setTelemetry] = useState<TelemetryState>({
    health: null,
    loading: false,
    error: null
  });

  // Format uptime for display
  const formatUptime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Fetch server health
  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const health: ServerHealth = await response.json();
        setTelemetry({
          health,
          loading: false,
          error: null,
          fetchInterval: telemetry.fetchInterval
        });
      } else {
        setTelemetry(prev => ({
          ...prev,
          error: `HTTP ${response.status}`,
          loading: false
        }));
      }
    } catch (err) {
      setTelemetry(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Unknown error',
        loading: false
      }));
    }
  };

  // Set up polling
  useEffect(() => {
    if (!visible) return;

    setTelemetry(prev => ({ ...prev, loading: true }));
    fetchHealth();

    const interval = setInterval(fetchHealth, 5000); // Poll every 5 seconds

    return () => {
      clearInterval(interval);
      setTelemetry(prev => ({ ...prev, fetchInterval: undefined }));
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  const { health, error } = telemetry;

  // Status indicator colors
  const statusColor = health?.status === 'healthy' ? '#4ade80' : health?.status === 'degraded' ? '#fbbf24' : '#f87171';
  const persistenceColor = health?.persistenceStatus === 'synced' ? '#4ade80' : health?.persistenceStatus === 'pending' ? '#fbbf24' : '#f87171';

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        width: '320px',
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        border: `1px solid ${statusColor}`,
        borderRadius: '8px',
        padding: '12px',
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#e5e7eb',
        zIndex: 9999,
        boxShadow: `0 0 20px rgba(0, 0, 0, 0.8)`
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>Director Telemetry</span>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: statusColor,
            animation: health?.status === 'healthy' ? 'none' : 'pulse 1s infinite'
          }}
        />
      </div>

      {/* Status Section */}
      <div style={{ borderBottom: '1px solid #374151', paddingBottom: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Server:</span>
          <span style={{ color: statusColor, fontWeight: 'bold' }}>
            {health?.status === 'healthy' && '✓ HEALTHY'}
            {health?.status === 'degraded' && '⚠ DEGRADED'}
            {health?.status === 'unhealthy' && '✗ DOWN'}
            {!health && 'FETCHING...'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Persistence:</span>
          <span style={{ color: persistenceColor, fontWeight: 'bold' }}>
            {health?.persistenceStatus === 'synced' && '✓ SYNCED'}
            {health?.persistenceStatus === 'pending' && '⏳ PENDING'}
            {health?.persistenceStatus === 'failed' && '✗ FAILED'}
          </span>
        </div>

        {error && (
          <div style={{ color: '#f87171', fontSize: '11px', marginTop: '4px' }}>
            Error: {error}
          </div>
        )}
      </div>

      {/* Metrics Section */}
      {health && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
            <span>Sessions:</span>
            <span>{health.activeSessions}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
            <span>Uptime:</span>
            <span>{formatUptime(health.uptime)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span>Last Sync:</span>
            <span>{new Date(health.lastHeartbeat).toLocaleTimeString()}</span>
          </div>
        </div>
      )}

      {/* Hidden animation styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default DirectorTelemetryHUD;
