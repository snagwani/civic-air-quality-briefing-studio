import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * Top-level React Error Boundary that catches unexpected runtime rendering exceptions
 * and provides a user-safe recovery control without crashing the application.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught UI Error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-screen flex items-center justify-center bg-slate-50 p-6"
        >
          <div className="max-w-md w-full rounded-xl bg-white border border-red-300 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-900">
              <AlertTriangle className="w-6 h-6 text-red-700 shrink-0" aria-hidden="true" />
              <h1 className="text-lg font-bold">Application Recovery Notice</h1>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              An unexpected rendering error occurred:{' '}
              <code className="font-mono bg-red-50 px-1 py-0.5 rounded text-red-950">
                {this.state.errorMessage}
              </code>
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Reset Workspace View
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
