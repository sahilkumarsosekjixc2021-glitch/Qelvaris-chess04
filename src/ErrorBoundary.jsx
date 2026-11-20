// QV-DEPLOY: koi page crash ho toh poora white screen nahi, ek simple "reload" screen dikhe.
import { Component } from "react";
import { trackError } from "./features/telemetry/track"; // QV-TRACK

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("App crashed:", error);
    trackError("crash", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#080a0f",
          color: "#eef1f6",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Something went wrong.</h1>
          <p style={{ margin: "0 0 18px", color: "#8c97ab", fontSize: 14 }}>
            Your saved games are safe in this browser. Reload to try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 20px",
              border: 0,
              borderRadius: 10,
              background: "#f7b538",
              color: "#211607",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
