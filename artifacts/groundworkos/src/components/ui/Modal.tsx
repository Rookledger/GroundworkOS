import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { CornerMarks } from "./Blueprint";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, children, wide }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--overlay)", backdropFilter: "blur(2px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "blueprint w-full max-h-[90vh] overflow-y-auto",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
        style={{
          backgroundColor: "var(--surface)",
          boxShadow: "var(--shadow-pop)",
        }}
      >
        <CornerMarks />
        <div
          className="flex items-center justify-between px-5 py-3 sticky top-0 z-10"
          style={{
            borderBottom: "1px solid var(--border)",
            backgroundColor: "var(--surface)",
          }}
        >
          <h2
            id={titleId}
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: 18,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="gw-icon-btn hover:bg-[var(--surface-2)]"
            style={{ color: "var(--muted)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
  error?: string;
}

export function Field({ label, required, children, hint, error }: FieldProps) {
  return (
    <div>
      <label
        className="block text-xs font-bold uppercase mb-1.5"
        style={{
          color: "var(--muted)",
          fontFamily: "var(--font-heading)",
          letterSpacing: "0.08em",
        }}
      >
        {label}
        {required && <span style={{ color: "var(--danger)" }}> *</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs" style={{ color: "var(--danger-ink)" }}>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function Input({
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={error || undefined}
      className={cn("gw-input", className)}
    />
  );
}

export function Select({
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn("gw-input", className)}>
      {children}
    </select>
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn("gw-input resize-none", className)}
      style={{ minHeight: "80px", ...props.style }}
    />
  );
}
