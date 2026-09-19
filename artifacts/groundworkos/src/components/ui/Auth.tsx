import type { FormEventHandler, InputHTMLAttributes, ReactNode } from "react";
import { Btn } from "./Btn";
import { CornerMarks } from "./Blueprint";

/**
 * Shared shell for the signed-out screens (sign in, first-run setup, accept
 * invitation). Uses the brand tokens (Barlow, square corners, navy shadow) so
 * the first screen a user sees matches the rest of the app.
 */
export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg)" }}
    >
      {children}
    </div>
  );
}

export function AuthCard({
  title,
  subtitle,
  onSubmit,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const inner = (
    <>
      <CornerMarks />
      <div className="flex items-center gap-2.5 mb-6">
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            background:
              "repeating-linear-gradient(135deg,var(--amber) 0 4px,var(--ink-navy) 4px 8px)",
            border: "1px solid var(--ink-navy)",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: "0.02em",
            color: "var(--ink-navy)",
          }}
        >
          GROUNDWORK<span style={{ color: "var(--amber)" }}>OS</span>
        </span>
      </div>
      <h1
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: 26,
          lineHeight: 1.1,
          color: "var(--ink)",
          marginBottom: 4,
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
          {subtitle}
        </p>
      )}
      <div style={{ display: "grid", gap: 16 }}>{children}</div>
      {footer && (
        <p
          style={{
            marginTop: 20,
            fontSize: 13,
            color: "var(--muted)",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          {footer}
        </p>
      )}
    </>
  );
  const cls = "blueprint gw-shadow w-full p-8";
  const style = { maxWidth: 400, backgroundColor: "var(--surface)" };
  return onSubmit ? (
    <form onSubmit={onSubmit} className={cls} style={style}>
      {inner}
    </form>
  ) : (
    <div className={cls} style={style}>
      {inner}
    </div>
  );
}

export function AuthField({
  label,
  id,
  ...props
}: { label: string; id: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label
        htmlFor={id}
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: 12,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </label>
      <input id={id} className="gw-input" {...props} />
    </div>
  );
}

export function AuthError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" style={{ color: "var(--danger-ink)", fontSize: 13 }}>
      {children}
    </p>
  );
}

export function AuthSubmit({
  loading,
  children,
}: {
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <Btn type="submit" loading={loading} className="w-full justify-center">
      {children}
    </Btn>
  );
}
