/**
 * GlobalErrorBoundary.tsx - Phase 30 Task 6: Diegetic Error Handling
 * 
 * React Error Boundary that catches rendering errors and displays them
 * as in-character "Temporal Fracture" messages instead of white screen crashes.
 * 
 * Helps distinguish between:
 * - Game logic errors (displayed as narrative events)
 * - React rendering errors (caught and displayed safely)
 * - AI synthesis failures (handled gracefully with static fallback)
 */

import React, { ReactNode, ReactElement } from 'react';

export interface GlobalErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactElement | null;
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface GlobalErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorCount: number;
}

export class GlobalErrorBoundary extends React.Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  private resetTimeout: NodeJS.Timeout | null = null;

  constructor(props: GlobalErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<GlobalErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging
    console.error('GlobalErrorBoundary caught error:', error);
    console.error('Error Info:', errorInfo);

    // Update state with error details
    this.setState(
      (prevState) => ({
        errorInfo,
        errorCount: prevState.errorCount + 1
      }),
      () => {
        // Call optional error handler prop
        if (this.props.onError) {
          this.props.onError(error, errorInfo);
        }

        // Auto-reset after 30 seconds (player can try to recover)
        this.resetTimeout = setTimeout(() => {
          this.resetError();
        }, 30000);
      }
    );
  }

  componentWillUnmount() {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      const { error, errorCount } = this.state;

      // Custom fallback component
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default diegetic error display
      return (
        <div className="global-error-boundary-container">
          {/* Background fracture effect */}
          <div className="temporal-fracture-bg"></div>

          {/* Main error panel */}
          <div className="temporal-fracture-panel">
            {/* Glitch overlay effect */}
            <div className="glitch-overlay"></div>

            {/* Header with icon */}
            <div className="fracture-header">
              <span className="fracture-icon">⚡</span>
              <h1>Temporal Fracture Detected</h1>
            </div>

            {/* Error message */}
            <div className="fracture-message">
              <p className="message-text">
                The fabric of reality has experienced a localized distortion. The Weaver is attempting to reconstruct coherence...
              </p>
            </div>

            {/* Technical details (collapsible) */}
            <details className="technical-details">
              <summary>Technical Integrity Report</summary>
              <div className="details-content">
                <p className="error-type">
                  <strong>Error Type:</strong> <code className="error-code">{error?.name}</code>
                </p>
                <p className="error-message">
                  <strong>Message:</strong> <code className="error-text">{error?.message}</code>
                </p>
                <p className="error-count">
                  <strong>Cascade Iterations:</strong> <code>{errorCount}</code>
                </p>
                {this.state.errorInfo && (
                  <p className="error-stack">
                    <strong>Call Stack:</strong>
                    <pre className="stack-trace">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </p>
                )}
              </div>
            </details>

            {/* Recovery actions */}
            <div className="recovery-actions">
              <button 
                className="action-button attempt-recovery"
                onClick={this.resetError}
              >
                ◾ Attempt Reality Reconstruction
              </button>
              <button 
                className="action-button reload-page"
                onClick={() => window.location.reload()}
              >
                ⟳ Return to Checkpoint
              </button>
            </div>

            {/* Warning message */}
            <div className="warning-box">
              <p className="warning-text">
                ⚠️ Multiple cascade events detected. Manual intervention may be required.
              </p>
              <p className="warning-subtext">
                Consider reporting this temporal anomaly to the developers at GitHub Issues.
              </p>
            </div>

            {/* Atmospheric footer */}
            <div className="fracture-footer">
              <p className="footer-text">
                "Even fractured, the world persists. Even broken, consciousness remains." — The Weaver's Chronicle
              </p>
            </div>
          </div>

          {/* Scan lines effect */}
          <div className="scan-lines"></div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
