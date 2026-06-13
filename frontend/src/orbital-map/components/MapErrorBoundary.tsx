import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class MapErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[KspWebMap] Map render failed", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="ksp-solar-warning" role="alert">
          Map failed to render: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}
