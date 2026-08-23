import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[GroundworkOS] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f0ede8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
          padding: "24px",
        }}
      >
        <div
          style={{
            background: "#fafaf8",
            border: "1px solid #d9d4ce",
            borderRadius: "12px",
            padding: "48px 40px",
            maxWidth: "480px",
            width: "100%",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              background: "#fef2f2",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
            }}
          >
            <AlertTriangle size={28} color="#dc2626" />
          </div>

          <h1
            style={{
              fontFamily: "'Space Grotesk', Arial, sans-serif",
              fontWeight: 700,
              fontSize: "20px",
              color: "#1a1814",
              margin: "0 0 8px",
              letterSpacing: "-0.02em",
            }}
          >
            Something went wrong
          </h1>

          <p
            style={{
              fontSize: "14px",
              color: "#7a7469",
              lineHeight: "1.6",
              margin: "0 0 32px",
            }}
          >
            An unexpected error occurred. Your data is safe — try refreshing the
            page or returning to the dashboard.
          </p>

          {this.state.error && (
            <details
              style={{
                textAlign: "left",
                background: "#f0ede8",
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "28px",
                fontSize: "12px",
                color: "#7a7469",
                fontFamily: "'JetBrains Mono', monospace",
                cursor: "pointer",
              }}
            >
              <summary
                style={{
                  fontWeight: 600,
                  marginBottom: "8px",
                  cursor: "pointer",
                }}
              >
                Error details
              </summary>
              {this.state.error.message}
            </details>
          )}

          <div
            style={{ display: "flex", gap: "12px", justifyContent: "center" }}
          >
            <button
              onClick={() => window.location.reload()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "#1b5e78",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={15} />
              Refresh page
            </button>

            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = "/";
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "transparent",
                color: "#1b5e78",
                border: "1px solid #d9d4ce",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Home size={15} />
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}
