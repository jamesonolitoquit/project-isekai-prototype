import React, { ReactNode, ReactElement } from 'react';

/**
 * M40 Task 3: React Error Boundary
 * 
 * Prevents component errors from crashing the entire application.
 * Wraps major tab panels to isolate failures.
 */

interface Props {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  tabName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(
      `[ErrorBoundary${this.props.tabName ? ` - ${this.props.tabName}` : ''}] Caught error:`,
      error,
      errorInfo
    );
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactElement {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return <>{this.props.fallback(this.state.error, this.handleRetry)}</>;
      }

      return (
        <div
          style={{
            padding: '20px',
            backgroundColor: '#3a1a1a',
            border: '2px solid #ef4444',
            borderRadius: '6px',
            color: '#ef4444',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
            ⚠️ Tab Error
            {this.props.tabName && ` (${this.props.tabName})`}
          </div>
          <div style={{ color: '#aaa', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '11px'
            }}
          >
            🔄 Retry Tab
          </button>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}

export default ErrorBoundary;
