import { cn } from "../../lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md";
  loading?: boolean;
  children: ReactNode;
}

export function Btn({
  variant = "primary",
  size = "md",
  loading,
  children,
  className,
  disabled,
  ...props
}: BtnProps) {
  const base =
    "inline-flex items-center gap-1.5 transition-all duration-100 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed";
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
  };
  const fonts = {
    fontFamily: "var(--font-heading)",
    fontWeight: 600,
    letterSpacing: "0.01em",
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: { backgroundColor: "var(--accent)", color: "#ffffff", ...fonts },
    ghost: { backgroundColor: "transparent", color: "var(--muted)", ...fonts },
    danger: {
      backgroundColor: "var(--danger-bg)",
      color: "var(--danger)",
      border: "1px solid rgba(178,58,38,0.4)",
      ...fonts,
    },
    outline: {
      backgroundColor: "transparent",
      color: "var(--ink-2)",
      border: "1px solid var(--border-2)",
      ...fonts,
    },
  };

  return (
    <button
      className={cn(base, sizes[size], className)}
      style={{ borderRadius: 0, ...variantStyles[variant] }}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
      ) : null}
      {children}
    </button>
  );
}
