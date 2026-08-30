import { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Clock,
  ArrowRight,
  ChevronRight,
  MapPin,
  Briefcase,
  Users,
  Truck,
  Activity,
  PlusCircle,
  Edit2,
  Trash2,
  BarChart3,
} from "lucide-react";
import { Link } from "wouter";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { Btn } from "../components/ui/Btn";
import { ChartEmptyState } from "../components/ui/EmptyState";
import { CornerMarks } from "../components/ui/Blueprint";
import { formatCurrency, formatDate } from "../lib/utils";
import { useApp } from "../store/AppContext";
import { useRole, isAtLeast } from "../hooks/useRole";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DashboardStats {
  pendingQuotes: number;
  activeSubcons: number;
  plantCount: number;
  docAlerts: number;
}

// Matches the shape GET /api/audit-logs actually returns: drizzle-orm's
// `db.select().from(auditLogsTable)` serializes rows using the table's JS
// property names (see lib/db/src/schema/audit_logs.ts), which are
// camelCase - not the snake_case column names underneath. AuditLogPage.tsx
// (the /audit page) reads this same endpoint and already expects camelCase
// (entityType, userName, createdAt); this interface previously used
// snake_case field names that never matched a real response, so every
// field read off `entry` here was `undefined`.
interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, any> | null;
  userName: string | null;
  createdAt: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2.5 gw-shadow text-xs"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="font-medium mb-1.5"
        style={{ color: "var(--ink)", fontFamily: "var(--font-body)" }}
      >
        {label}
      </div>
      {payload.map((p: any) => (
        <div
          key={p.name}
          className="flex items-center justify-between gap-4 mb-0.5"
        >
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 flex-shrink-0"
              style={{ backgroundColor: p.color }}
            />
            <span style={{ color: "var(--muted)" }}>{p.name}</span>
          </div>
          <span
            className="tnum"
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {typeof p.value === "number" ? formatCurrency(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// Hero tile for Pipeline — larger frame, bigger numeral, accent-lit. Built to
// match StatCard's blueprint/token language since StatCard doesn't support
// this asymmetric hero sizing.
function HeroStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      className="blueprint relative p-6 overflow-hidden gw-shadow flex flex-col justify-center"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <CornerMarks />
      <div
        className="absolute top-0 left-0 w-full"
        style={{ height: "4px", backgroundColor: "var(--accent)" }}
      />
      <p
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: "12px",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--accent)",
          marginBottom: "14px",
        }}
      >
        {label}
      </p>
      <p
        className="tnum"
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: "52px",
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: "var(--ink)",
          marginBottom: sub ? "10px" : 0,
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: "13px", color: "var(--muted)", fontWeight: 500 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

type AttentionVariant = "danger" | "warning" | "neutral";

// "Needs attention" tile — colored top bar + icon + big numeral when there's
// something to act on, and a neutral all-clear variant (grey bar, check
// icon, no CTA) when the underlying value is 0. Driven off the actual data
// value, never a separate flag.
function AttentionTile({
  variant,
  icon: Icon,
  label,
  value,
  sub,
  ctaLabel,
  ctaHref,
}: {
  variant: AttentionVariant;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
  label: string;
  value: string;
  sub: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const tone =
    variant === "danger"
      ? { bar: "var(--danger)", ink: "var(--danger-ink)", border: "rgba(178,58,38,0.3)" }
      : variant === "warning"
        ? { bar: "var(--warning)", ink: "var(--warning-ink)", border: "rgba(184,115,12,0.3)" }
        : { bar: "var(--border-2)", ink: "var(--ink)", border: "var(--border)" };

  const body = (
    <div
      className="blueprint relative p-5 overflow-hidden gw-shadow h-full flex flex-col"
      style={{ backgroundColor: "var(--surface)", borderColor: tone.border }}
    >
      <CornerMarks />
      <div
        className="absolute top-0 left-0 w-full"
        style={{ height: "4px", backgroundColor: tone.bar }}
      />
      <div className="flex items-center gap-2 mb-3">
        <Icon
          className="w-4 h-4 flex-shrink-0"
          style={{ color: variant === "neutral" ? "var(--muted)" : tone.ink }}
          strokeWidth={1.5}
        />
        <p
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--muted)",
          }}
        >
          {label}
        </p>
      </div>
      <p
        className="tnum"
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: "38px",
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: variant === "neutral" ? "var(--ink)" : tone.ink,
          marginBottom: "8px",
        }}
      >
        {value}
      </p>
      <p className="text-xs flex-1" style={{ color: "var(--muted)" }}>
        {sub}
      </p>
      {ctaLabel && (
        <div
          className="text-xs font-semibold mt-3 flex items-center gap-1"
          style={{ color: tone.ink, fontFamily: "var(--font-heading)" }}
        >
          {ctaLabel} <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );

  if (ctaHref) {
    return (
      <Link href={ctaHref} className="block h-full cursor-pointer">
        {body}
      </Link>
    );
  }
  return body;
}

