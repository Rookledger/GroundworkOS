import { cn } from "../../lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  danger?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  sub,
  accent,
  danger,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative p-5 rounded-xl overflow-hidden gw-shadow",
        className,
      )}
      style={{
        backgroundColor: "#fafaf8",
        border: danger ? "1px solid rgba(193,58,42,0.3)" : "1px solid #d9d4ce",
      }}
    >
      {danger && (
        <div
          className="absolute top-0 left-0 w-full"
          style={{ height: "3px", backgroundColor: "#c13a2a" }}
        />
      )}
      {accent && !danger && (
        <div
          className="absolute top-0 left-0 w-full"
          style={{ height: "3px", backgroundColor: "#1b5e78" }}
        />
      )}
      <p
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 600,
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "#7a7469",
          marginBottom: "12px",
        }}
      >
        {label}
      </p>
      <p
        className="tnum"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700,
          fontSize: "28px",
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: danger ? "#c13a2a" : "#181410",
          marginBottom: sub ? "8px" : 0,
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: "12px", color: "#7a7469", fontWeight: 500 }}>
          {sub}
        </p>
      )}
    </div>
  );
}
