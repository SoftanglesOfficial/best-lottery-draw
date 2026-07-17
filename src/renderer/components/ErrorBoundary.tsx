import { AlertTriangle } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  showDetails: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, showDetails: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, showDetails: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error:', error, info);
  }

  private goToDashboard = () => {
    if (window.location.protocol === 'file:') {
      window.location.hash = '/dashboard';
      window.location.reload();
      return;
    }
    window.location.assign('/dashboard');
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-canvas p-4 text-content sm:p-6">
          <div className="w-full max-w-lg rounded-cyber-lg border border-line-strong bg-surface-raised p-6 text-center shadow-2xl shadow-black/30 sm:p-8">
            <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-cyber-error/40 bg-cyber-error/10">
              <AlertTriangle className="h-7 w-7 text-cyber-error" aria-hidden="true" />
            </span>
            <h1 className="font-display text-2xl font-bold text-content">Something went wrong</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-content-muted">
              An unexpected error occurred while rendering this page.
            </p>
            <button
              type="button"
              className="mt-4 text-sm font-medium text-cyber-hover hover:text-cyber hover:underline"
              aria-expanded={this.state.showDetails}
              onClick={() => this.setState((s) => ({ ...s, showDetails: !s.showDetails }))}
            >
              {this.state.showDetails ? 'Hide details' : 'Show details'}
            </button>
            {this.state.showDetails ? (
              <pre className="mt-3 max-h-48 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-cyber border border-cyber-error/30 bg-canvas p-3 text-left font-mono text-xs text-cyber-error">
                {this.state.error.message}
              </pre>
            ) : null}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
              <Button
                type="button"
                variant="secondary"
                allowOffline
                onClick={() => window.location.reload()}
              >
                Reload App
              </Button>
              <Button type="button" allowOffline onClick={this.goToDashboard}>
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
