import { useState, useEffect, useRef } from "react";
import {
  Search,
  Briefcase,
  Receipt,
  FileText,
  Users,
  HardHat,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { useApp } from "../../store/AppContext";
import { formatCurrency } from "../../lib/utils";

interface SearchResult {
  id: string;
  type: "job" | "invoice" | "quote" | "client" | "subcontractor";
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  badgeColor?: string;
}

const TYPE_ICON = {
  job: Briefcase,
  invoice: Receipt,
  quote: FileText,
  client: Users,
  subcontractor: HardHat,
};

const TYPE_LABEL = {
  job: "Job",
  invoice: "Invoice",
  quote: "Quote",
  client: "Client",
  subcontractor: "Subcontractor",
};

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const { state } = useApp();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const q = query.toLowerCase().trim();

  const results: SearchResult[] =
    q.length < 1
      ? []
      : [
          ...state.jobs
            .filter(
              (j) =>
                j.title.toLowerCase().includes(q) ||
                j.job_number.toLowerCase().includes(q) ||
                j.site_address?.toLowerCase().includes(q) ||
                j.client?.company_name.toLowerCase().includes(q),
            )
            .slice(0, 4)
            .map((j) => ({
              id: j.id,
              type: "job" as const,
              title: j.title,
              subtitle: `${j.job_number} · ${j.client?.company_name ?? "—"}`,
              href: "/jobs",
              badge: j.status.toUpperCase(),
              badgeColor:
                j.status === "active"
                  ? "#2a6e45"
                  : j.status === "complete"
                    ? "#1b5e78"
                    : "#8a8377",
            })),
          ...state.invoices
            .filter(
              (i) =>
                i.invoice_number.toLowerCase().includes(q) ||
                i.client?.company_name.toLowerCase().includes(q) ||
                i.job?.title.toLowerCase().includes(q),
            )
            .slice(0, 3)
            .map((i) => ({
              id: i.id,
              type: "invoice" as const,
              title: `${i.invoice_number} — ${i.client?.company_name ?? "—"}`,
              subtitle: `${formatCurrency(i.total_amount)} · ${i.status.toUpperCase()}`,
              href: "/invoices",
              badge: i.status.toUpperCase(),
              badgeColor:
                i.status === "paid"
                  ? "#2a6e45"
                  : i.status === "overdue"
                    ? "#c13a2a"
                    : "#8a8377",
            })),
          ...state.quotes
            .filter(
              (q2) =>
                q2.quote_number.toLowerCase().includes(q) ||
                q2.title?.toLowerCase().includes(q) ||
                q2.client?.company_name.toLowerCase().includes(q),
            )
            .slice(0, 3)
            .map((q2) => ({
              id: q2.id,
              type: "quote" as const,
              title: `${q2.quote_number} — ${q2.title ?? "—"}`,
              subtitle: `${q2.client?.company_name ?? "—"} · ${formatCurrency(q2.total_amount)}`,
              href: "/quotes",
              badge: q2.status.toUpperCase(),
              badgeColor:
                q2.status === "accepted"
                  ? "#2a6e45"
                  : q2.status === "declined"
                    ? "#c13a2a"
                    : "#8a8377",
            })),
          ...state.clients
            .filter(
              (c) =>
                c.company_name.toLowerCase().includes(q) ||
                c.contact_name?.toLowerCase().includes(q) ||
                c.email?.toLowerCase().includes(q),
            )
            .slice(0, 3)
            .map((c) => ({
              id: c.id,
              type: "client" as const,
              title: c.company_name,
              subtitle: `${c.contact_name ?? "—"} · ${c.email ?? "—"}`,
              href: "/clients",
            })),
          ...state.subcontractors
            .filter(
              (s) =>
                s.company_name.toLowerCase().includes(q) ||
                s.trade?.toLowerCase().includes(q) ||
                s.contact_name?.toLowerCase().includes(q),
            )
            .slice(0, 3)
            .map((s) => ({
              id: s.id,
              type: "subcontractor" as const,
              title: s.company_name,
              subtitle: `${s.trade ?? "—"} · ${s.contact_name ?? "—"}`,
              href: "/subcontractors",
              badge: s.cis_status.toUpperCase(),
              badgeColor:
                s.cis_status === "gross"
                  ? "#2a6e45"
                  : s.cis_status === "unverified"
                    ? "#c13a2a"
                    : "#8a8377",
            })),
        ];

  useEffect(() => {
    setSelected(0);
  }, [query]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    }
    if (e.key === "Enter" && results[selected]) {
      navigate(results[selected].href);
      onClose();
    }
    if (e.key === "Escape") onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(24,20,16,0.32)",
          backdropFilter: "blur(2px)",
        }}
      />
      <div
        className="relative w-full max-w-xl mx-4 rounded-xl overflow-hidden"
        style={{
          backgroundColor: "#fafaf8",
          border: "1px solid #d9d4ce",
          boxShadow:
            "0 24px 60px -12px rgba(24,20,16,0.22), 0 8px 20px -8px rgba(24,20,16,0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderBottom: "1px solid #d9d4ce" }}
        >
          <Search
            className="w-4 h-4 flex-shrink-0"
            style={{ color: "#7a7469" }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search jobs, invoices, clients, quotes..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{ color: "#181410", fontFamily: "'Inter', sans-serif" }}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{ color: "#8a8377" }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd
            className="hidden md:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs"
            style={{
              backgroundColor: "#eeeae4",
              color: "#7a7469",
              border: "1px solid #d9d4ce",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Esc
          </kbd>
        </div>

        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-1">
            {results.map((r, i) => {
              const Icon = TYPE_ICON[r.type];
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    navigate(r.href);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors mx-1 rounded-md"
                  style={{
                    backgroundColor: i === selected ? "#e8f3f7" : "transparent",
                    width: "calc(100% - 8px)",
                  }}
                  onMouseEnter={() => setSelected(i)}
                >
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: i === selected ? "#d4e9f0" : "#eeeae4",
                    }}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={{ color: i === selected ? "#1b5e78" : "#7a7469" }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{
                        color: "#181410",
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      {r.title}
                    </p>
                    <p
                      className="text-xs truncate mt-0.5"
                      style={{
                        color: "#7a7469",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {r.subtitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {r.badge && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          color: r.badgeColor,
                          backgroundColor: `${r.badgeColor}1f`,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {r.badge}
                      </span>
                    )}
                    <span
                      className="text-xs uppercase tracking-wider"
                      style={{
                        color: "#8a8377",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      {TYPE_LABEL[r.type]}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {q.length > 0 && results.length === 0 && (
          <div className="px-4 py-10 text-center">
            <p
              className="text-sm"
              style={{
                color: "#8a8377",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              No results for "{query}"
            </p>
          </div>
        )}

        {q.length === 0 && (
          <div className="px-3 py-3 flex gap-2">
            {(["jobs", "invoices", "clients", "quotes"] as const).map(
              (page) => (
                <button
                  key={page}
                  onClick={() => {
                    navigate(`/${page}`);
                    onClose();
                  }}
                  className="flex-1 py-2 rounded-md text-xs uppercase tracking-wider transition-colors hover:bg-[#eeeae4]"
                  style={{
                    color: "#7a7469",
                    border: "1px solid #d9d4ce",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {page}
                </button>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
