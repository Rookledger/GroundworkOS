import type { TooltipProps } from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { formatCurrency } from "../../lib/utils";

/**
 * Shared recharts tooltip, used by every chart across the Reports page's
 * tabs. Typed against recharts' own `TooltipProps` rather than `any` -
 * pulling this out of ReportsPage.tsx (tech-debt audit finding #14) was a
 * convenient point to also drop the two `any`s it used, since recharts
 * already ships the real prop types for a custom tooltip's `content`.
 */
export function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2.5 gw-shadow text-xs"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="font-medium mb-1.5"
        style={{ color: "var(--ink)", fontFamily: "var(--font-body)" }}
      >
        {label}
      </div>
      {payload.map((p) => (
        <div
          key={p.name}
          className="flex items-center justify-between gap-4 mb-0.5"
        >
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 flex-shrink-0"
              style={{ backgroundColor: p.color }}
            />
            <span style={{ color: "var(--muted)" }}>{p.name}</span>
          </div>
          <span
            className="tnum"
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-body)",
            }}
          >
            {typeof p.value === "number" && p.value > 100
              ? formatCurrency(p.value)
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}
