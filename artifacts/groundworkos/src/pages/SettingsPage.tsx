import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  ShieldCheck,
  Info,
  Link2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Unlink,
  Download,
  Save,
  Upload,
  X,
  Building2,
  Receipt,
  Landmark,
  History,
  type LucideIcon,
} from "lucide-react";
import { Panel } from "../components/ui/Panel";
import { Btn } from "../components/ui/Btn";
import { useApp } from "../store/AppContext";
import { toast } from "sonner";
import type { CompanySettings } from "../store/AppContext";

function CardTitle({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 26, height: 26, backgroundColor: "var(--accent-bg)" }}
      >
        <Icon
          className="w-3.5 h-3.5"
          style={{ color: "var(--accent)" }}
          strokeWidth={1.5}
        />
      </span>
      {label}
    </span>
  );
}

function CardDescription({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs px-5 pt-3.5 pb-0.5" style={{ color: "var(--muted)" }}>
      {children}
    </p>
  );
}

function relativeTime(d: Date): string {
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const inputCls =
  "w-full py-2 px-3 text-sm focus:outline-none transition-colors";
const inputStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--border)",
  color: "var(--ink)",
};

function Inp({
  value,
  onChange,
  placeholder,
  type = "text",
  isMono = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  isMono?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${inputCls} ${isMono ? "font-mono tnum" : ""}`}
      style={inputStyle}
      onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
      onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
    />
  );
}

function SettingsRow({
  label,
  description,
  children,
  isLast,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--surface)]"
      style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}
    >
      <div className="sm:w-1/3 flex-shrink-0">
        <label
          className="block text-[11px] font-bold uppercase tracking-widest"
          style={{
            color: "var(--ink-2)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {label}
        </label>
        {description && (
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            {description}
          </p>
        )}
      </div>
      <div className="sm:w-2/3">{children}</div>
    </div>
  );
}

function SaveBar({
  onSave,
  onDiscard,
  saving,
  dirty,
  lastSavedAt,
}: {
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
  dirty: boolean;
  lastSavedAt?: Date;
}) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-3.5"
      style={{
        backgroundColor: "var(--bg)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <span className="text-xs" style={{ color: "var(--muted-2)" }}>
        {lastSavedAt
          ? `Last saved ${relativeTime(lastSavedAt)}`
          : dirty
            ? "Unsaved changes"
            : "No changes yet"}
      </span>
      <div className="flex items-center gap-2">
        {dirty && (
          <Btn
            size="sm"
            variant="outline"
            onClick={onDiscard}
            disabled={saving}
          >
            Discard
          </Btn>
        )}
        <Btn size="sm" onClick={onSave} disabled={saving || !dirty}>
          {saving ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
          ) : (
            <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
          )}
          {saving ? "Saving…" : "Save changes"}
        </Btn>
      </div>
    </div>
  );
}

const MAX_LOGO_BYTES = 1024 * 1024; // 1MB, well under the sqlite text column's practical limit

function LogoUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Logo must be smaller than 1MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-14 h-14 flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={{
          backgroundColor: "var(--bg)",
          border: "1px solid var(--border)",
        }}
      >
        {value ? (
          <img
            src={value}
            alt="Company logo"
            className="w-full h-full object-contain"
          />
        ) : (
          <Upload
            className="w-5 h-5"
            style={{ color: "var(--muted-2)" }}
            strokeWidth={1.5}
          />
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <Btn
        size="sm"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
        {value ? "Replace" : "Upload"}
      </Btn>
      {value && (
        <Btn size="sm" variant="outline" onClick={() => onChange("")}>
          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          Remove
        </Btn>
      )}
    </div>
  );
}

// ─── Accounting Integration Panel (Xero / QuickBooks / Sage / FreeAgent) ─────

type ProviderStatus =
  | { connected: false }
  | {
      connected: true;
      orgName: string | null;
      connectedAt: string;
      updatedAt: string;
      salesAccountCode?: string | null;
      purchasesAccountCode?: string | null;
    };
type SyncResult = { synced: number; failed: number } | null;

type ExtraSync = {
  label: string;
  syncKey: string;
  path: string;
  note?: string;
};

type SyncLogEntry = {
  id: string;
  direction: "push" | "pull";
  resource: string;
  succeeded: number;
  failed: number;
  detail: string | null;
  createdAt: string;
};

type XeroAccount = { code: string; name: string; type: string; class: string };

type AccountingProviderConfig = {
  key: string;
  label: string;
  orgNameField: string;
  orgFallback: string;
  description: string;
  /** Additional push/pull sync actions beyond the standard clients/invoices/quotes
   * push and payment-status pull every provider gets. Xero-only for now — the
   * underlying bill/supplier/credit-note push and account-code mapping only
   * exist on the Xero side of the API so far. */
  extraPushSyncs?: ExtraSync[];
  extraPullSyncs?: ExtraSync[];
  /** Shows a "Recent activity" panel backed by GET /api/{key}/sync/log. */
  supportsSyncLog?: boolean;
  /** Shows default sales/purchases account-code selectors backed by
   * GET /api/{key}/accounts and PUT /api/{key}/settings. */
  supportsAccountCodes?: boolean;
  /** Set to false for a provider whose OAuth/sync backend isn't wired up yet.
   * The panel shows a "Coming soon" badge and skips all status/sync calls
   * instead of offering a Connect button that would fail. */
  available?: boolean;
};

const ACCOUNTING_PROVIDERS: AccountingProviderConfig[] = [
  {
    key: "xero",
    label: "Xero",
    orgNameField: "tenantName",
    orgFallback: "Xero Organisation",
    description:
      "Connect to Xero to automatically sync your invoices, quotes, and client contacts — no more double-entry.",
    extraPushSyncs: [
      {
        label: "Sync Subcontractors",
        syncKey: "suppliers",
        path: "/api/xero/sync/suppliers",
      },
      {
        label: "Sync Purchase Orders",
        syncKey: "bills",
        path: "/api/xero/sync/bills",
      },
      {
        label: "Sync Credit Notes",
        syncKey: "credit-notes",
        path: "/api/xero/sync/credit-notes",
        note: 'Pushes a real Xero credit note for every invoice marked "credited" that hasn\'t been pushed yet.',
      },
    ],
    supportsSyncLog: true,
    supportsAccountCodes: true,
  },
  {
    key: "quickbooks",
    label: "QuickBooks",
    orgNameField: "companyName",
    orgFallback: "QuickBooks Company",
    description:
      "Connect to QuickBooks Online to sync your invoices, estimates, and customer contacts automatically.",
    available: false,
  },
  {
    key: "sage",
    label: "Sage",
    orgNameField: "businessName",
    orgFallback: "Sage Business",
    description:
      "Connect to Sage Accounting to sync your sales invoices, quotes, and contacts automatically.",
    available: false,
  },
  {
    key: "freeagent",
    label: "FreeAgent",
    orgNameField: "companyName",
    orgFallback: "FreeAgent Company",
    description:
      "Connect to FreeAgent to sync your invoices, estimates, and contacts automatically.",
    available: false,
  },
];

function AccountingProviderPanel({
  provider,
}: {
  provider: AccountingProviderConfig;
}) {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, SyncResult>>(
    {},
  );
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [salesAccountCode, setSalesAccountCode] = useState("");
  const [purchasesAccountCode, setPurchasesAccountCode] = useState("");
  const [savingAccountCodes, setSavingAccountCodes] = useState(false);

  async function fetchStatus() {
    try {
      const r = await fetch(`/api/${provider.key}/status`);
      const data = await r.json();
      if (data.connected) {
        setStatus({
          connected: true,
          orgName: data[provider.orgNameField] ?? null,
          connectedAt: data.connectedAt,
          updatedAt: data.updatedAt,
          salesAccountCode: data.salesAccountCode ?? null,
          purchasesAccountCode: data.purchasesAccountCode ?? null,
        });
        setSalesAccountCode(data.salesAccountCode ?? "");
        setPurchasesAccountCode(data.purchasesAccountCode ?? "");
      } else {
        setStatus({ connected: false });
      }
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }

  async function fetchSyncLog() {
    try {
      const r = await fetch(`/api/${provider.key}/sync/log`);
      const data = await r.json();
      if (Array.isArray(data.entries)) setSyncLog(data.entries);
    } catch {
      // Best-effort - the panel just shows nothing if this fails.
    }
  }

  async function fetchAccounts() {
    setAccountsLoading(true);
    try {
      const r = await fetch(`/api/${provider.key}/accounts`);
      const data = await r.json();
      if (Array.isArray(data.accounts)) setAccounts(data.accounts);
    } catch {
      // Best-effort - the selectors just fall back to free text below.
    } finally {
      setAccountsLoading(false);
    }
  }

  async function saveAccountCodes() {
    setSavingAccountCodes(true);
    try {
      const r = await fetch(`/api/${provider.key}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesAccountCode: salesAccountCode || null,
          purchasesAccountCode: purchasesAccountCode || null,
        }),
      });
      if (!r.ok) throw new Error("Failed to save account codes");
      toast.success("Default account codes saved.");
      fetchStatus();
    } catch (e) {
      setBanner({ type: "error", message: String(e) });
    } finally {
      setSavingAccountCodes(false);
    }
  }

  useEffect(() => {
    if (provider.available === false) {
      setLoading(false);
      return;
    }
    fetchStatus();
    if (provider.supportsSyncLog) fetchSyncLog();
    if (provider.supportsAccountCodes) fetchAccounts();
    const params = new URLSearchParams(window.location.search);
    const providerParam = params.get(provider.key);
    const msg = params.get("msg");

    if (providerParam === "connected") {
      setBanner({
        type: "success",
        message: `${provider.label} connected successfully.`,
      });
      window.history.replaceState({}, "", window.location.pathname);
      fetchStatus();
    } else if (providerParam === "error") {
      setBanner({
        type: "error",
        message: msg ?? `Failed to connect to ${provider.label}.`,
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSync(key: string, path: string) {
    setSyncing(key);
    setSyncResults((r) => ({ ...r, [key]: null }));
    try {
      const r = await fetch(path, { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Sync failed");
      setSyncResults((prev) => ({ ...prev, [key]: data }));
      if (provider.supportsSyncLog) fetchSyncLog();
    } catch (e) {
      setBanner({ type: "error", message: String(e) });
    } finally {
      setSyncing(null);
    }
  }

  async function handleDisconnect() {
    if (
      !confirm(
        `This will remove the ${provider.label} connection and all sync mapping data. Continue?`,
      )
    )
      return;
    setDisconnecting(true);
    try {
      await fetch(`/api/${provider.key}/disconnect`, { method: "DELETE" });
      setSyncResults({});
      setBanner({
        type: "success",
        message: `${provider.label} disconnected.`,
      });
      fetchStatus();
    } catch (e) {
      setBanner({ type: "error", message: String(e) });
    } finally {
      setDisconnecting(false);
    }
  }

  function SyncBtn({
    label,
    syncKey,
    path,
    icon,
  }: {
    label: string;
    syncKey: string;
    path: string;
    icon: React.ReactNode;
  }) {
    const res = syncResults[syncKey];
    const busy = syncing === syncKey;
    return (
      <div className="flex items-center gap-3">
        <Btn
          variant="outline"
          size="sm"
          onClick={() => runSync(syncKey, path)}
          disabled={!!syncing}
        >
          {busy ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
          ) : (
            icon
          )}
          {busy ? "Syncing…" : label}
        </Btn>
        {res && (
          <span
            className="text-xs font-mono tnum"
            style={{
              color: res.failed > 0 ? "var(--warning)" : "var(--success)",
            }}
          >
            {res.synced} synced{res.failed > 0 ? `, ${res.failed} failed` : ""}
          </span>
        )}
      </div>
    );
  }

  const connected = status?.connected === true;
  const orgName = connected
    ? (status as { orgName: string | null }).orgName
    : null;
  const connectedAt = connected
    ? (status as { connectedAt: string }).connectedAt
    : null;

  if (provider.available === false) {
    return (
      <Panel
        title={
          <CardTitle icon={Link2} label={`${provider.label} integration`} />
        }
        badge="Coming soon"
        noPad
      >
        <div className="px-5 py-6">
          <p className="text-sm mb-1" style={{ color: "var(--ink-2)" }}>
            {provider.description}
          </p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {provider.label} isn't available to connect yet — this
            integration is still being built. Xero is the only accounting
            connection supported right now.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title={<CardTitle icon={Link2} label={`${provider.label} integration`} />}
      badge={connected ? "Connected" : undefined}
      noPad
    >
      {banner && (
        <div
          className="flex items-center gap-3 px-5 py-3 text-sm"
          style={{
            backgroundColor:
              banner.type === "success"
                ? "var(--accent-bg)"
                : "var(--danger-bg)",
            borderBottom: "1px solid var(--border)",
            color:
              banner.type === "success" ? "var(--accent)" : "var(--danger)",
          }}
        >
          {banner.type === "success" ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
          )}
          <span>{banner.message}</span>
          <button
            className="ml-auto text-xs opacity-60 hover:opacity-100"
            onClick={() => setBanner(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="px-5 py-6 text-sm" style={{ color: "var(--muted)" }}>
          Checking connection…
        </div>
      ) : !connected ? (
        <div className="px-5 py-6">
          <p className="text-sm mb-4" style={{ color: "var(--ink-2)" }}>
            {provider.description}
          </p>
          <Btn
            onClick={() => {
              window.location.href = `/api/${provider.key}/auth`;
            }}
          >
            <Link2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            Connect to {provider.label}
          </Btn>
          <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
            You'll be redirected to {provider.label} to log in and authorise
            access with your own {provider.label} account.
          </p>
        </div>
      ) : (
        <>
          <div
            className="px-5 py-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-2 h-2 flex-shrink-0"
                style={{ backgroundColor: "var(--success)" }}
              />
              <span
                className="text-sm font-medium"
                style={{
                  color: "var(--ink)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {orgName ?? provider.orgFallback}
              </span>
            </div>
            {connectedAt && (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Connected{" "}
                {new Date(connectedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            )}
          </div>

          <div
            className="px-5 py-4 space-y-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-widest mb-3"
              style={{
                color: "var(--muted)",
                fontFamily: "var(--font-heading)",
              }}
            >
              Push to {provider.label}
            </p>
            <SyncBtn
              label="Sync Clients"
              syncKey="contacts"
              path={`/api/${provider.key}/sync/contacts`}
              icon={<RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />}
            />
            <SyncBtn
              label="Sync Invoices"
              syncKey="invoices"
              path={`/api/${provider.key}/sync/invoices`}
              icon={<RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />}
            />
            <SyncBtn
              label="Sync Quotes"
              syncKey="quotes"
              path={`/api/${provider.key}/sync/quotes`}
              icon={<RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />}
            />
            {(provider.extraPushSyncs ?? []).map((s) => (
              <div key={s.syncKey}>
                <SyncBtn
                  label={s.label}
                  syncKey={s.syncKey}
                  path={s.path}
                  icon={<RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />}
                />
                {s.note && (
                  <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
                    {s.note}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div
            className="px-5 py-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-widest mb-3"
              style={{
                color: "var(--muted)",
                fontFamily: "var(--font-heading)",
              }}
            >
              Pull from {provider.label}
            </p>
            <SyncBtn
              label="Pull Payment Status"
              syncKey="payments"
              path={`/api/${provider.key}/pull/payments`}
              icon={<Download className="w-3.5 h-3.5" strokeWidth={1.5} />}
            />
            <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
              Marks invoices as paid in GroundworkOS when they're marked paid in{" "}
              {provider.label}.
            </p>
            {(provider.extraPullSyncs ?? []).map((s) => (
              <div key={s.syncKey} className="mt-4">
                <SyncBtn
                  label={s.label}
                  syncKey={s.syncKey}
                  path={s.path}
                  icon={<Download className="w-3.5 h-3.5" strokeWidth={1.5} />}
                />
                {s.note && (
                  <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
                    {s.note}
                  </p>
                )}
              </div>
            ))}
          </div>

          {provider.supportsAccountCodes && (
            <div
              className="px-5 py-4 space-y-3"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-widest mb-1"
                style={{
                  color: "var(--muted)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                Default account codes
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Applied to line items when pushing sales documents and purchase
                bills. Leave blank to use {provider.label}'s own default
                account.
              </p>
              <div className="flex flex-wrap items-end gap-3 pt-1">
                <label className="flex flex-col gap-1 text-xs">
                  <span style={{ color: "var(--muted)" }}>Sales account</span>
                  <select
                    value={salesAccountCode}
                    onChange={(e) => setSalesAccountCode(e.target.value)}
                    className="py-2 px-3 text-sm focus:outline-none min-w-[220px]"
                    style={{
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--ink-2)",
                    }}
                  >
                    <option value="">
                      {accountsLoading ? "Loading…" : "Use default"}
                    </option>
                    {accounts
                      .filter((a) => a.class === "REVENUE")
                      .map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span style={{ color: "var(--muted)" }}>
                    Purchases account
                  </span>
                  <select
                    value={purchasesAccountCode}
                    onChange={(e) => setPurchasesAccountCode(e.target.value)}
                    className="py-2 px-3 text-sm focus:outline-none min-w-[220px]"
                    style={{
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--ink-2)",
                    }}
                  >
                    <option value="">
                      {accountsLoading ? "Loading…" : "Use default"}
                    </option>
                    {accounts
                      .filter((a) => a.class === "EXPENSE")
                      .map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                  </select>
                </label>
                <Btn
                  size="sm"
                  variant="outline"
                  onClick={saveAccountCodes}
                  disabled={savingAccountCodes}
                >
                  <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {savingAccountCodes ? "Saving…" : "Save"}
                </Btn>
              </div>
            </div>
          )}

          {provider.supportsSyncLog && (
            <div
              className="px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2"
                style={{
                  color: "var(--muted)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                <History className="w-3.5 h-3.5" strokeWidth={1.5} />
                Recent activity
              </p>
              {syncLog.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  Nothing synced yet.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {syncLog.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center gap-2 text-xs font-mono tnum"
                    >
                      <span style={{ color: "var(--muted-2)" }}>
                        {new Date(entry.createdAt).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span style={{ color: "var(--ink-2)" }}>
                        {entry.direction === "push" ? "→" : "←"}{" "}
                        {entry.resource}
                      </span>
                      <span
                        style={{
                          color:
                            entry.failed > 0
                              ? "var(--warning)"
                              : "var(--success)",
                        }}
                      >
                        {entry.detail
                          ? entry.detail
                          : `${entry.succeeded} ok${entry.failed > 0 ? `, ${entry.failed} failed` : ""}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="px-5 py-4" style={{ backgroundColor: "var(--bg)" }}>
            <Btn
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              <Unlink className="w-3.5 h-3.5" strokeWidth={1.5} />
              {disconnecting
                ? "Disconnecting…"
                : `Disconnect ${provider.label}`}
            </Btn>
          </div>
        </>
      )}
    </Panel>
  );
}

// ─── Settings Page ─────────────────────────────────────────────────────────────

async function saveSettings(body: Record<string, unknown>): Promise<void> {
  const r = await fetch("/api/settings/company", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Save failed");
}

function companyFromSettings(s: CompanySettings) {
  return {
    companyName: s.companyName,
    companyLogo: s.companyLogo,
    companyNumber: s.companyNumber,
    vatNumber: s.vatNumber,
    utrNumber: s.utrNumber,
    cisReference: s.cisReference,
    address: s.address,
  };
}
function invoiceFromSettings(s: CompanySettings) {
  return {
    invoicePrefix: s.invoicePrefix,
    quotePrefix: s.quotePrefix,
    jobPrefix: s.jobPrefix,
    paymentTerms: s.paymentTerms,
  };
}
function nrswaFromSettings(s: CompanySettings) {
  return {
    streetWorksLicenceRef: s.streetWorksLicenceRef,
    defaultPermitAuthority: s.defaultPermitAuthority,
  };
}
function bankFromSettings(s: CompanySettings) {
  return {
    bankName: s.bankName,
    sortCode: s.sortCode,
    accountNumber: s.accountNumber,
  };
}
function cisFromSettings(s: CompanySettings) {
  return {
    taxYearStart: s.taxYearStart,
    filingReminderDays: s.filingReminderDays,
  };
}

export function SettingsPage() {
  const { state, dispatch } = useApp();
  const s = state.settings;

  const [company, setCompany] = useState(companyFromSettings(s));
  const [invoiceSettings, setInvoiceSettings] = useState(
    invoiceFromSettings(s),
  );
  const [nrswa, setNrswa] = useState(nrswaFromSettings(s));
  const [bankDetails, setBankDetails] = useState(bankFromSettings(s));
  const [cisSettings, setCisSettings] = useState(cisFromSettings(s));

  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Record<string, Date>>({});

  const prevSettings = useRef(s);
  useEffect(() => {
    if (prevSettings.current === s) return;
    prevSettings.current = s;
    setCompany(companyFromSettings(s));
    setInvoiceSettings(invoiceFromSettings(s));
    setNrswa(nrswaFromSettings(s));
    setBankDetails(bankFromSettings(s));
    setCisSettings(cisFromSettings(s));
  }, [s]);

  const companyDirty =
    JSON.stringify(company) !== JSON.stringify(companyFromSettings(s));
  const invoiceDirty =
    JSON.stringify(invoiceSettings) !== JSON.stringify(invoiceFromSettings(s));
  const nrswaDirty =
    JSON.stringify(nrswa) !== JSON.stringify(nrswaFromSettings(s));
  const bankDirty =
    JSON.stringify(bankDetails) !== JSON.stringify(bankFromSettings(s));
  const cisDirty =
    JSON.stringify(cisSettings) !== JSON.stringify(cisFromSettings(s));

  async function save(section: string, patch: Partial<CompanySettings>) {
    setSavingSection(section);
    try {
      const merged = { ...s, ...patch };
      await saveSettings(merged as unknown as Record<string, unknown>);
      dispatch({ type: "INIT_SETTINGS", settings: patch });
      setLastSaved((prev) => ({ ...prev, [section]: new Date() }));
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSavingSection(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <h1
          className="text-2xl font-semibold"
          style={{
            color: "var(--ink)",
            fontFamily: "var(--font-heading)",
            letterSpacing: "-0.01em",
          }}
        >
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Company configuration, compliance, and preferences
        </p>
      </div>

      <Panel
        title={<CardTitle icon={Building2} label="Company details" />}
        noPad
      >
        <CardDescription>
          Core company information used across quotes, invoices, and the client
          portal.
        </CardDescription>
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-2">
          <SettingsRow
            label="Company Logo"
            description="Shown in the sidebar and on quotes, invoices, and purchase orders. PNG or SVG, up to 1MB."
          >
            <LogoUpload
              value={company.companyLogo}
              onChange={(v) => setCompany((c) => ({ ...c, companyLogo: v }))}
            />
          </SettingsRow>
          <SettingsRow
            label="Company Name"
            description="The legal or trading name shown on all documents."
          >
            <Inp
              value={company.companyName}
              onChange={(v) => setCompany((c) => ({ ...c, companyName: v }))}
              placeholder="Company name"
            />
          </SettingsRow>
          <SettingsRow
            label="Company Number"
            description="Companies House registration number."
          >
            <Inp
              value={company.companyNumber}
              onChange={(v) => setCompany((c) => ({ ...c, companyNumber: v }))}
              placeholder="Companies House number"
              isMono
            />
          </SettingsRow>
          <SettingsRow
            label="VAT Number"
            description="Printed on invoices when VAT registered."
          >
            <Inp
              value={company.vatNumber}
              onChange={(v) => setCompany((c) => ({ ...c, vatNumber: v }))}
              placeholder="VAT registration number"
              isMono
            />
          </SettingsRow>
          <SettingsRow
            label="UTR Number"
            description="Unique Taxpayer Reference, used for CIS filings."
          >
            <Inp
              value={company.utrNumber}
              onChange={(v) => setCompany((c) => ({ ...c, utrNumber: v }))}
              placeholder="Unique Taxpayer Reference"
              isMono
            />
          </SettingsRow>
          <SettingsRow
            label="CIS Reference"
            description="Your HMRC contractor reference."
          >
            <Inp
              value={company.cisReference}
              onChange={(v) => setCompany((c) => ({ ...c, cisReference: v }))}
              placeholder="CIS contractor reference"
              isMono
            />
          </SettingsRow>
          <SettingsRow
            label="Registered Address"
            description="Shown on the footer of PDF documents."
            isLast
          >
            <Inp
              value={company.address}
              onChange={(v) => setCompany((c) => ({ ...c, address: v }))}
              placeholder="Address"
            />
          </SettingsRow>
        </div>
        <SaveBar
          onSave={() => save("company", company)}
          onDiscard={() => setCompany(companyFromSettings(s))}
          saving={savingSection === "company"}
          dirty={companyDirty}
          lastSavedAt={lastSaved.company}
        />
      </Panel>

      <Panel
        title={<CardTitle icon={Receipt} label="Invoicing defaults" />}
        noPad
      >
        <CardDescription>
          Numbering prefixes and default terms applied to new quotes, invoices,
          and jobs.
        </CardDescription>
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-2">
          <SettingsRow
            label="Invoice Prefix"
            description="Prepended to every new invoice number."
          >
            <Inp
              value={invoiceSettings.invoicePrefix}
              onChange={(v) =>
                setInvoiceSettings((i) => ({ ...i, invoicePrefix: v }))
              }
              placeholder="INV"
              isMono
            />
          </SettingsRow>
          <SettingsRow
            label="Quote Prefix"
            description="Prepended to every new quote number."
          >
            <Inp
              value={invoiceSettings.quotePrefix}
              onChange={(v) =>
                setInvoiceSettings((i) => ({ ...i, quotePrefix: v }))
              }
              placeholder="QT"
              isMono
            />
          </SettingsRow>
          <SettingsRow
            label="Job Number Prefix"
            description="Prepended to every new job reference."
          >
            <Inp
              value={invoiceSettings.jobPrefix}
              onChange={(v) =>
                setInvoiceSettings((i) => ({ ...i, jobPrefix: v }))
              }
              placeholder="GW"
              isMono
            />
          </SettingsRow>
          <SettingsRow
            label="Default Payment Terms"
            description="Shown on invoices unless overridden per client."
            isLast
          >
            <Inp
              value={invoiceSettings.paymentTerms}
              onChange={(v) =>
                setInvoiceSettings((i) => ({ ...i, paymentTerms: v }))
              }
              placeholder="e.g. 30 days"
            />
          </SettingsRow>
        </div>
        <SaveBar
          onSave={() => save("invoiceSettings", invoiceSettings)}
          onDiscard={() => setInvoiceSettings(invoiceFromSettings(s))}
          saving={savingSection === "invoiceSettings"}
          dirty={invoiceDirty}
          lastSavedAt={lastSaved.invoiceSettings}
        />
      </Panel>

      <Panel title={<CardTitle icon={Landmark} label="Bank details" />} noPad>
        <div
          className="px-5 py-3"
          style={{
            backgroundColor: "var(--accent-bg)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <p className="text-xs" style={{ color: "var(--accent)" }}>
            Bank details are printed on PDF invoices. Keep these accurate.
          </p>
        </div>
        <SettingsRow label="Bank Name">
          <Inp
            value={bankDetails.bankName}
            onChange={(v) => setBankDetails((b) => ({ ...b, bankName: v }))}
            placeholder="e.g. Lloyds Bank"
          />
        </SettingsRow>
        <SettingsRow label="Sort Code">
          <Inp
            value={bankDetails.sortCode}
            onChange={(v) => setBankDetails((b) => ({ ...b, sortCode: v }))}
            placeholder="00-00-00"
            isMono
          />
        </SettingsRow>
        <SettingsRow label="Account Number" isLast>
          <Inp
            value={bankDetails.accountNumber}
            onChange={(v) =>
              setBankDetails((b) => ({ ...b, accountNumber: v }))
            }
            placeholder="12345678"
            isMono
          />
        </SettingsRow>
        <SaveBar
          onSave={() => save("bankDetails", bankDetails)}
          onDiscard={() => setBankDetails(bankFromSettings(s))}
          saving={savingSection === "bankDetails"}
          dirty={bankDirty}
          lastSavedAt={lastSaved.bankDetails}
        />
      </Panel>

      <Panel title="CIS Settings" noPad>
        <div
          className="px-5 py-4"
          style={{
            backgroundColor: "var(--accent-bg)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="flex gap-3">
            <ShieldCheck
              className="w-5 h-5 flex-shrink-0 mt-0.5"
              style={{ color: "var(--accent)" }}
            />
            <div
              className="text-sm leading-relaxed"
              style={{ color: "var(--ink)" }}
            >
              <strong className="font-semibold">
                Construction Industry Scheme
              </strong>{" "}
              — Configured as a CIS Contractor. Verify subcontractors with HMRC
              before payments; file monthly returns by the 19th.
            </div>
          </div>
        </div>
        <SettingsRow label="Tax Year Start">
          <Inp
            value={cisSettings.taxYearStart}
            onChange={(v) => setCisSettings((c) => ({ ...c, taxYearStart: v }))}
            placeholder="6 April"
          />
        </SettingsRow>
        <SettingsRow
          label="Filing Reminder"
          description="Days before the 19th"
          isLast
        >
          <Inp
            value={cisSettings.filingReminderDays}
            onChange={(v) =>
              setCisSettings((c) => ({ ...c, filingReminderDays: v }))
            }
            placeholder="5"
            type="number"
            isMono
          />
        </SettingsRow>
        <SaveBar
          onSave={() => save("cisSettings", cisSettings)}
          onDiscard={() => setCisSettings(cisFromSettings(s))}
          saving={savingSection === "cisSettings"}
          dirty={cisDirty}
          lastSavedAt={lastSaved.cisSettings}
        />
      </Panel>

      <Panel title="NRSWA / Street Works" noPad>
        <div
          className="px-5 py-4"
          style={{
            backgroundColor: "var(--surface-2)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="flex gap-3">
            <Info
              className="w-5 h-5 flex-shrink-0 mt-0.5"
              style={{ color: "var(--muted)" }}
            />
            <div
              className="text-sm leading-relaxed"
              style={{ color: "var(--ink-2)" }}
            >
              <strong className="font-semibold text-[var(--ink)]">
                New Roads and Street Works Act 1991
              </strong>{" "}
              — Company registered with relevant Highway Authority. Ensure all
              operatives carry valid NRSWA cards for works on the public
              highway.
            </div>
          </div>
        </div>
        <SettingsRow label="Street Works Licence Ref">
          <Inp
            value={nrswa.streetWorksLicenceRef}
            onChange={(v) =>
              setNrswa((n) => ({ ...n, streetWorksLicenceRef: v }))
            }
            placeholder="SWL-2024-00123"
            isMono
          />
        </SettingsRow>
        <SettingsRow label="Default Permit Authority" isLast>
          <Inp
            value={nrswa.defaultPermitAuthority}
            onChange={(v) =>
              setNrswa((n) => ({ ...n, defaultPermitAuthority: v }))
            }
            placeholder="e.g. Transport for West Midlands"
          />
        </SettingsRow>
        <SaveBar
          onSave={() => save("nrswa", nrswa)}
          onDiscard={() => setNrswa(nrswaFromSettings(s))}
          saving={savingSection === "nrswa"}
          dirty={nrswaDirty}
          lastSavedAt={lastSaved.nrswa}
        />
      </Panel>

      {ACCOUNTING_PROVIDERS.map((provider) => (
        <AccountingProviderPanel key={provider.key} provider={provider} />
      ))}
    </div>
  );
}
