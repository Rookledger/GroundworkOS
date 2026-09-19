import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/** Small uppercase section label - replaces the repeated inline heading style. */
export function Eyebrow({
  children,
  className,
  as: Tag = "p",
}: {
  children: ReactNode;
  className?: string;
  as?: "p" | "h4" | "span";
}) {
  return (
    <Tag
      className={cn(
        "text-[11px] font-bold uppercase tracking-widest",
        className,
      )}
      style={{ color: "var(--muted)", fontFamily: "var(--font-heading)" }}
    >
      {children}
    </Tag>
  );
}
