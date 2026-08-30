import { useState, useRef } from "react";
import {
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Check,
  ArrowRight,
  X,
  FileText,
  Users,
  Briefcase,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import { Btn } from "../components/ui/Btn";
import { Panel } from "../components/ui/Panel";
import { Badge } from "../components/ui/Badge";
import { toast } from "sonner";
import { toClient, toJob } from "../lib/apiTransforms";

const BASE = (import.meta as any).env?.BASE_URL?.replace(/\/$/, "") ?? "";

type ImportTab = "clients" | "jobs";

const CLIENT_FIELDS = [
  "company_name",
  "contact_name",
  "email",
  "phone",
  "address",
  "notes",
];
const JOB_FIELDS = [
  "title",
  "type",
  "status",
  "value",
  "start_date",
  "end_date",
  "site_address",
  "description",
];

const CLIENT_ALIASES: Record<string, string[]> = {
  company_name: ["company_name", "company"],
  contact_name: ["contact_name", "contact"],
  email: ["email"],
  phone: ["phone"],
  address: ["address"],
  notes: ["notes"],
};
const JOB_ALIASES: Record<string, string[]> = {
  title: ["title"],
  type: ["type"],
  status: ["status"],
  value: ["value"],
  start_date: ["start_date"],
  end_date: ["end_date"],
  site_address: ["site_address", "address"],
  description: ["description"],
};
const CLIENT_REQUIRED = "company_name";
const JOB_REQUIRED = "title";

const STEPS = ["Upload", "Map columns", "Review", "Import"];

function StepStrip({ current }: { current: number }) {
  return (
    <div className="flex items-center flex-wrap gap-y-2">
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 20,
                  height: 20,
                  fontFamily: "var(--font-heading)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: state === "todo" ? "var(--muted-2)" : "#ffffff",
                  backgroundColor:
                    state === "done"
                      ? "var(--ink-navy)"
                      : state === "current"
                        ? "var(--accent)"
                        : "var(--surface-2)",
                  border: state === "todo" ? "1px solid var(--border-2)" : "none",
                }}
              >
                {state === "done" ? (
                  <Check className="w-3 h-3" strokeWidth={2} />
                ) : (
                  i + 1
                )}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: 12,
                  fontWeight: state === "current" ? 600 : 500,
                  color:
                    state === "current"
                      ? "var(--ink)"
                      : state === "done"
                        ? "var(--ink-navy)"
                        : "var(--muted-2)",
                }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="flex-shrink-0"
                style={{
                  width: 28,
                  height: 1,
                  margin: "0 10px",
                  backgroundColor:
                    i < current ? "var(--ink-navy)" : "var(--border)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const CLIENT_SAMPLE = `company_name,contact_name,email,phone,address,notes
Apex Civil Engineering,John Smith,john@apexcivil.co.uk,0121 000 0001,"Unit 1 Business Park, Birmingham, B1 1AA",Key account
Highway Contractors Ltd,Sarah Jones,sarah@highwayco.co.uk,0121 000 0002,"12 Trade Street, Coventry, CV1 2BB",`;

const JOB_SAMPLE = `title,type,status,value,start_date,end_date,site_address,description
A45 Junction Drainage,drainage,active,45000,2025-02-01,2025-04-30,"A45 Eastbound, Birmingham",Storm drainage installation
Car Park Groundworks,groundworks,quoted,28000,2025-03-15,,"Business Park, Solihull",Full car park groundworks inc sub-base`;

function parseCSV(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const lines = text
    .trim()
    .split("\n")
    .filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const vals = parseCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (vals[i] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function downloadCSV(content: string, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
  a.download = filename;
  a.click();
}

interface PreviewRow {
  data: Record<string, string>;
  status: "pending" | "success" | "error";
  error?: string;
}

export function ImportPage() {
  const { dispatch } = useApp();
  const [tab, setTab] = useState<ImportTab>("clients");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setRows([]);
    setHeaders([]);
    setDone(false);
    setReviewed(false);
  }

  function loadText(text: string) {
    const parsed = parseCSV(text);
    if (!parsed.rows.length) {
      toast.error("No data rows found in the CSV");
      return;
    }
    setHeaders(parsed.headers);
    setRows(parsed.rows.map((r) => ({ data: r, status: "pending" })));
    setDone(false);
    setReviewed(false);
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Please upload a CSV file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => loadText(e.target?.result as string);
    reader.readAsText(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function runImport() {
    if (!rows.length) return;
    setImporting(true);
    const endpoint = tab === "clients" ? "/api/clients" : "/api/jobs";
    let successCount = 0;

    const updated = [...rows];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status === "success") continue;
      try {
        const d = updated[i].data;
        let payload: Record<string, any> = {};
        if (tab === "clients") {
          payload = {
            companyName: d.company_name || d.company || "",
            contactName: d.contact_name || d.contact || "",
            email: d.email || "",
            phone: d.phone || "",
            address: d.address || "",
            notes: d.notes || "",
          };
          if (!payload.companyName) throw new Error("company_name required");
        } else {
          payload = {
            title: d.title || "",
            type: d.type || "groundworks",
            status: d.status || "quoted",
            value: d.value ? Number(d.value) : undefined,
            startDate: d.start_date || undefined,
            endDate: d.end_date || undefined,
            siteAddress: d.site_address || d.address || "",
            description: d.description || "",
          };
          if (!payload.title) throw new Error("title required");
        }

        const res = await fetch(`${BASE}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const created = await res.json();
        if (tab === "clients")
          dispatch({ type: "ADD_CLIENT", client: toClient(created) });
        else dispatch({ type: "ADD_JOB", job: toJob(created) });
        updated[i] = { ...updated[i], status: "success" };
        successCount++;
      } catch (err: any) {
        updated[i] = { ...updated[i], status: "error", error: err.message };
      }
      setRows([...updated]);
    }

    setImporting(false);
    setDone(true);
    toast.success(`${successCount} of ${updated.length} records imported`);
  }

  const pending = rows.filter((r) => r.status === "pending").length;
  const success = rows.filter((r) => r.status === "success").length;
  const errors = rows.filter((r) => r.status === "error").length;

  const expectedFields = tab === "clients" ? CLIENT_FIELDS : JOB_FIELDS;
  const aliases = tab === "clients" ? CLIENT_ALIASES : JOB_ALIASES;
  const requiredField = tab === "clients" ? CLIENT_REQUIRED : JOB_REQUIRED;
  const sampleCSV = tab === "clients" ? CLIENT_SAMPLE : JOB_SAMPLE;
  const sampleFile =
    tab === "clients"
      ? "groundworkos-clients-template.csv"
      : "groundworkos-jobs-template.csv";

  function matchField(header: string): string | null {
    const h = header.trim().toLowerCase();
    for (const field of expectedFields) {
      if ((aliases[field] ?? [field]).includes(h)) return field;
    }
    return null;
  }

  const mappedHeaders = headers.map((h) => ({ header: h, dest: matchField(h) }));
  const requiredMapped = mappedHeaders.some((m) => m.dest === requiredField);

  const currentStep = !rows.length
    ? 0
    : !reviewed
      ? 1
      : importing || done
        ? 3
        : 2;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1
            className="text-xl font-semibold"
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-heading)",
            }}
          >
            Bulk Import
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            Import clients and jobs from a CSV file
          </p>
        </div>
        <StepStrip current={currentStep} />
      </div>

      <div
        className="flex items-center gap-1"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {[
          { id: "clients" as const, label: "Clients", icon: Users },
          { id: "jobs" as const, label: "Jobs", icon: Briefcase },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              reset();
            }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors"
            style={
              tab === t.id
                ? {
                    color: "var(--ink)",
                    fontWeight: 500,
                    borderBottom: "2px solid var(--accent)",
                    marginBottom: "-1px",
                  }
                : { color: "var(--muted)" }
            }
          >
            <t.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {!rows.length ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className="cursor-pointer flex flex-col items-center justify-center gap-4 py-16 transition-all"
              style={{
                border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
                backgroundColor: dragging ? "var(--accent-bg)" : "var(--surface)",
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0]);
                }}
              />
              <div
                className="w-12 h-12 flex items-center justify-center"
                style={{ backgroundColor: "var(--surface-2)" }}
              >
                <Upload className="w-6 h-6" style={{ color: "var(--muted)" }} strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                  Drop your CSV here or click to browse
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  Must match the expected column format below
                </p>
              </div>
            </div>
          ) : !reviewed ? (
            <Panel
              noPad
              title="Map columns"
              actions={
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {headers.length} column{headers.length !== 1 ? "s" : ""} detected
                </span>
              }
            >
              {!requiredMapped && (
                <div
                  className="flex items-start gap-2.5 px-4 py-3"
                  style={{
                    backgroundColor: "var(--warning-bg)",
                    color: "var(--warning-ink)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <AlertTriangle
                    className="w-4 h-4 flex-shrink-0 mt-0.5"
                    strokeWidth={1.5}
                  />
                  <span className="text-xs leading-relaxed">
                    No column matches the required field{" "}
                    <code className="font-mono">{requiredField}</code> — rows
                    will fail to import without it.
                  </span>
                </div>
              )}
              <div>
                {mappedHeaders.map(({ header, dest }, i) => (
                  <div
                    key={header + i}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-2.5"
                    style={{
                      borderBottom:
                        i < mappedHeaders.length - 1
                          ? "1px solid var(--surface-3)"
                          : "none",
                    }}
                  >
                    <span
                      className="text-sm font-mono truncate sm:w-1/3"
                      style={{ color: "var(--ink)" }}
                    >
                      {header}
                    </span>
                    <ArrowRight
                      className="w-3.5 h-3.5 flex-shrink-0 hidden sm:block"
                      style={{ color: "var(--muted-2)" }}
                      strokeWidth={1.5}
                    />
                    {dest ? (
                      <span
                        className="text-sm font-mono"
                        style={{ color: "var(--accent)" }}
                      >
                        {dest}
                      </span>
                    ) : (
                      <Badge status="skipped" />
                    )}
                  </div>
                ))}
              </div>
              <div
                className="flex items-center justify-between gap-3 p-4"
                style={{ borderTop: "1px solid var(--surface-3)" }}
              >
                <Btn variant="outline" onClick={reset}>
                  Back
                </Btn>
                <Btn onClick={() => setReviewed(true)}>
                  Preview {rows.length} row{rows.length !== 1 ? "s" : ""}
                </Btn>
              </div>
            </Panel>
          ) : (
            <Panel
              noPad
              title={`Preview — ${rows.length} row${rows.length !== 1 ? "s" : ""}`}
              actions={
                <div className="flex items-center gap-2">
                  {done && (
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span style={{ color: "#2a6e45" }}>✓ {success}</span>
                      {errors > 0 && (
                        <span style={{ color: "var(--danger)" }}>✗ {errors}</span>
                      )}
                    </div>
                  )}
                  <button
                    onClick={reset}
                    className="p-1 rounded hover:bg-[var(--surface-2)]"
                  >
                    <X className="w-4 h-4" style={{ color: "var(--muted)" }} />
                  </button>
                </div>
              }
            >
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--border)",
                        backgroundColor: "var(--surface)",
                        position: "sticky",
                        top: 0,
                      }}
                    >
                      <th
                        className="py-2 px-3 font-bold uppercase tracking-widest"
                        style={{ color: "var(--muted)", width: 32 }}
                      >
                        #
                      </th>
                      {headers.map((h) => (
                        <th
                          key={h}
                          className="py-2 px-3 font-bold uppercase tracking-widest"
                          style={{ color: "var(--muted)" }}
                        >
                          {h}
                        </th>
                      ))}
                      <th
                        className="py-2 px-3 font-bold uppercase tracking-widest"
                        style={{ color: "var(--muted)" }}
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        className="transition-colors"
                        style={{
                          borderBottom: "1px solid var(--surface-3)",
                          backgroundColor:
                            row.status === "success"
                              ? "rgba(42,110,69,0.04)"
                              : row.status === "error"
                                ? "rgba(178,58,38,0.04)"
                                : undefined,
                        }}
                      >
                        <td
                          className="py-2 px-3 font-mono"
                          style={{ color: "var(--muted-2)" }}
                        >
                          {i + 1}
                        </td>
                        {headers.map((h) => (
                          <td
                            key={h}
                            className="py-2 px-3 max-w-[160px] truncate"
                            style={{ color: "var(--ink-2)" }}
                            title={row.data[h]}
                          >
                            {row.data[h] || (
                              <span style={{ color: "var(--border)" }}>—</span>
                            )}
                          </td>
                        ))}
                        <td className="py-2 px-3">
                          {row.status === "pending" && (
                            <span style={{ color: "var(--muted-2)" }}>Pending</span>
                          )}
                          {row.status === "success" && (
                            <span
                              className="flex items-center gap-1"
                              style={{ color: "#2a6e45" }}
                            >
                              <CheckCircle className="w-3 h-3" /> Imported
                            </span>
                          )}
                          {row.status === "error" && (
                            <span
                              className="flex items-center gap-1"
                              style={{ color: "var(--danger)" }}
                              title={row.error}
                            >
                              <AlertCircle className="w-3 h-3" />{" "}
                              {row.error?.slice(0, 24)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!done && pending > 0 && (
                <div className="p-4" style={{ borderTop: "1px solid var(--surface-3)" }}>
                  <Btn
                    className="w-full justify-center"
                    onClick={runImport}
                    disabled={importing}
                  >
                    {importing
                      ? `Importing… (${success}/${rows.length})`
                      : `Import ${pending} record${pending !== 1 ? "s" : ""}`}
                  </Btn>
                </div>
              )}
              {done && errors > 0 && (
                <div className="p-4" style={{ borderTop: "1px solid var(--surface-3)" }}>
                  <Btn
                    className="w-full justify-center"
                    onClick={runImport}
                    disabled={importing}
                  >
                    Retry {errors} failed record{errors !== 1 ? "s" : ""}
                  </Btn>
                </div>
              )}
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel title="Download template">
            <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
              Start from our sample CSV to make sure your columns match the
              expected format.
            </p>
            <Btn
              variant="outline"
              size="sm"
              className="w-full justify-center"
              onClick={() => downloadCSV(sampleCSV, sampleFile)}
            >
              <Download className="w-3.5 h-3.5" /> Download sample CSV
            </Btn>
          </Panel>

          <Panel title="Expected columns">
            <div className="space-y-1.5">
              {expectedFields.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <FileText
                    className="w-3 h-3 flex-shrink-0"
                    style={{ color: "var(--muted-2)" }}
                  />
                  <code
                    className="text-xs font-mono"
                    style={{ color: "var(--ink-2)" }}
                  >
                    {f}
                  </code>
                </div>
              ))}
            </div>
            <p className="text-[11px] mt-3" style={{ color: "var(--muted-2)" }}>
              Column order doesn't matter — headers are matched by name.
            </p>
          </Panel>

          <Panel title="Tips">
            <ul className="space-y-2 text-sm" style={{ color: "var(--muted)" }}>
              <li>• First row must be column headers</li>
              <li>• Wrap values containing commas in double quotes</li>
              <li>• Dates must be in YYYY-MM-DD format</li>
              <li>
                • <code className="font-mono text-xs">value</code> must be a
                number (no £ sign)
              </li>
              <li>
                • Blank fields are left empty — safe to import partial data
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
