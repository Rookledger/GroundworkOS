import { useState } from "react";
import {
  CheckCircle,
  ChevronRight,
  Building2,
  MapPin,
  Banknote,
} from "lucide-react";
import { Btn } from "./ui/Btn";
import { useApp } from "../store/AppContext";
import { toast } from "sonner";

const BASE = (import.meta as any).env?.BASE_URL?.replace(/\/$/, "") ?? "";

const STEP_CONFIG = [
  {
    icon: Building2,
    title: "Company details",
    desc: "Your registered company information",
  },
  { icon: MapPin, title: "Address & contact", desc: "Where you operate from" },
  {
    icon: Banknote,
    title: "Payment details",
    desc: "Bank details for invoices",
  },
];

interface Props {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: Props) {
  const { dispatch } = useApp();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    companyNumber: "",
    vatNumber: "",
    utrNumber: "",
    cisReference: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    invoicePrefix: "INV",
    quotePrefix: "QT",
    jobPrefix: "GW",
    paymentTerms: "30 days",
    bankName: "",
    sortCode: "",
    accountNumber: "",
  });

  const set =
    (k: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function finish() {
    if (!form.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`${BASE}/api/settings/company`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName.trim(),
          companyNumber: form.companyNumber.trim(),
          vatNumber: form.vatNumber.trim(),
          utrNumber: form.utrNumber.trim(),
          cisReference: form.cisReference.trim(),
          address: form.address.trim(),
          invoicePrefix: form.invoicePrefix || "INV",
          quotePrefix: form.quotePrefix || "QT",
          jobPrefix: form.jobPrefix || "GW",
          paymentTerms: form.paymentTerms || "30 days",
          bankName: form.bankName.trim(),
          sortCode: form.sortCode.trim(),
          accountNumber: form.accountNumber.trim(),
        }),
      });
      if (!r.ok) throw new Error("Failed to save company settings");
      dispatch({
        type: "INIT_SETTINGS",
        settings: {
          companyName: form.companyName.trim(),
          companyNumber: form.companyNumber.trim(),
          vatNumber: form.vatNumber.trim(),
          utrNumber: form.utrNumber.trim(),
          cisReference: form.cisReference.trim(),
          address: form.address.trim(),
          invoicePrefix: form.invoicePrefix || "INV",
          quotePrefix: form.quotePrefix || "QT",
          jobPrefix: form.jobPrefix || "GW",
          paymentTerms: form.paymentTerms || "30 days",
          bankName: form.bankName.trim(),
          sortCode: form.sortCode.trim(),
          accountNumber: form.accountNumber.trim(),
        },
      });
      onComplete();
    } catch {
      toast.error("Failed to save — check your connection and try again");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full py-2.5 px-3 rounded-lg text-sm focus:outline-none transition-all";
  const inputStyle = {
    backgroundColor: "#ffffff",
    border: "1.5px solid #d9d4ce",
    color: "#181410",
  };
  const labelCls =
    "block text-[10px] font-bold uppercase tracking-widest mb-1.5";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "#f0ede8" }}
    >
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: "15px",
                color: "#181410",
                letterSpacing: "0.04em",
              }}
            >
              GROUNDWORK<span style={{ color: "#1b5e78" }}>OS</span>
            </span>
          </div>
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: "24px",
              color: "#181410",
              letterSpacing: "-0.02em",
            }}
          >
            Let's get you set up
          </h1>
          <p style={{ color: "#7a7469", fontSize: "14px", marginTop: "6px" }}>
            Takes about 2 minutes — you can change everything in Settings later.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEP_CONFIG.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={
                    i < step
                      ? { backgroundColor: "#2a6e45", color: "#ffffff" }
                      : i === step
                        ? { backgroundColor: "#1b5e78", color: "#ffffff" }
                        : { backgroundColor: "#e0dbd5", color: "#a8a099" }
                  }
                >
                  {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span
                  className="hidden sm:block text-xs font-medium"
                  style={{ color: i === step ? "#181410" : "#a8a099" }}
                >
                  {s.title}
                </span>
              </div>
              {i < STEP_CONFIG.length - 1 && (
                <div
                  className="w-8 h-px"
                  style={{ backgroundColor: i < step ? "#2a6e45" : "#d9d4ce" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: "#fafaf8",
            border: "1px solid #d9d4ce",
            boxShadow: "0 8px 32px rgba(24,20,16,0.08)",
          }}
        >
          <div
            className="px-6 py-5"
            style={{
              borderBottom: "1px solid #e8e4dd",
              backgroundColor: "#fafaf8",
            }}
          >
            <div className="flex items-center gap-3">
              {(() => {
                const Icon = STEP_CONFIG[step].icon;
                return (
                  <Icon className="w-5 h-5" style={{ color: "#1b5e78" }} />
                );
              })()}
              <div>
                <h2
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 600,
                    fontSize: "16px",
                    color: "#181410",
                  }}
                >
                  {STEP_CONFIG[step].title}
                </h2>
                <p style={{ fontSize: "12px", color: "#7a7469" }}>
                  {STEP_CONFIG[step].desc}
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            {step === 0 && (
              <>
                <div>
                  <label className={labelCls} style={{ color: "#7a7469" }}>
                    Company name *
                  </label>
                  <input
                    autoFocus
                    value={form.companyName}
                    onChange={set("companyName")}
                    placeholder="e.g. Groundwork Solutions Ltd"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls} style={{ color: "#7a7469" }}>
                      Company number
                    </label>
                    <input
                      value={form.companyNumber}
                      onChange={set("companyNumber")}
                      placeholder="e.g. 12345678"
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "#7a7469" }}>
                      VAT number
                    </label>
                    <input
                      value={form.vatNumber}
                      onChange={set("vatNumber")}
                      placeholder="e.g. GB123456789"
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "#7a7469" }}>
                      UTR number
                    </label>
                    <input
                      value={form.utrNumber}
                      onChange={set("utrNumber")}
                      placeholder="10-digit UTR"
                      className={`${inputCls} font-mono`}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "#7a7469" }}>
                      CIS reference
                    </label>
                    <input
                      value={form.cisReference}
                      onChange={set("cisReference")}
                      placeholder="CIS contractor ref"
                      className={`${inputCls} font-mono`}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  {[
                    {
                      k: "invoicePrefix" as const,
                      label: "Invoice prefix",
                      ph: "INV",
                    },
                    {
                      k: "quotePrefix" as const,
                      label: "Quote prefix",
                      ph: "QT",
                    },
                    { k: "jobPrefix" as const, label: "Job prefix", ph: "GW" },
                  ].map(({ k, label, ph }) => (
                    <div key={k}>
                      <label className={labelCls} style={{ color: "#7a7469" }}>
                        {label}
                      </label>
                      <input
                        value={form[k]}
                        onChange={set(k)}
                        placeholder={ph}
                        className={`${inputCls} font-mono`}
                        style={inputStyle}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div>
                  <label className={labelCls} style={{ color: "#7a7469" }}>
                    Registered address
                  </label>
                  <textarea
                    value={form.address}
                    onChange={set("address")}
                    placeholder="123 High Street&#10;Birmingham&#10;B1 1AA"
                    rows={3}
                    className={`${inputCls} resize-none`}
                    style={inputStyle}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls} style={{ color: "#7a7469" }}>
                      Phone
                    </label>
                    <input
                      value={form.phone}
                      onChange={set("phone")}
                      placeholder="e.g. 0121 000 0000"
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "#7a7469" }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={set("email")}
                      placeholder="info@yourcompany.co.uk"
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls} style={{ color: "#7a7469" }}>
                    Website (optional)
                  </label>
                  <input
                    value={form.website}
                    onChange={set("website")}
                    placeholder="https://yourcompany.co.uk"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "#7a7469" }}>
                    Default payment terms
                  </label>
                  <select
                    value={form.paymentTerms}
                    onChange={set("paymentTerms")}
                    className={inputCls}
                    style={inputStyle}
                  >
                    {["7 days", "14 days", "30 days", "60 days"].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div
                  className="p-3 rounded-lg text-sm"
                  style={{ backgroundColor: "#e8f3f7", color: "#1b5e78" }}
                >
                  These details appear on your invoices so clients know where to
                  send payment.
                </div>
                <div>
                  <label className={labelCls} style={{ color: "#7a7469" }}>
                    Bank name
                  </label>
                  <input
                    value={form.bankName}
                    onChange={set("bankName")}
                    placeholder="e.g. Barclays Business"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls} style={{ color: "#7a7469" }}>
                      Sort code
                    </label>
                    <input
                      value={form.sortCode}
                      onChange={set("sortCode")}
                      placeholder="00-00-00"
                      className={`${inputCls} font-mono tracking-widest`}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "#7a7469" }}>
                      Account number
                    </label>
                    <input
                      value={form.accountNumber}
                      onChange={set("accountNumber")}
                      placeholder="00000000"
                      className={`${inputCls} font-mono tracking-widest`}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderTop: "1px solid #e8e4dd" }}
          >
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="text-sm font-medium transition-opacity disabled:opacity-30"
              style={{ color: "#7a7469" }}
            >
              ← Back
            </button>

            <div className="flex items-center gap-3">
              {step < 2 ? (
                <>
                  <button
                    onClick={() => setStep((s) => s + 1)}
                    className="text-sm"
                    style={{ color: "#a8a099" }}
                  >
                    Skip for now
                  </button>
                  <Btn
                    onClick={() => {
                      if (step === 0 && !form.companyName.trim()) {
                        toast.error("Company name is required");
                        return;
                      }
                      setStep((s) => s + 1);
                    }}
                  >
                    Continue <ChevronRight className="w-4 h-4" />
                  </Btn>
                </>
              ) : (
                <Btn onClick={finish} disabled={saving}>
                  {saving ? "Saving…" : "Go to Dashboard"}{" "}
                  <ChevronRight className="w-4 h-4" />
                </Btn>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: "#a8a099" }}>
          All details can be changed later in Settings
        </p>
      </div>
    </div>
  );
}
