import { cn } from "../../lib/utils";

export function ProgressBar({
  value,
  className,
  height = "h-1.5",
}: {
  value: number;
  className?: string;
  height?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("overflow-hidden", height, className)}
      style={{ backgroundColor: "var(--surface-3)" }}
    >
      <div
        className="h-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: "var(--success)" }}
      />
    </div>
  );
}
