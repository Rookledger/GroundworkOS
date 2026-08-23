import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { Panel } from "../components/ui/Panel";
import { Btn } from "../components/ui/Btn";
import { useApp } from "../store/AppContext";
import { toast } from "sonner";
import type { CompanySettings } from "../store/AppContext";

const inputCls =
  "w-full py-2 px-3 rounded-md text-sm focus:outline-none transition-colors";
const inputStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #d9d4ce",
  color: "#181410",
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
      onFocus={(e) => (e.target.style.borderColor = "#1b5e78")}
      onBlur={(e) => (e.target.style.borderColor = "#d9d4ce")}
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
      className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 transition-colors hover:bg-[#fafaf8]"
      style={{ borderBottom: isLast ? "none" : "1px solid #d9d4ce" }}
    >
      <div className="sm:w-1/3 flex-shrink-0">
        <label
          className="block text-[11px] font-bold uppercase tracking-widest"
          style={{
            color: "#4a4540",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {label}
        </label>
        {description && (
          <p className="text-xs mt-1" style={{ color: "#7a7469" }}>
            {description}
          </p>
        )}
      </div>
      <div className="sm:w-2/3">{children}</div>
    </div>
  );
}

function SaveBar({ onSave, saving }: { onSave: () => void; saving: boolean }) {
  return (
    <div
      className="px-5 py-4"
      style={{ backgroundColor: "#f0ede8", borderTop: "1px solid #d9d4ce" }}
    >
      <Btn size="sm" onClick={onSave} disabled={saving}>
        {saving ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Save className="w-3.5 h-3.5" />
        )}
        {saving ? "Saving…" : "Save"}
      </Btn>
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
    };
type SyncResult = { synced: number; failed: number } | null;

type AccountingProviderConfig = {
  key: string;
  label: string;
  orgNameField: string;
  orgFallback: string;
  description: string;
};

const ACCOUNTING_PROVIDERS: AccountingProviderConfig[] = [
  {
    key: "xero",
    label: "Xero",
    orgNameField: "tenantName",
    orgFallback: "Xero Organisation",
    description:
      "Connect to Xero to automatically sync your invoices, quotes, and client contacts — no more double-entry.",
  },
  {
    key: "quickbooks",
    label: "QuickBooks",
    orgNameField: "companyName",
    orgFallback: "QuickBooks Company",
    description:
      "Connect to QuickBooks Online to sync your invoices, estimates, and customer contacts automatically.",
  },
  {
    key: "sage",
    label: "Sage",
    orgNameField: "businessName",
    orgFallback: "Sage Business",
    description:
      "Connect to Sage Accounting to sync your sales invoices, quotes, and contacts automatically.",
  },
  {
    key: "freeagent",
    label: "FreeAgent",
    orgNameField: "companyName",
    orgFallback: "FreeAgent Company",
    description:
      "Connect to FreeAgent to sync your invoices, estimates, and contacts automatically.",
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
        });
      } else {
        setStatus({ connected: false });
      }
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
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
          {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : icon}
          {busy ? "Syncing…" : label}
        </Btn>
        {res && (
          <span
            className="text-xs font-mono tnum"
            style={{ color: res.failed > 0 ? "#b56918" : "#2a6e45" }}
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

  return (
    <Panel
      title={`${provider.label} Integration`}
      badge={connected ? "Connected" : undefined}
      noPad
    >
      {banner && (
        <div
          className="flex items-center gap-3 px-5 py-3 text-sm"
          style={{
            backgroundColor: banner.type === "success" ? "#e8f3f7" : "#fdf2f2",
            borderBottom: "1px solid #d9d4ce",
            color: banner.type === "success" ? "#1b5e78" : "#c13a2a",
          }}
        >
          {banner.type === "success" ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
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
        <div className="px-5 py-6 text-sm" style={{ color: "#7a7469" }}>
          Checking connection…
        </div>
      ) : !connected ? (
        <div className="px-5 py-6">
          <p className="text-sm mb-4" style={{ color: "#4a4540" }}>
            {provider.description}
          </p>
          <Btn
            onClick={() => {
              window.location.href = `/api/${provider.key}/auth`;
            }}
          >
            <Link2 className="w-3.5 h-3.5" />
            Connect to {provider.label}
          </Btn>
          <p className="text-xs mt-3" style={{ color: "#7a7469" }}>
            You'll be redirected to {provider.label} to log in and authorise
            access with your own {provider.label} account.
          </p>
        </div>
      ) : (
        <>
          <div
            className="px-5 py-4"
            style={{ borderBottom: "1px solid #d9d4ce" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: "#2a6e45" }}
              />
              <span
                className="text-sm font-medium"
                style={{
                  color: "#181410",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {orgName ?? provider.orgFallback}
              </span>
            </div>
            {connectedAt && (
              <p className="text-xs" style={{ color: "#7a7469" }}>
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
            style={{ borderBottom: "1px solid #d9d4ce" }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-widest mb-3"
              style={{
                color: "#7a7469",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Push to {provider.label}
            </p>
            <SyncBtn
              label="Sync Clients"
              syncKey="contacts"
              path={`/api/${provider.key}/sync/contacts`}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            />
            <SyncBtn
              label="Sync Invoices"
              syncKey="invoices"
              path={`/api/${provider.key}/sync/invoices`}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            />
            <SyncBtn
              label="Sync Quotes"
              syncKey="quotes"
              path={`/api/${provider.key}/sync/quotes`}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            />
          </div>

          <div
            className="px-5 py-4"
            style={{ borderBottom: "1px solid #d9d4ce" }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-widest mb-3"
              style={{
                color: "#7a7469",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Pull from {provider.label}
            </p>
            <SyncBtn
              label="Pull Payment Status"
              syncKey="payments"
              path={`/api/${provider.key}/pull/payments`}
              icon={<Download className="w-3.5 h-3.5" />}
            />
            <p className="text-xs mt-2" style={{ color: "#7a7469" }}>
              Marks invoices as paid in GroundworkOS when they're marked paid in{" "}
              {provider.label}.
            </p>
          </div>

          <div className="px-5 py-4" style={{ backgroundColor: "#f0ede8" }}>
            <Btn
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              <Unlink className="w-3.5 h-3.5" />
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

export function SettingsPage() {
  const { state, dispatch } = useApp();
  const s = state.settings;

  const [company, setCompany] = useState({
    companyName: s.companyName,
    companyNumber: s.companyNumber,
    vatNumber: s.vatNumber,
    utrNumber: s.utrNumber,
    cisReference: s.cisReference,
    address: s.address,
  });

  const [invoiceSettings, setInvoiceSettings] = useState({
    invoicePrefix: s.invoicePrefix,
    quotePrefix: s.quotePrefix,
    jobPrefix: s.jobPrefix,
    paymentTerms: s.paymentTerms,
  });

  const [nrswa, setNrswa] = useState({
    streetWorksLicenceRef: s.streetWorksLicenceRef,
    defaultPermitAuthority: s.defaultPermitAuthority,
  });

  const [bankDetails, setBankDetails] = useState({
    bankName: s.bankName,
    sortCode: s.sortCode,
    accountNumber: s.accountNumber,
  });

  const [cisSettings, setCisSettings] = useState({
    taxYearStart: s.taxYearStart,
    filingReminderDays: s.filingReminderDays,
  });

  const [savingSection, setSavingSection] = useState<string | null>(null);

  const prevSettings = useRef(s);
  useEffect(() => {
    if (prevSettings.current === s) return;
    prevSettings.current = s;
    setCompany({
      companyName: s.companyName,
      companyNumber: s.companyNumber,
      vatNumber: s.vatNumber,
      utrNumber: s.utrNumber,
      cisReference: s.cisReference,
      address: s.address,
    });
    setInvoiceSettings({
      invoicePrefix: s.invoicePrefix,
      quotePrefix: s.quotePrefix,
      jobPrefix: s.jobPrefix,
      paymentTerms: s.paymentTerms,
    });
    setNrswa({
      streetWorksLicenceRef: s.streetWorksLicenceRef,
      defaultPermitAuthority: s.defaultPermitAuthority,
    });
    setBankDetails({
      bankName: s.bankName,
      sortCode: s.sortCode,
      accountNumber: s.accountNumber,
    });
    setCisSettings({
      taxYearStart: s.taxYearStart,
      filingReminderDays: s.filingReminderDays,
    });
  }, [s]);

  async function save(section: string, patch: Partial<CompanySettings>) {
    setSavingSection(section);
    try {
      const merged = { ...s, ...patch };
      await saveSettings(merged as unknown as Record<string, unknown>);
      dispatch({ type: "INIT_SETTINGS", settings: patch });
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
            color: "#181410",
            fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: "-0.01em",
          }}
        >
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: "#7a7469" }}>
          Company configuration, compliance, and preferences
        </p>
      </div>

      <Panel title="Company Details" noPad>
        <SettingsRow label="Company Name">
          <Inp
            value={company.companyName}
            onChange={(v) => setCompany((c) => ({ ...c, companyName: v }))}
            placeholder="Company name"
          />
        </SettingsRow>
        <SettingsRow label="Company Number">
          <Inp
            value={company.companyNumber}
            onChange={(v) => setCompany((c) => ({ ...c, companyNumber: v }))}
            placeholder="Companies House number"
            isMono
          />
        </SettingsRow>
        <SettingsRow label="VAT Number">
          <Inp
            value={company.vatNumber}
            onChange={(v) => setCompany((c) => ({ ...c, vatNumber: v }))}
            placeholder="VAT registration number"
            isMono
          />
        </SettingsRow>
        <SettingsRow label="UTR Number" description="Unique Taxpayer Reference">
          <Inp
            value={company.utrNumber}
            onChange={(v) => setCompany((c) => ({ ...c, utrNumber: v }))}
            placeholder="Unique Taxpayer Reference"
            isMono
          />
        </SettingsRow>
        <SettingsRow label="CIS Reference" description="Contractor reference">
          <Inp
            value={company.cisReference}
            onChange={(v) => setCompany((c) => ({ ...c, cisReference: v }))}
            placeholder="CIS contractor reference"
            isMono
          />
        </SettingsRow>
        <SettingsRow label="Registered Address" isLast>
          <Inp
            value={company.address}
            onChange={(v) => setCompany((c) => ({ ...c, address: v }))}
            placeholder="Address"
          />
        </SettingsRow>
        <SaveBar
          onSave={() => save("company", company)}
          saving={savingSection === "company"}
        />
      </Panel>

      <Panel title="Invoice & Numbering" noPad>
        <SettingsRow label="Invoice Prefix">
          <Inp
            value={invoiceSettings.invoicePrefix}
            onChange={(v) =>
              setInvoiceSettings((i) => ({ ...i, invoicePrefix: v }))
            }
            placeholder="INV"
            isMono
          />
        </SettingsRow>
        <SettingsRow label="Quote Prefix">
          <Inp
            value={invoiceSettings.quotePrefix}
            onChange={(v) =>
              setInvoiceSettings((i) => ({ ...i, quotePrefix: v }))
            }
            placeholder="QT"
            isMono
          />
        </SettingsRow>
        <SettingsRow label="Job Number Prefix">
          <Inp
            value={invoiceSettings.jobPrefix}
            onChange={(v) =>
              setInvoiceSettings((i) => ({ ...i, jobPrefix: v }))
            }
            placeholder="GW"
            isMono
          />
        </SettingsRow>
        <SettingsRow label="Default Payment Terms" isLast>
          <Inp
            value={invoiceSettings.paymentTerms}
            onChange={(v) =>
              setInvoiceSettings((i) => ({ ...i, paymentTerms: v }))
            }
            placeholder="e.g. 30 days"
          />
        </SettingsRow>
        <SaveBar
          onSave={() => save("invoiceSettings", invoiceSettings)}
          saving={savingSection === "invoiceSettings"}
        />
      </Panel>

      <Panel title="Bank Details" noPad>
        <div
          className="px-5 py-3"
          style={{
            backgroundColor: "#e8f3f7",
            borderBottom: "1px solid #d9d4ce",
          }}
        >
          <p className="text-xs" style={{ color: "#1b5e78" }}>
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
          saving={savingSection === "bankDetails"}
        />
      </Panel>

      <Panel title="CIS Settings" noPad>
        <div
          className="px-5 py-4"
          style={{
            backgroundColor: "#e8f3f7",
            borderBottom: "1px solid #d9d4ce",
          }}
        >
          <div className="flex gap-3">
            <ShieldCheck
              className="w-5 h-5 flex-shrink-0 mt-0.5"
              style={{ color: "#1b5e78" }}
            />
            <div
              className="text-sm leading-relaxed"
              style={{ color: "#181410" }}
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
          saving={savingSection === "cisSettings"}
        />
      </Panel>

      <Panel title="NRSWA / Street Works" noPad>
        <div
          className="px-5 py-4"
          style={{
            backgroundColor: "#eeeae4",
            borderBottom: "1px solid #d9d4ce",
          }}
        >
          <div className="flex gap-3">
            <Info
              className="w-5 h-5 flex-shrink-0 mt-0.5"
              style={{ color: "#7a7469" }}
            />
            <div
              className="text-sm leading-relaxed"
              style={{ color: "#4a4540" }}
            >
              <strong className="font-semibold text-[#181410]">
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
          saving={savingSection === "nrswa"}
        />
      </Panel>

      {ACCOUNTING_PROVIDERS.map((provider) => (
        <AccountingProviderPanel key={provider.key} provider={provider} />
      ))}
    </div>
  );
}
