import { cn } from "../../lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-[#e8e4dd] animate-pulse rounded", className)} />
  );
}
