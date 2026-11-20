import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class StartupErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Manager desktop failed to start", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="shell">
          <p className="mark">Manager</p>
          <h1>Could not start Manager</h1>
          <p>{this.state.error.message}</p>
          <p>
            Check the Convex URL, Clerk publishable key, and network access, then
            rebuild the app.
          </p>
        </main>
      );
    }
    return this.props.children;
  }
}
