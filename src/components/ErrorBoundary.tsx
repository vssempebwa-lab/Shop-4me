import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last-resort crash screen. Without it, one rendering error blanks the whole
 * app with no way back. Hook an error reporter (e.g. Sentry) into
 * componentDidCatch once one is chosen.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled app error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-gray-50 px-4">
        <section className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-6 text-center shadow-xl">
          <h1 className="text-xl font-extrabold text-brand-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-500">
            Sorry, this page hit an unexpected error. Reload to try again. If you already placed an order,
            it is safe: find it under Help → Track Order with your order code and phone number.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
            >
              Reload
            </button>
            <a
              href="/"
              className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
            >
              Go to home
            </a>
          </div>
          {import.meta.env.DEV && (
            <pre className="mt-5 max-h-40 overflow-auto rounded-xl bg-gray-50 p-3 text-left text-[11px] text-red-700">
              {this.state.error.message}
            </pre>
          )}
        </section>
      </main>
    );
  }
}
