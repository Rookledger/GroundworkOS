import type { LucideIcon } from "lucide-react";
import { CornerMarks } from "./Blueprint";
import { Btn } from "./Btn";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  hint?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  hint,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 gap-4">
      <div
        className="blueprint relative flex items-center justify-center flex-shrink-0"
        style={{
          width: 62,
          height: 62,
          backgroundColor: "var(--accent-bg)",
        }}
      >
        <CornerMarks />
        <Icon className="w-6 h-6" style={{ color: "var(--accent)" }} strokeWidth={1.5} />
      </div>
      <div className="max-w-sm">
        <h3
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: "18px",
            color: "var(--ink)",
          }}
        >
          {title}
        </h3>
        <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
          {description}
        </p>
      </div>
      {(primaryLabel || secondaryLabel) && (
        <div className="flex items-center gap-2.5 mt-1">
          {primaryLabel && (
            <Btn variant="primary" onClick={onPrimary}>
              {primaryLabel}
            </Btn>
          )}
          {secondaryLabel && (
            <Btn variant="outline" onClick={onSecondary}>
              {secondaryLabel}
            </Btn>
          )}
        </div>
      )}
      {hint && (
        <p className="text-xs" style={{ color: "var(--muted-2)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

interface ChartEmptyStateProps {
  icon: LucideIcon;
  title?: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function ChartEmptyState({
  icon: Icon,
  title = "No data yet",
  description = "Data will appear here once you log your first invoice.",
  ctaLabel,
  onCta,
}: ChartEmptyStateProps) {
  return (
    <div className="relative flex flex-col items-center justify-center text-center gap-3 py-10">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent 40px)",
          opacity: 0.6,
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <Icon className="w-8 h-8" style={{ color: "var(--muted-2)" }} strokeWidth={1.5} />
        <div>
          <p
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: "15px",
              color: "var(--ink-2)",
            }}
          >
            {title}
          </p>
          <p className="mt-1 text-xs max-w-xs" style={{ color: "var(--muted)" }}>
            {description}
          </p>
        </div>
        {ctaLabel && (
          <Btn variant="primary" size="sm" onClick={onCta} className="mt-1">
            {ctaLabel}
          </Btn>
        )}
      </div>
    </div>
  );
}
