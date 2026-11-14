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
          className="min-h-screen flex items-center justify-center bg-[#07070c] p-6"
        >
          <div className="max-w-md w-full rounded-2xl bg-[#101018] border border-rose-500/80 shadow-[0_0_30px_rgba(225,29,72,0.3)] p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-200">
              <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" aria-hidden="true" />
              <h1 className="text-lg font-bold text-white">Application Recovery Notice</h1>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              An unexpected rendering error occurred:{' '}
              <code className="font-mono bg-rose-950 px-1.5 py-0.5 rounded text-rose-200">
                {this.state.errorMessage}
              </code>
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold cursor-pointer"
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
