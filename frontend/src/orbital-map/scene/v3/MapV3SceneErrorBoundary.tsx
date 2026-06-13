import { Component, type ErrorInfo, type ReactNode } from "react";
import { Html } from "@react-three/drei";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class MapV3SceneErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[KspWebMap] Map V3 scene failed", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Html center>
          <div
            style={{
              color: "#ffb4b4",
              background: "rgba(7,16,25,0.92)",
              padding: "10px 14px",
              borderRadius: "6px",
              fontSize: "12px",
              maxWidth: "320px",
              border: "1px solid #c44",
            }}
          >
            Map V3 error: {this.state.error.message}
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}
