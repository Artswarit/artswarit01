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
            <div className="text-yellow-500"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 mx-auto"><path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd"/></svg></div>
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
