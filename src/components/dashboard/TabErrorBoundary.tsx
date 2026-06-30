import React from 'react';

interface Props {
  children: React.ReactNode;
  tabLabel?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Per-tab error boundary so a single throwing tab inside a dashboard
 * doesn't white-screen the entire page. Renders a contained fallback
 * with a Try Again action that resets the boundary.
 */
class TabErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error(`🚨 TabErrorBoundary (${this.props.tabLabel ?? 'tab'}) caught:`, error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, errorMessage: '' });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center py-16 px-4">
          <div className="max-w-md w-full text-center space-y-4 p-6 rounded-2xl border border-border bg-card">
            <div className="text-4xl">⚠️</div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold tracking-tight">
                {this.props.tabLabel ? `${this.props.tabLabel} failed to load` : 'This section failed to load'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {this.state.errorMessage || 'An unexpected error occurred.'}
              </p>
            </div>
            <button
              onClick={this.reset}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

export default TabErrorBoundary;
