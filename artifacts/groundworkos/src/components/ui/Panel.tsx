import { cn } from "../../lib/utils";
import type { ReactNode } from "react";
import { CornerMarks } from "./Blueprint";

interface PanelProps {
  title?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  noPad?: boolean;
}

export function Panel({
  title,
  actions,
  badge,
  children,
  className,
  noPad,
}: PanelProps) {
  return (
    <div
      className={cn("blueprint gw-shadow", className)}
      style={{ backgroundColor: "var(--surface)" }}
    >
      <CornerMarks />
      {(title || actions) && (
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {title && (
              <h3
                className="truncate"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: "16px",
                  letterSpacing: "-0.01em",
                  color: "var(--ink)",
                }}
              >
                {title}
              </h3>
            )}
            {badge !== undefined && (
              <span
                className="flex-shrink-0 inline-flex items-center justify-center px-2 py-0.5"
                style={{
                  backgroundColor: "var(--surface-3)",
                  color: "var(--ink-2)",
                  fontFamily: "var(--font-heading)",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {badge}
              </span>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      )}
      <div className={noPad ? "" : "p-5"}>{children}</div>
    </div>
  );
}
