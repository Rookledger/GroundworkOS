import { cn } from "../../lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-[var(--surface-3)] animate-pulse rounded", className)} />
  );
}
