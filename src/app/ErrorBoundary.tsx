import { Component, type ReactNode } from "react";

/** Catches render errors so a crash shows a message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override render() {
    if (this.state.error) {
      return (
        <main data-testid="app-root">
          <div className="start-screen">
            <h1>Something went wrong</h1>
            <p role="alert">{this.state.error.message}</p>
            <button onClick={() => { location.hash = "#/"; location.reload(); }}>Back to start</button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
