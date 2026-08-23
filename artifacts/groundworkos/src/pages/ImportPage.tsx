import { useState, useRef } from "react";
import {
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  X,
  FileText,
  Users,
  Briefcase,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import { Btn } from "../components/ui/Btn";
import { Panel } from "../components/ui/Panel";
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
  "payment_terms",
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

const CLIENT_SAMPLE = `company_name,contact_name,email,phone,address,payment_terms,notes
Apex Civil Engineering,John Smith,john@apexcivil.co.uk,0121 000 0001,"Unit 1 Business Park, Birmingham, B1 1AA",30 days,Key account
Highway Contractors Ltd,Sarah Jones,sarah@highwayco.co.uk,0121 000 0002,"12 Trade Street, Coventry, CV1 2BB",14 days,`;

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
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setRows([]);
    setHeaders([]);
    setDone(false);
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
            paymentTerms: d.payment_terms || "30 days",
            notes: d.notes || "",
          };
          if (!payload.companyName) throw new Error("company_name required");
        } else {
          payload = {
            title: d.title || "",
            type: d.type || "groundworks",
            status: d.status || "quoted",
            value: d.value ? Number(d.value) : null,
            startDate: d.start_date || null,
            endDate: d.end_date || null,
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
  const sampleCSV = tab === "clients" ? CLIENT_SAMPLE : JOB_SAMPLE;
  const sampleFile =
    tab === "clients"
      ? "groundworkos-clients-template.csv"
      : "groundworkos-jobs-template.csv";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-semibold"
            style={{
              color: "#181410",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Bulk Import
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#7a7469" }}>
            Import clients and jobs from a CSV file
          </p>
        </div>
      </div>

      <div
        className="flex items-center gap-1"
        style={{ borderBottom: "1px solid #d9d4ce" }}
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
                    color: "#181410",
                    fontWeight: 500,
                    borderBottom: "2px solid #1b5e78",
                    marginBottom: "-1px",
                  }
                : { color: "#7a7469" }
            }
          >
            <t.icon className="w-3.5 h-3.5" />
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
              className="cursor-pointer rounded-xl flex flex-col items-center justify-center gap-4 py-16 transition-all"
              style={{
                border: `2px dashed ${dragging ? "#1b5e78" : "#d9d4ce"}`,
                backgroundColor: dragging ? "#e8f3f7" : "#fafaf8",
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
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "#eeeae4" }}
              >
                <Upload className="w-6 h-6" style={{ color: "#7a7469" }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: "#181410" }}>
                  Drop your CSV here or click to browse
                </p>
                <p className="text-xs mt-1" style={{ color: "#7a7469" }}>
                  Must match the expected column format below
                </p>
              </div>
            </div>
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
                        <span style={{ color: "#c13a2a" }}>✗ {errors}</span>
                      )}
                    </div>
                  )}
                  <button
                    onClick={reset}
                    className="p-1 rounded hover:bg-[#eeeae4]"
                  >
                    <X className="w-4 h-4" style={{ color: "#7a7469" }} />
                  </button>
                </div>
              }
            >
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid #d9d4ce",
                        backgroundColor: "#fafaf8",
                        position: "sticky",
                        top: 0,
                      }}
                    >
                      <th
                        className="py-2 px-3 font-bold uppercase tracking-widest"
                        style={{ color: "#7a7469", width: 32 }}
                      >
                        #
                      </th>
                      {headers.map((h) => (
                        <th
                          key={h}
                          className="py-2 px-3 font-bold uppercase tracking-widest"
                          style={{ color: "#7a7469" }}
                        >
                          {h}
                        </th>
                      ))}
                      <th
                        className="py-2 px-3 font-bold uppercase tracking-widest"
                        style={{ color: "#7a7469" }}
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
                          borderBottom: "1px solid #e8e4dd",
                          backgroundColor:
                            row.status === "success"
                              ? "rgba(42,110,69,0.04)"
                              : row.status === "error"
                                ? "rgba(193,58,42,0.04)"
                                : undefined,
                        }}
                      >
                        <td
                          className="py-2 px-3 font-mono"
                          style={{ color: "#a8a099" }}
                        >
                          {i + 1}
                        </td>
                        {headers.map((h) => (
                          <td
                            key={h}
                            className="py-2 px-3 max-w-[160px] truncate"
                            style={{ color: "#4a4540" }}
                            title={row.data[h]}
                          >
                            {row.data[h] || (
                              <span style={{ color: "#d9d4ce" }}>—</span>
                            )}
                          </td>
                        ))}
                        <td className="py-2 px-3">
                          {row.status === "pending" && (
                            <span style={{ color: "#a8a099" }}>Pending</span>
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
                              style={{ color: "#c13a2a" }}
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
                <div className="p-4" style={{ borderTop: "1px solid #e8e4dd" }}>
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
                <div className="p-4" style={{ borderTop: "1px solid #e8e4dd" }}>
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
            <p className="text-sm mb-3" style={{ color: "#7a7469" }}>
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
                    style={{ color: "#a8a099" }}
                  />
                  <code
                    className="text-xs font-mono"
                    style={{ color: "#4a4540" }}
                  >
                    {f}
                  </code>
                </div>
              ))}
            </div>
            <p className="text-[11px] mt-3" style={{ color: "#a8a099" }}>
              Column order doesn't matter — headers are matched by name.
            </p>
          </Panel>

          <Panel title="Tips">
            <ul className="space-y-2 text-sm" style={{ color: "#7a7469" }}>
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
