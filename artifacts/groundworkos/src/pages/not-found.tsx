import { Link } from "wouter";
import { Compass, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "50vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 20px",
            borderRadius: 12,
            border: "1.5px solid #1b5e78",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#e8f3f7",
          }}
        >
          <Compass style={{ width: 26, height: 26, color: "#1b5e78" }} />
        </div>

        <p
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: "#1b5e78",
            marginBottom: 10,
          }}
        >
          ERROR 404
        </p>

        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 24,
            letterSpacing: "-0.01em",
            color: "#181410",
            marginBottom: 10,
          }}
        >
          Off the map
        </h1>

        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 14,
            lineHeight: 1.6,
            color: "#7a7469",
            marginBottom: 28,
          }}
        >
          This page doesn't exist, or you don't have access to it. Check the
          address, or head back to the dashboard.
        </p>

        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            borderRadius: 7,
            backgroundColor: "#1b5e78",
            color: "#ffffff",
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
