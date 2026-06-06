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

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="mb-4 h-12 w-12 text-red-500" />
          <h1 className="text-xl font-semibold text-gray-900">Something went wrong</h1>
          <p className="mt-2 max-w-md text-sm text-gray-500">
            An unexpected error occurred while rendering this page.
          </p>
          <button
            type="button"
            className="mt-4 text-sm text-indigo-600 hover:underline"
            onClick={() => this.setState((s) => ({ ...s, showDetails: !s.showDetails }))}
          >
            {this.state.showDetails ? 'Hide details' : 'Show details'}
          </button>
          {this.state.showDetails ? (
            <pre className="mt-3 max-w-xl overflow-auto rounded border bg-gray-50 p-3 text-left text-xs text-red-700">
              {this.state.error.message}
            </pre>
          ) : null}
          <div className="mt-6 flex gap-3">
            <Button type="button" onClick={() => (window.location.href = '/dashboard')}>
              Go to Dashboard
            </Button>
            <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
              Reload App
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
