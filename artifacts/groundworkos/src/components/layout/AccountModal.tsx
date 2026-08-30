import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "../../lib/authClient";

/**
 * Minimal in-app replacement for Clerk's hosted account-portal modal
 * (`openUserProfile`) - Better Auth has no equivalent hosted UI. Rather than
 * build a full account-management surface, this covers the one thing that
 * modal was actually used for here (per its old title: "Change password /
 * account security"): showing who's signed in and letting them change their
 * password via `authClient.changePassword`.
 */
export function AccountModal({
  open,
  onClose,
  name,
  email,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  email: string;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (error) {
        toast.error(error.message ?? "Failed to change password");
        return;
      }
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      onClose();
    } catch {
      toast.error("Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(24,20,16,0.4)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380,
          maxWidth: "100%",
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h2
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 16,
            color: "var(--ink)",
            marginBottom: 2,
          }}
        >
          {name}
        </h2>
        <p
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            color: "var(--muted)",
            marginBottom: 20,
          }}
        >
          {email}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <label
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: 11,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Current password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                backgroundColor: "#ffffff",
                color: "var(--ink)",
              }}
            />
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <label
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: 11,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              New password
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                backgroundColor: "#ffffff",
                color: "var(--ink)",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 6,
                backgroundColor: "transparent",
                color: "var(--ink-2)",
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: 12,
                border: "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 6,
                backgroundColor: "var(--accent)",
                color: "#fff",
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: 12,
                border: "none",
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
