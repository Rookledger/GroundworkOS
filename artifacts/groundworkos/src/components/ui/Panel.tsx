import { cn } from "../../lib/utils";
import type { ReactNode } from "react";

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
      className={cn("rounded-xl overflow-hidden gw-shadow", className)}
      style={{
        backgroundColor: "#fafaf8",
        border: "1px solid #d9d4ce",
      }}
    >
      {title && (
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: "1px solid #d9d4ce" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <h3
              className="truncate"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: "15px",
                letterSpacing: "-0.01em",
                color: "#181410",
              }}
            >
              {title}
            </h3>
            {badge !== undefined && (
              <span
                className="flex-shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: "rgba(193,58,42,0.1)",
                  color: "#c13a2a",
                  fontFamily: "'JetBrains Mono', monospace",
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
