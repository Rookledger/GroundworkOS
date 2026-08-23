import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, children, wide }: ModalProps) {
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
      style={{
        backgroundColor: "rgba(24,20,16,0.32)",
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "w-full max-h-[90vh] overflow-y-auto rounded-xl",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
        style={{
          backgroundColor: "#fafaf8",
          border: "1px solid #d9d4ce",
          boxShadow:
            "0 24px 60px -12px rgba(24,20,16,0.22), 0 8px 20px -8px rgba(24,20,16,0.12)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{
            borderBottom: "1px solid #d9d4ce",
            backgroundColor: "#fafaf8",
          }}
        >
          <h2
            className="text-base font-semibold"
            style={{
              color: "#181410",
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[#eeeae4] transition-colors"
            style={{ color: "#7a7469" }}
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
        className="block text-xs font-medium uppercase tracking-widest mb-1.5"
        style={{ color: "#7a7469", letterSpacing: "0.07em" }}
      >
        {label}
        {required && <span style={{ color: "#c13a2a" }}> *</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs" style={{ color: "#c13a2a" }}>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="mt-1 text-xs" style={{ color: "#c0bab4" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

const inputCls =
  "w-full py-2 px-3 rounded-md text-sm focus:outline-none transition-colors";
const inputStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #d9d4ce",
  color: "#181410",
};
const inputErrorStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #c13a2a",
  color: "#181410",
};
const inputFocusBorder = "#1b5e78";
const inputBlurBorder = "#d9d4ce";

export function Input({
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      {...props}
      className={cn(inputCls, props.className)}
      style={error ? inputErrorStyle : inputStyle}
      onFocus={(e) => {
        (e.target as HTMLInputElement).style.borderColor = inputFocusBorder;
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        (e.target as HTMLInputElement).style.borderColor = error
          ? "#c13a2a"
          : inputBlurBorder;
        props.onBlur?.(e);
      }}
    />
  );
}

export function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(inputCls, props.className)}
      style={inputStyle}
      onFocus={(e) => {
        (e.target as HTMLSelectElement).style.borderColor = inputFocusBorder;
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        (e.target as HTMLSelectElement).style.borderColor = inputBlurBorder;
        props.onBlur?.(e);
      }}
    >
      {children}
    </select>
  );
}

export function Textarea({
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(inputCls, "resize-none", props.className)}
      style={{ ...inputStyle, minHeight: "80px" }}
      onFocus={(e) => {
        (e.target as HTMLTextAreaElement).style.borderColor = inputFocusBorder;
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        (e.target as HTMLTextAreaElement).style.borderColor = inputBlurBorder;
        props.onBlur?.(e);
      }}
    />
  );
}