const ENTITY_LABELS: Record<string, string> = {
  job: "Job",
  quote: "Quote",
  invoice: "Invoice",
  client: "Client",
  subcontractor: "Subcon",
  document: "Document",
  plant: "Plant",
  timesheet: "Timesheet",
  purchase_order: "Purchase Order",
};

const ACTION_ICON: Record<string, React.ReactNode> = {
  create: <PlusCircle className="w-3.5 h-3.5" style={{ color: "var(--success)" }} strokeWidth={1.5} />,
  update: <Edit2 className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} strokeWidth={1.5} />,
  delete: <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--danger)" }} strokeWidth={1.5} />,
};

const ACTION_COLOR: Record<string, string> = {
  create: "var(--success)",
  update: "var(--accent)",
  delete: "var(--danger)",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getChangeSummary(
  action: string,
  changes: Record<string, any> | null,
): string {
  if (action === "delete") return "deleted";
  if (!changes || typeof changes !== "object")
    return action === "create" ? "created" : "updated";
  const keys = Object.keys(changes).filter(
    (k) => !["id", "created_at", "updated_at"].includes(k),
  );
  if (keys.length === 0) return action === "create" ? "created" : "updated";
  if (action === "create") return `created`;
  return `updated ${keys.slice(0, 2).join(", ")}${keys.length > 2 ? ` +${keys.length - 2}` : ""}`;
}

export function DashboardPage() {
  const { state } = useApp();
  const { jobs, invoices, documents } = state;

  const [extraStats, setExtraStats] = useState<DashboardStats | null>(null);
  const [activityFeed, setActivityFeed] = useState<AuditEntry[]>([]);
  const role = useRole();
  const isAdmin = isAtLeast(role, "admin");

  useEffect(() => {
    fetch(`${BASE}/api/dashboard`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setExtraStats(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // The audit trail is admin-only; skip the fetch for non-admins so the
    // Recent Activity panel isn't populated (or 403'd) for them.
    if (!isAdmin) return;
    fetch(`${BASE}/api/audit-logs?limit=10&days=30`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AuditEntry[] | null) => {
        if (data) setActivityFeed(data);
      })
      .catch(() => {});
  }, [isAdmin]);

  const activeJobs = jobs.filter((j) => j.status === "active");
  const outstandingInvoices = invoices.filter(
    (i) => i.status === "sent" || i.status === "overdue",
  );
  const overdueInvoices = invoices.filter((i) => i.status === "overdue");
  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const totalOutstanding = outstandingInvoices.reduce(
    (s, i) => s + i.total_amount,
    0,
  );
  const totalOverdue = overdueInvoices.reduce((s, i) => s + i.total_amount, 0);
  const totalCollected = paidInvoices.reduce((s, i) => s + i.total_amount, 0);
  const totalPipeline = jobs
    .filter((j) => j.status !== "cancelled")
    .reduce((s, j) => s + (j.value ?? 0), 0);
  const expiringDocs = documents.filter((d) => d.status === "expiring_soon");
  const expiredDocs = documents.filter((d) => d.status === "expired");
  const complianceDocs = [...expiredDocs, ...expiringDocs];

  const daysOverdue = (dueDate: string | null): number => {
    if (!dueDate) return 0;
    return Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
  };

  const agedDebtorInvoices = useMemo(
    () => outstandingInvoices.filter((i) => daysOverdue(i.due_date) >= 90),
    [outstandingInvoices],
  );
  const totalAgedDebtors = agedDebtorInvoices.reduce(
    (s, i) => s + i.total_amount,
    0,
  );

  const agedBands = useMemo(() => {
    const bands = [
      { key: "0-30", label: "0–30d", min: 0, max: 30, value: 0, color: "var(--border-2)" },
      { key: "31-60", label: "31–60d", min: 31, max: 60, value: 0, color: "var(--muted-2)" },
      { key: "61-90", label: "61–90d", min: 61, max: 90, value: 0, color: "var(--warning)" },
      { key: "90+", label: "90+d", min: 91, max: Infinity, value: 0, color: "var(--danger)" },
    ];
    for (const inv of outstandingInvoices) {
      const days = Math.max(0, daysOverdue(inv.due_date));
      const band = bands.find((b) => days >= b.min && days <= b.max) ?? bands[0];
      band.value += inv.total_amount;
    }
    return bands;
  }, [outstandingInvoices]);

  const largestRiskBand = useMemo(
    () => agedBands.reduce((max, b) => (b.value > max.value ? b : max), agedBands[0]),
    [agedBands],
  );
  const agedTotal = agedBands.reduce((s, b) => s + b.value, 0);
  const riskCalloutText = useMemo(() => {
    if (agedTotal === 0) return "";
    const pct = Math.round((largestRiskBand.value / agedTotal) * 100);
    if (largestRiskBand.key === "90+" || largestRiskBand.key === "61-90") {
      return `${pct}% of outstanding debt sits in the ${largestRiskBand.label} band — ${largestRiskBand.key === "90+" ? "chase these first" : "watch closely"}.`;
    }
    return `Debt is concentrated in the ${largestRiskBand.label} band — collection is healthy.`;
  }, [agedTotal, largestRiskBand]);

  const monthMap = new Map<
    string,
    { invoiced: number; collected: number; month: string }
  >();
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-GB", { month: "short" });
    monthMap.set(key, { invoiced: 0, collected: 0, month: label });
  }
  for (const inv of invoices) {
    const key = inv.issued_date?.slice(0, 7) ?? "";
    if (monthMap.has(key)) monthMap.get(key)!.invoiced += inv.total_amount;
  }
  for (const inv of paidInvoices) {
    if (!inv.paid_at) continue;
    const key = inv.paid_at.slice(0, 7);
    if (monthMap.has(key)) monthMap.get(key)!.collected += inv.total_amount;
  }
  const revenueData = Array.from(monthMap.values());

  const alertCount = overdueInvoices.length + complianceDocs.length;
  const hasAlerts = alertCount > 0;

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      {/* Money in motion — Pipeline is the hero; Collected/Outstanding are
          quiet secondary readouts in the same row. */}
      <div>
        <h2
          className="text-xs font-bold uppercase tracking-widest mb-3"
          style={{ color: "var(--muted)", fontFamily: "var(--font-heading)" }}
        >
          Money in motion
        </h2>
        <div className="grid grid-cols-1 lg:[grid-template-columns:1.5fr_1fr_1fr] gap-4">
          <HeroStat
            label="Pipeline"
            value={formatCurrency(totalPipeline)}
            sub={`${activeJobs.length} active job${activeJobs.length !== 1 ? "s" : ""} in progress`}
          />
          <StatCard
            label="Collected"
            value={formatCurrency(totalCollected)}
            sub={`${paidInvoices.length} paid invoices`}
          />
          <StatCard
            label="Outstanding"
            value={formatCurrency(totalOutstanding)}
            sub={`${outstandingInvoices.length} invoices`}
          />
        </div>
      </div>

      {/* Needs attention — hazard-striped subsection heading; each tile
          swaps to a neutral all-clear variant when its underlying value is
          zero, never showing red urgency at £0. */}
      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <span
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, var(--danger) 0 3px, var(--ink-navy) 3px 6px)",
            }}
          />
          <h2
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "var(--danger)", fontFamily: "var(--font-heading)" }}
          >
            Needs attention
          </h2>
          <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {overdueInvoices.length > 0 ? (
            <AttentionTile
              variant="danger"
              icon={AlertTriangle}
              label="Overdue"
              value={formatCurrency(totalOverdue)}
              sub={`${overdueInvoices.length} invoice${overdueInvoices.length !== 1 ? "s" : ""} past due date`}
              ctaLabel="Chase now"
              ctaHref="/invoices"
            />
          ) : (
            <AttentionTile
              variant="neutral"
              icon={CheckCircle}
              label="Overdue"
              value={formatCurrency(0)}
              sub="Nothing overdue right now"
            />
          )}

          {agedDebtorInvoices.length > 0 ? (
            <AttentionTile
              variant="warning"
              icon={Clock}
              label="Aged debtors 90+"
              value={formatCurrency(totalAgedDebtors)}
              sub={`${agedDebtorInvoices.length} invoice${agedDebtorInvoices.length !== 1 ? "s" : ""} 90+ days overdue`}
              ctaLabel="Open ledger"
              ctaHref="/invoices"
            />
          ) : (
            <AttentionTile
              variant="neutral"
              icon={CheckCircle}
              label="Aged debtors 90+"
              value={formatCurrency(0)}
              sub="No debt aged past 90 days"
            />
          )}

          <AttentionTile
            variant={complianceDocs.length > 0 ? "warning" : "neutral"}
            icon={complianceDocs.length > 0 ? ShieldAlert : ShieldCheck}
            label="Compliance"
            value={String(complianceDocs.length)}
            sub={
              complianceDocs.length > 0
                ? `${expiredDocs.length} expired · ${expiringDocs.length} expiring soon`
                : "All documents in date"
            }
          />
        </div>
      </div>

      {/* Quick-glance operational counts */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/jobs">
          <div
            className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:opacity-80"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "var(--accent-bg)" }}
            >
              <Briefcase className="w-4 h-4" style={{ color: "var(--accent)" }} strokeWidth={1.5} />
            </div>
            <div>
              <div
                className="text-xs font-medium uppercase tracking-widest mb-0.5"
                style={{
                  color: "var(--muted)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                Quotes Pending
              </div>
              <div
                className="text-xl font-bold"
                style={{
                  color: "var(--ink)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {extraStats
                  ? extraStats.pendingQuotes
                  : jobs.filter((j) => j.status === "quoted").length}
              </div>
            </div>
          </div>
        </Link>
        <Link href="/subcontractors">
          <div
            className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:opacity-80"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "var(--success-bg)" }}
            >
              <Users className="w-4 h-4" style={{ color: "var(--success)" }} strokeWidth={1.5} />
            </div>
            <div>
              <div
                className="text-xs font-medium uppercase tracking-widest mb-0.5"
                style={{
                  color: "var(--muted)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                Active Subcons
              </div>
              <div
                className="text-xl font-bold"
                style={{
                  color: "var(--ink)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {extraStats?.activeSubcons ?? "—"}
              </div>
            </div>
          </div>
        </Link>
        <Link href="/plant">
          <div
            className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:opacity-80"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "var(--warning-bg)" }}
            >
              <Truck className="w-4 h-4" style={{ color: "var(--warning)" }} strokeWidth={1.5} />
            </div>
            <div>
              <div
                className="text-xs font-medium uppercase tracking-widest mb-0.5"
                style={{
                  color: "var(--muted)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                Plant Items
              </div>
              <div
                className="text-xl font-bold"
                style={{
                  color: "var(--ink)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {extraStats?.plantCount ?? "—"}
              </div>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Panel
            title="Revenue vs collected — last 6 months"
            actions={
              <Link href="/reports">
                <Btn variant="ghost" size="sm">
                  Reports <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
                </Btn>
              </Link>
            }
          >
            {invoices.length === 0 ? (
              <ChartEmptyState
                icon={BarChart3}
                ctaLabel="Raise your first invoice"
                onCta={() => (window.location.href = `${BASE}/invoices`)}
              />
            ) : (
              <>
                <div style={{ height: 240 }} className="mt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={revenueData}
                      barGap={6}
                      barCategoryGap="30%"
                      margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        vertical={false}
                        stroke="var(--surface-3)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="month"
                        tick={{
                          fill: "var(--muted)",
                          fontSize: 11,
                          fontFamily: "var(--font-heading)",
                        }}
                        axisLine={false}
                        tickLine={false}
                        dy={6}
                      />
                      <YAxis
                        tick={{
                          fill: "var(--muted)",
                          fontSize: 10,
                          fontFamily: "var(--font-heading)",
                        }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) =>
                          v === 0 ? "" : `£${(v / 1000).toFixed(0)}k`
                        }
                        width={40}
                      />
                      <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
                      />
                      <Bar
                        dataKey="invoiced"
                        name="Invoiced"
                        fill="var(--border-2)"
                        maxBarSize={44}
                      />
                      <Bar
                        dataKey="collected"
                        name="Collected"
                        fill="var(--accent)"
                        maxBarSize={44}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div
                  className="flex items-center gap-6 mt-5 pt-4"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <div
                    className="flex items-center gap-2 text-xs"
                    style={{ color: "var(--muted)" }}
                  >
                    <span
                      className="w-3 h-3 inline-block"
                      style={{ backgroundColor: "var(--border-2)" }}
                    />{" "}
                    Invoiced
                  </div>
                  <div
                    className="flex items-center gap-2 text-xs"
                    style={{ color: "var(--muted)" }}
                  >
                    <span
                      className="w-3 h-3 inline-block"
                      style={{ backgroundColor: "var(--accent)" }}
                    />{" "}
                    Collected
                  </div>
                </div>
              </>
            )}
          </Panel>

          <Panel title="Aged debtors">
            {outstandingInvoices.length === 0 ? (
              <ChartEmptyState
                icon={Clock}
                title="No data yet"
                description="Outstanding invoices will appear here once you send your first one."
                ctaLabel="Raise your first invoice"
                onCta={() => (window.location.href = `${BASE}/invoices`)}
              />
            ) : (
              <>
                <div style={{ height: 190 }} className="mt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={agedBands}
                      layout="vertical"
                      margin={{ top: 4, right: 24, left: 4, bottom: 0 }}
                      barCategoryGap="28%"
                    >
                      <CartesianGrid
                        horizontal={false}
                        stroke="var(--surface-3)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        type="number"
                        tick={{
                          fill: "var(--muted)",
                          fontSize: 10,
                          fontFamily: "var(--font-heading)",
                        }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) =>
                          v === 0 ? "" : `£${(v / 1000).toFixed(0)}k`
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        tick={{
                          fill: "var(--ink-2)",
                          fontSize: 12,
                          fontFamily: "var(--font-heading)",
                          fontWeight: 600,
                        }}
                        axisLine={false}
                        tickLine={false}
                        width={56}
                      />
                      <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
                      />
                      <Bar dataKey="value" name="Outstanding" maxBarSize={26}>
                        {agedBands.map((band) => (
                          <Cell key={band.key} fill={band.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {riskCalloutText && (
                  <div
                    className="flex items-start gap-2 mt-4 pt-4 text-xs"
                    style={{
                      borderTop: "1px solid var(--border)",
                      color:
                        largestRiskBand.key === "90+"
                          ? "var(--danger-ink)"
                          : largestRiskBand.key === "61-90"
                            ? "var(--warning-ink)"
                            : "var(--muted)",
                    }}
                  >
                    <AlertTriangle
                      className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                      strokeWidth={1.5}
                    />
                    <span>{riskCalloutText}</span>
                  </div>
                )}
              </>
            )}
          </Panel>

          <Panel
            title="Active Jobs"
            actions={
              <Link href="/jobs">
                <Btn variant="ghost" size="sm">
                  All jobs <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
                </Btn>
              </Link>
            }
            noPad
          >
            {activeJobs.length === 0 ? (
              <p
                className="text-sm text-center py-10"
                style={{ color: "var(--muted-2)" }}
              >
                No active jobs
              </p>
            ) : (
              <div>
                {activeJobs.slice(0, 6).map((job, i) => (
                  <Link key={job.id} href="/jobs">
                    <div
                      className="flex items-center gap-5 px-5 py-4 transition-colors hover:bg-[var(--surface-2)] cursor-pointer group"
                      style={{
                        borderBottom:
                          i < Math.min(activeJobs.length, 6) - 1
                            ? "1px solid var(--border)"
                            : "none",
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1">
                          <span
                            className="text-sm font-semibold truncate"
                            style={{ color: "var(--ink)" }}
                          >
                            {job.title}
                          </span>
                          {job.client?.company_name && (
                            <span
                              className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                              style={{
                                backgroundColor: "var(--surface-3)",
                                color: "var(--ink-2)",
                              }}
                            >
                              {job.client.company_name}
                            </span>
                          )}
                        </div>
                        <div
                          className="flex items-center gap-3 text-xs"
                          style={{ color: "var(--muted)" }}
                        >
                          <span className="font-mono">{job.job_number}</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" strokeWidth={1.5} />{" "}
                            {job.site_address
                              ? job.site_address.split(",")[0]
                              : "Site active"}
                          </span>
                        </div>
                      </div>
                      <div className="w-32 hidden sm:block flex-shrink-0">
                        <div className="flex justify-between items-center mb-1.5">
                          <span
                            className="text-[11px] font-medium"
                            style={{ color: "var(--muted)" }}
                          >
                            Progress
                          </span>
                          <span
                            className="text-xs font-bold font-mono"
                            style={{ color: "var(--success)" }}
                          >
                            {job.progress_percent}%
                          </span>
                        </div>
                        <div
                          className="h-1.5 overflow-hidden"
                          style={{ backgroundColor: "var(--surface-3)" }}
                        >
                          <div
                            className="h-full"
                            style={{
                              width: `${job.progress_percent}%`,
                              backgroundColor: "var(--success)",
                            }}
                          />
                        </div>
                      </div>
                      <div className="w-28 hidden md:block flex-shrink-0 text-right">
                        <div
                          className="text-[10px] font-bold uppercase tracking-widest mb-1"
                          style={{ color: "var(--muted)" }}
                        >
                          Value
                        </div>
                        <div
                          className="text-sm font-medium font-mono tnum"
                          style={{ color: "var(--ink)" }}
                        >
                          {job.value ? formatCurrency(job.value) : "—"}
                        </div>
                      </div>
                      <ChevronRight
                        className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "var(--muted)" }}
                        strokeWidth={1.5}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            title="Action Required"
            badge={hasAlerts ? alertCount : undefined}
          >
            {!hasAlerts && (
              <p
                className="text-sm text-center py-6"
                style={{ color: "var(--muted-2)" }}
              >
                All clear — no outstanding actions
              </p>
            )}

            {overdueInvoices.length > 0 && (
              <div className="mb-5">
                <h4
                  className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest mb-3"
                  style={{
                    color: "var(--muted)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  <AlertTriangle
                    className="w-3.5 h-3.5"
                    style={{ color: "var(--danger)" }}
                    strokeWidth={1.5}
                  />{" "}
                  Overdue Invoices
                </h4>
                <div className="space-y-2">
                  {overdueInvoices.slice(0, 4).map((inv) => (
                    <Link key={inv.id} href="/invoices">
                      <div
                        className="flex items-center justify-between p-3 cursor-pointer group transition-colors"
                        style={{
                          backgroundColor: "var(--surface-2)",
                          border: "1px solid rgba(178,58,38,0.18)",
                        }}
                      >
                        <div className="min-w-0">
                          <div
                            className="text-sm font-bold font-mono truncate"
                            style={{ color: "var(--danger)" }}
                          >
                            {inv.invoice_number}
                          </div>
                          <div
                            className="text-xs mt-0.5 truncate"
                            style={{ color: "var(--muted)" }}
                          >
                            {inv.client?.company_name ?? "—"}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <div
                            className="text-sm font-bold font-mono tnum"
                            style={{ color: "var(--ink)" }}
                          >
                            {formatCurrency(inv.total_amount)}
                          </div>
                          <div
                            className="text-[10px] font-medium mt-0.5 flex items-center justify-end gap-1"
                            style={{ color: "var(--danger)" }}
                          >
                            Review{" "}
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {complianceDocs.length > 0 && (
              <div>
                <h4
                  className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest mb-3"
                  style={{
                    color: "var(--muted)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  <ShieldAlert
                    className="w-3.5 h-3.5"
                    style={{ color: "var(--warning)" }}
                    strokeWidth={1.5}
                  />{" "}
                  Compliance Lapsing
                </h4>
                <div className="space-y-2">
                  {complianceDocs.slice(0, 4).map((doc) => (
                    <Link key={doc.id} href="/documents">
                      <div
                        className="flex items-start gap-3 p-3 cursor-pointer group transition-colors hover:bg-[var(--surface-2)]"
                        style={{ border: "1px solid var(--border)" }}
                      >
                        <span
                          className="mt-1.5 w-2 h-2 flex-shrink-0"
                          style={{
                            backgroundColor:
                              doc.status === "expired" ? "var(--danger)" : "var(--warning)",
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-sm font-medium leading-tight truncate transition-colors group-hover:text-[var(--accent)]"
                            style={{ color: "var(--ink)" }}
                          >
                            {doc.name}
                          </div>
                          <div
                            className="text-xs font-mono mt-1.5 flex items-center gap-1.5"
                            style={{
                              color:
                                doc.status === "expired"
                                  ? "var(--danger)"
                                  : "var(--warning)",
                            }}
                          >
                            <Clock className="w-3 h-3" strokeWidth={1.5} />
                            {doc.status === "expired"
                              ? "Expired"
                              : "Expiring"}{" "}
                            {formatDate(doc.expiry_date)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {isAdmin && (
            <Panel
              title="Recent Activity"
              actions={
                <Link href="/audit">
                  <Btn variant="ghost" size="sm">
                    Full log <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
                  </Btn>
                </Link>
              }
            >
              {activityFeed.length === 0 ? (
                <p
                  className="text-sm text-center py-6"
                  style={{ color: "var(--muted-2)" }}
                >
                  No recent activity
                </p>
              ) : (
                <div className="space-y-0 -mx-5 -mb-5">
                  {activityFeed.map((entry, i) => {
                    const icon = ACTION_ICON[entry.action] ?? (
                      <Activity
                        className="w-3.5 h-3.5"
                        style={{ color: "var(--muted)" }}
                        strokeWidth={1.5}
                      />
                    );
                    const color = ACTION_COLOR[entry.action] ?? "var(--muted)";
                    const entityLabel =
                      ENTITY_LABELS[entry.entityType] ?? entry.entityType;
                    const summary = getChangeSummary(
                      entry.action,
                      entry.changes,
                    );
                    return (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-[var(--surface-2)]"
                        style={{
                          borderTop: i > 0 ? "1px solid var(--surface-3)" : "none",
                        }}
                      >
                        <div
                          className="flex-shrink-0 w-6 h-6 flex items-center justify-center mt-0.5"
                          style={{ backgroundColor: `${color}18` }}
                        >
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: "var(--surface-2)",
                                color: "var(--ink-2)",
                              }}
                            >
                              {entityLabel}
                            </span>
                            <span
                              className="text-sm"
                              style={{ color: "var(--ink-2)" }}
                            >
                              {summary}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {entry.userName && (
                              <span
                                className="text-xs font-medium"
                                style={{ color: "var(--muted)" }}
                              >
                                {entry.userName}
                              </span>
                            )}
                            <span
                              className="text-xs font-mono"
                              style={{ color: "var(--muted-2)" }}
                            >
                              {timeAgo(entry.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
