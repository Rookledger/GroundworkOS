import { useState, useEffect, useMemo } from "react";
import { Search, Clock, Filter } from "lucide-react";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { Badge } from "../components/ui/Badge";

const BASE = (import.meta as any).env?.BASE_URL?.replace(/\/$/, "") ?? "";

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: "create" | "update" | "delete";
  changes: Record<string, any> | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
}

const ACTION_CONFIG = {
  create: { label: "Created", color: "#2a6e45", bg: "rgba(42,110,69,0.1)" },
  update: { label: "Updated", color: "var(--accent)", bg: "var(--accent-bg)" },
  delete: { label: "Deleted", color: "var(--danger)", bg: "rgba(178,58,38,0.1)" },
};

const ENTITY_LABELS: Record<string, string> = {
  job: "Job",
  quote: "Quote",
  invoice: "Invoice",
  client: "Client",
  subcontractor: "Subcontractor",
  document: "Document",
  plant: "Plant",
  timesheet: "Timesheet",
  purchase_order: "Purchase Order",
};

function initials(name: string | null, email: string | null): string {
  if (name)
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  if (email) return email[0].toUpperCase();
  return "SY";
}

function formatChanges(changes: Record<string, any> | null): string {
  if (!changes) return "";
  const keys = Object.keys(changes).slice(0, 3);
  return (
    keys.map((k) => k.replace(/_/g, " ")).join(", ") +
    (Object.keys(changes).length > 3
      ? ` +${Object.keys(changes).length - 3} more`
      : "")
  );
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year:
      d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [days, setDays] = useState("30");
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ days, limit: "500" });
    if (entityFilter !== "all") params.set("entityType", entityFilter);
    fetch(`${BASE}/api/audit-logs?${params}`)
      .then(async (r) => {
        // The audit trail is admin-only; a non-admin (e.g. a manager who
        // reaches this route by URL) gets 403. Show a clear access message
        // instead of a misleading empty table.
        if (r.status === 403) {
          setForbidden(true);
          return null;
        }
        setForbidden(false);
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setLogs(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days, entityFilter]);

  const filtered = logs.filter((l) => {
    if (actionFilter !== "all" && l.action !== actionFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (l.userName ?? "").toLowerCase().includes(q) ||
        (l.userEmail ?? "").toLowerCase().includes(q) ||
        l.entityType.toLowerCase().includes(q) ||
        l.entityId.toLowerCase().includes(q) ||
        l.action.includes(q)
      );
    }
    return true;
  });

  const grouped = useMemo(() => {
    const map = new Map<string, AuditLog[]>();
    for (const l of filtered) {
      const key = new Date(l.createdAt).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return [...map.entries()];
  }, [filtered]);

  const totalToday = logs.filter(
    (l) => new Date(l.createdAt).toDateString() === new Date().toDateString(),
  ).length;
  const totalUpdates = logs.filter((l) => l.action === "update").length;
  const totalDeletes = logs.filter((l) => l.action === "delete").length;
  const uniqueUsers = new Set(logs.map((l) => l.userId).filter(Boolean)).size;

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <p
          style={{
            color: "var(--muted)",
            fontSize: 14,
            fontFamily: "var(--font-body)",
          }}
        >
          Admin access required
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1
          className="text-xl font-semibold"
          style={{
            color: "var(--ink)",
            fontFamily: "var(--font-heading)",
          }}
        >
          Audit Trail
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          Full history of who changed what and when
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today" value={totalToday} sub="changes" />
        <StatCard
          label="Updates"
          value={totalUpdates}
          sub={`last ${days} days`}
        />
        <StatCard
          danger={totalDeletes > 0}
          label="Deletions"
          value={totalDeletes}
          sub={`last ${days} days`}
        />
        <StatCard
          label="Active users"
          value={uniqueUsers}
          sub="making changes"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div
          className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm px-3 py-2 "
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <Search strokeWidth={1.5}
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: "var(--muted-2)" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user, entity…"
            className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-[var(--muted-2)]"
            style={{ color: "var(--ink)" }}
          />
        </div>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="py-2 px-3 text-sm focus:outline-none"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--ink-2)",
          }}
        >
          <option value="all">All entities</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="py-2 px-3 text-sm focus:outline-none"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--ink-2)",
          }}
        >
          <option value="all">All actions</option>
          <option value="create">Created</option>
          <option value="update">Updated</option>
          <option value="delete">Deleted</option>
        </select>
        <select
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="py-2 px-3 text-sm focus:outline-none"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--ink-2)",
          }}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
      </div>

      <div className="flex gap-6 items-start">
        <Panel noPad className="flex-1 min-w-0">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <Clock strokeWidth={1.5}
                className="w-6 h-6 animate-pulse"
                style={{ color: "var(--border)" }}
              />
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Loading audit log…
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <Filter strokeWidth={1.5} className="w-6 h-6" style={{ color: "var(--border)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                No entries found
              </p>
              <p className="text-xs" style={{ color: "var(--muted-2)" }}>
                Audit entries are recorded as you use the system
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border)",
                      backgroundColor: "var(--surface)",
                    }}
                  >
                    {["When", "User", "Action", "Entity", "Changes"].map(
                      (h) => (
                        <th
                          key={h}
                          className="py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: "var(--muted)" }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log, i) => {
                    const cfg =
                      ACTION_CONFIG[log.action] ?? ACTION_CONFIG.update;
                    const isSelected = selected?.id === log.id;
                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelected(isSelected ? null : log)}
                        className="cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
                        style={{
                          borderBottom:
                            i < filtered.length - 1
                              ? "1px solid var(--surface-3)"
                              : "none",
                          backgroundColor: isSelected ? "var(--surface-2)" : undefined,
                        }}
                      >
                        <td className="py-3 px-4">
                          <div
                            className="text-xs font-mono"
                            style={{ color: "var(--ink)" }}
                          >
                            {new Date(log.createdAt).toLocaleDateString(
                              "en-GB",
                              { day: "numeric", month: "short" },
                            )}
                          </div>
                          <div
                            className="text-[10px] font-mono"
                            style={{ color: "var(--muted-2)" }}
                          >
                            {new Date(log.createdAt).toLocaleTimeString(
                              "en-GB",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                              style={{
                                backgroundColor: "var(--accent)",
                                color: "#ffffff",
                              }}
                            >
                              {initials(log.userName, log.userEmail)}
                            </div>
                            <div>
                              <div
                                className="text-xs font-medium"
                                style={{ color: "var(--ink)" }}
                              >
                                {log.userName ?? "System"}
                              </div>
                              {log.userEmail && (
                                <div
                                  className="text-[10px] font-mono"
                                  style={{ color: "var(--muted-2)" }}
                                >
                                  {log.userEmail}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 "
                            style={{
                              backgroundColor: cfg.bg,
                              color: cfg.color,
                            }}
                          >
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div
                            className="text-sm font-medium"
                            style={{ color: "var(--ink)" }}
                          >
                            {ENTITY_LABELS[log.entityType] ?? log.entityType}
                          </div>
                          <div
                            className="text-[10px] font-mono"
                            style={{ color: "var(--muted-2)" }}
                          >
                            {log.entityId.slice(0, 8)}…
                          </div>
                        </td>
                        <td
                          className="py-3 px-4 text-xs max-w-[200px] truncate"
                          style={{ color: "var(--muted)" }}
                        >
                          {formatChanges(log.changes)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {selected && (
          <div className="w-72 flex-shrink-0">
            <Panel title="Event detail">
              <div className="space-y-3 text-sm">
                <div>
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "var(--muted)" }}
                  >
                    When
                  </div>
                  <div style={{ color: "var(--ink)" }}>
                    {new Date(selected.createdAt).toLocaleString("en-GB", {
                      dateStyle: "long",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
                <div>
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "var(--muted)" }}
                  >
                    By
                  </div>
                  <div style={{ color: "var(--ink)" }}>
                    {selected.userName ?? "System"}
                  </div>
                  {selected.userEmail && (
                    <div
                      className="text-xs font-mono"
                      style={{ color: "var(--muted)" }}
                    >
                      {selected.userEmail}
                    </div>
                  )}
                </div>
                <div>
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "var(--muted)" }}
                  >
                    Action
                  </div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 "
                    style={{
                      backgroundColor: ACTION_CONFIG[selected.action].bg,
                      color: ACTION_CONFIG[selected.action].color,
                    }}
                  >
                    {ACTION_CONFIG[selected.action].label}
                  </span>
                </div>
                <div>
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "var(--muted)" }}
                  >
                    Entity
                  </div>
                  <div style={{ color: "var(--ink)" }}>
                    {ENTITY_LABELS[selected.entityType] ?? selected.entityType}
                  </div>
                  <div
                    className="text-xs font-mono mt-0.5"
                    style={{ color: "var(--muted-2)" }}
                  >
                    {selected.entityId}
                  </div>
                </div>
                {selected.changes &&
                  Object.keys(selected.changes).length > 0 && (
                    <div>
                      <div
                        className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                        style={{ color: "var(--muted)" }}
                      >
                        Changed fields
                      </div>
                      <div className="space-y-1.5">
                        {Object.entries(selected.changes).map(([k, v]) => (
                          <div
                            key={k}
                            className="p-2 text-xs"
                            style={{ backgroundColor: "var(--bg)" }}
                          >
                            <div
                              className="font-mono font-bold mb-0.5"
                              style={{ color: "var(--muted)" }}
                            >
                              {k.replace(/_/g, " ")}
                            </div>
                            <div
                              className="font-mono truncate"
                              style={{ color: "var(--ink)" }}
                            >
                              {typeof v === "object"
                                ? JSON.stringify(v)
                                : String(v ?? "—")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
