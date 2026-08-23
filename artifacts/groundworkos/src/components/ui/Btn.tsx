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
    "inline-flex items-center gap-1.5 rounded-md transition-all duration-100 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed";
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
  };
  const fonts = { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: { backgroundColor: "#1b5e78", color: "#ffffff", ...fonts },
    ghost: { backgroundColor: "transparent", color: "#7a7469", ...fonts },
    danger: {
      backgroundColor: "rgba(193,58,42,0.08)",
      color: "#c13a2a",
      border: "1px solid rgba(193,58,42,0.2)",
      ...fonts,
    },
    outline: {
      backgroundColor: "transparent",
      color: "#4a4540",
      border: "1px solid #d9d4ce",
      ...fonts,
    },
  };

  return (
    <button
      className={cn(base, sizes[size], className)}
      style={variantStyles[variant]}
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
