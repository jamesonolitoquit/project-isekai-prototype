/**
 * Error Boundary Wrappers for M69 & M70 Systems
 * Provides graceful degradation when dashboard systems fail
 * Prevents UI crashes from cascading to core game loop
 */

import React from 'react';

// ============================================================================
// M69 ERROR BOUNDARY (Moderation Console)
// ============================================================================

interface M69ErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, info: any) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export class M69ErrorBoundary extends React.Component<M69ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: M69ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: any): void {
    const newCount = this.state.errorCount + 1;
    this.setState({ errorCount: newCount });

    // Log error for debugging
    console.error('[M69 Moderation Boundary] Error caught:', error);
    console.error('[M69 Moderation Boundary] Error info:', errorInfo);

    // Call parent error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // If >5 errors, disable moderation UI entirely
    if (newCount > 5) {
      console.error('[M69 Moderation Boundary] Too many errors, disabling moderation UI');
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorCount: 0,
    });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '20px',
            backgroundColor: '#2a0a0a',
            color: '#ff6b6b',
            border: '2px solid #ff0000',
            borderRadius: '6px',
            fontFamily: 'monospace',
            marginBottom: '16px',
          }}
        >
          <h3 style={{ margin: '0 0 12px 0' }}>🛡️ Moderation System Temporarily Unavailable</h3>
          <p style={{ margin: '8px 0', fontSize: '0.9em' }}>
            The moderation dashboard encountered an error. Players can still play normally.
          </p>
          <p style={{ margin: '8px 0', fontSize: '0.85em', color: '#aaa' }}>
            Error: {this.state.error?.message || 'Unknown error'}
          </p>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '6px 12px',
                backgroundColor: '#ff6b6b',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '6px 12px',
                backgroundColor: '#666',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>

          {this.state.errorCount > 3 && (
            <p style={{ fontSize: '0.8em', color: '#999', marginTop: '12px' }}>
              Fallback: Manual player search disabled. Use admin panel instead.
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// M70 ERROR BOUNDARY (Retention Dashboard)
// ============================================================================

interface M70ErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, info: any) => void;
  panelName?: string;
}

export class M70ErrorBoundary extends React.Component<M70ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: M70ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: any): void {
    const newCount = this.state.errorCount + 1;
    this.setState({ errorCount: newCount });

    const panelName = this.props.panelName || 'Retention Dashboard';
    console.error(`[${panelName}] Error caught:`, error);
    console.error(`[${panelName}] Error info:`, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorCount: 0,
    });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      const panelName = this.props.panelName || 'Recommended Content';

      return (
        <div
          style={{
            padding: '16px',
            backgroundColor: '#1a1a2e',
            color: '#ffd700',
            border: '1px solid #ffd700',
            borderRadius: '6px',
            fontFamily: 'monospace',
          }}
        >
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1em' }}>⚠️ {panelName} Loading Error</h3>
          <p style={{ margin: '4px 0', fontSize: '0.9em' }}>
            Unable to load recommendations. Showing generic suggestions instead.
          </p>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '6px 12px',
                backgroundColor: '#ffd700',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.9em',
              }}
            >
              Try Again
            </button>
          </div>

          {this.state.errorCount > 2 && (
            <p style={{ fontSize: '0.8em', color: '#aaa', marginTop: '8px' }}>
              Tip: Check back later for personalized recommendations.
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// ANALYTICS ERROR BOUNDARY
// ============================================================================

interface AnalyticsErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, info: any) => void;
}

export class AnalyticsErrorBoundary extends React.Component<
  AnalyticsErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: AnalyticsErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: any): void {
    const newCount = this.state.errorCount + 1;
    this.setState({ errorCount: newCount });

    console.error('[Analytics Dashboard] Error caught:', error);
    console.error('[Analytics Dashboard] Error info:', errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorCount: 0,
    });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '20px',
            backgroundColor: '#1a1a1a',
            color: '#999',
            border: '1px solid #444',
            borderRadius: '6px',
            fontFamily: 'monospace',
            textAlign: 'center' as const,
          }}
        >
          <h3 style={{ margin: '0 0 12px 0' }}>📊 Analytics Temporarily Unavailable</h3>
          <p style={{ margin: '8px 0', fontSize: '0.9em' }}>
            The analytics dashboard is refreshing its data. This usually takes 30 seconds.
          </p>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'center' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '6px 12px',
                backgroundColor: '#444',
                color: '#fff',
                border: '1px solid #666',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// HOOK: USE ERROR BOUNDARY STATE
// ============================================================================

export function useErrorBoundary(): {
  hasError: boolean;
  error: Error | null;
  resetError: () => void;
} {
  const [state, setState] = React.useState({ hasError: false, error: null });

  return {
    hasError: state.hasError,
    error: state.error,
    resetError: () => setState({ hasError: false, error: null }),
  };
}
