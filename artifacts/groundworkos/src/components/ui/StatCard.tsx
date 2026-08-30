import { cn } from "../../lib/utils";
import { CornerMarks } from "./Blueprint";

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
      className={cn("blueprint relative p-5 overflow-hidden gw-shadow", className)}
      style={{
        backgroundColor: "var(--surface)",
        borderColor: danger ? "rgba(178,58,38,0.4)" : "var(--border)",
      }}
    >
      <CornerMarks />
      {danger && (
        <div
          className="absolute top-0 left-0 w-full"
          style={{ height: "3px", backgroundColor: "var(--danger)" }}
        />
      )}
      {accent && !danger && (
        <div
          className="absolute top-0 left-0 w-full"
          style={{ height: "3px", backgroundColor: "var(--accent)" }}
        />
      )}
      <p
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--muted)",
          marginBottom: "12px",
        }}
      >
        {label}
      </p>
      <p
        className="tnum"
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 600,
          fontSize: "30px",
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: danger ? "var(--danger-ink)" : "var(--ink)",
          marginBottom: sub ? "8px" : 0,
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>
          {sub}
        </p>
      )}
    </div>
  );
}
