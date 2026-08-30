import { useState, useRef } from "react";
import {
  Plus,
  Search,
  AlertTriangle,
  FolderOpen,
  FileText,
  X,
  ChevronRight,
  Trash2,
  Paperclip,
  Download,
  Upload,
  Pencil,
} from "lucide-react";
import { useLocation } from "wouter";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { Badge } from "../components/ui/Badge";
import { Btn } from "../components/ui/Btn";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal, Field, Input, Select, Textarea } from "../components/ui/Modal";
import { formatDate, daysUntil } from "../lib/utils";
import { useApp } from "../store/AppContext";
import {
  createDocument,
  updateDocument,
  deleteDocument,
} from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { toDocument } from "../lib/apiTransforms";
import { toast } from "sonner";
import type {
  DocumentType,
  DocumentRelatedTo,
  Document as Doc,
} from "../types";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const TYPE_LABELS: Record<DocumentType, string> = {
  rams: "RAMS",
  insurance: "Insurance",
  certification: "Certification",
  permit: "Permit",
  compliance: "Compliance",
  contract: "Contract",
  other: "Other",
};

const TYPE_COLORS: Record<DocumentType, string> = {
  rams: "#a78bfa",
  insurance: "#2a6e45",
  certification: "var(--accent)",
  permit: "#a78bfa",
  compliance: "#fb923c",
  contract: "var(--ink)",
  other: "var(--muted)",
};

const emptyForm = {
  name: "",
  type: "rams" as DocumentType,
  related_to: "company" as DocumentRelatedTo,
  related_name: "",
  issued_date: new Date().toISOString().split("T")[0],
  expiry_date: "",
  notes: "",
};

export function DocumentsPage() {
  const { state, dispatch } = useApp();
  const { documents } = state;
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "valid" | "expiring_soon" | "expired"
  >("all");
  const [filterType, setFilterType] = useState<DocumentType | "all">("all");
  const [filterRelatedTo, setFilterRelatedTo] = useState<
    DocumentRelatedTo | "all"
  >("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading, progress } = useUpload({
    basePath: `${BASE}/api/storage`,
  });

  const filtered = documents.filter((d) => {
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    if (filterType !== "all" && d.type !== filterType) return false;
    if (filterRelatedTo !== "all" && d.related_to !== filterRelatedTo)
      return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        (d.related_name ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const expired = documents.filter((d) => d.status === "expired");
  const expiring = documents.filter((d) => d.status === "expiring_soon");
  const valid = documents.filter((d) => d.status === "valid");
  const selectedDoc = selected
    ? documents.find((d) => d.id === selected)
    : null;

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setSelectedFile(null);
    setShowModal(true);
  }

  function openEdit(doc: Doc) {
    setEditingId(doc.id);
    setForm({
      name: doc.name,
      type: doc.type,
      related_to: doc.related_to,
      related_name: doc.related_name ?? "",
      issued_date: doc.issued_date ?? "",
      expiry_date: doc.expiry_date ?? "",
      notes: doc.notes ?? "",
    });
    setErrors({});
    setSelectedFile(null);
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Document name is required";
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const result = await updateDocument(editingId, {
          name: form.name.trim(),
          type: form.type,
          relatedTo: form.related_to,
          relatedName: form.related_name || undefined,
          issuedDate: form.issued_date || undefined,
          expiryDate: form.expiry_date || undefined,
          notes: form.notes || undefined,
        });
        dispatch({
          type: "UPDATE_DOCUMENT",
          id: editingId,
          updates: toDocument(result),
        });
        setShowModal(false);
        toast.success("Document updated");
      } else {
        let filePath: string | undefined;
        if (selectedFile) {
          const uploadResult = await uploadFile(selectedFile);
          if (!uploadResult) {
            toast.error("File upload failed");
            setSaving(false);
            return;
          }
          filePath = uploadResult.objectPath;
        }
        const result = await createDocument({
          name: form.name.trim(),
          type: form.type,
          relatedTo: form.related_to,
          relatedName: form.related_name || undefined,
          issuedDate: form.issued_date || undefined,
          expiryDate: form.expiry_date || undefined,
          notes: form.notes || undefined,
          ...(filePath ? { filePath } : {}),
        } as any);
        dispatch({ type: "ADD_DOCUMENT", doc: toDocument(result) });
        setShowModal(false);
        setSelectedFile(null);
        toast.success(`${result.name} added`);
      }
    } catch {
      toast.error(
        editingId ? "Failed to update document" : "Failed to add document",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteDocument(id);
      dispatch({ type: "REMOVE_DOCUMENT", id });
      setSelected(null);
      toast.success(`${name} deleted`);
    } catch {
      toast.error("Failed to delete document");
    }
  }

  const isBusy = saving || isUploading;
  const busyLabel = isUploading
    ? `Uploading… ${progress}%`
    : saving
      ? "Saving…"
      : "Add Document";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-heading)",
            }}
          >
            Documents
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            RAMS, compliance certs, permits & insurance
          </p>
        </div>
        <Btn onClick={openNew}>
          <Plus className="w-4 h-4" strokeWidth={1.5} /> Add Document
        </Btn>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Documents"
          value={documents.length}
          sub="All records"
        />
        <StatCard label="Valid" value={valid.length} sub="Up to date" accent />
        <StatCard
          label="Expiring Soon"
          value={expiring.length}
          sub="Needs attention"
          danger={expiring.length > 0}
        />
        <StatCard
          label="Expired"
          value={expired.length}
          sub="Action required"
          danger={expired.length > 0}
        />
      </div>

      {(expired.length > 0 || expiring.length > 0) && (
        <div
          className="flex items-start gap-3 p-4"
          style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <AlertTriangle
            className="w-4 h-4 flex-shrink-0 mt-0.5"
            strokeWidth={1.5}
            style={{ color: "var(--danger)" }}
          />
          <div className="flex-1">
            <p
              className="text-sm font-semibold mb-1.5"
              style={{ color: "var(--danger)" }}
            >
              Attention Required
            </p>
            <div className="flex flex-wrap gap-2">
              {[...expired, ...expiring].map((d) => (
                <span
                  key={d.id}
                  className="text-xs px-2 py-1 font-medium"
                  style={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: d.status === "expired" ? "var(--danger)" : "var(--warning)",
                  }}
                >
                  {d.name}{" "}
                  {d.status === "expired"
                    ? "(Expired)"
                    : `(expires ${formatDate(d.expiry_date)})`}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          className="flex items-center gap-1 overflow-x-auto"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {(
            [
              { id: "all", label: "All", count: documents.length },
              { id: "valid", label: "Valid", count: valid.length },
              { id: "expiring_soon", label: "Expiring", count: expiring.length },
              { id: "expired", label: "Expired", count: expired.length },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className="px-4 py-2.5 text-sm transition-colors relative whitespace-nowrap flex items-center gap-1.5"
              style={
                filterStatus === tab.id
                  ? {
                      color: "var(--ink)",
                      fontWeight: 600,
                      borderBottom: "2px solid var(--accent)",
                      marginBottom: "-1px",
                    }
                  : { color: "var(--muted)" }
              }
            >
              {tab.label}
              <span
                className="inline-flex items-center justify-center px-1.5 text-[11px] font-bold"
                style={{
                  fontFamily: "var(--font-heading)",
                  backgroundColor:
                    filterStatus === tab.id
                      ? "var(--accent-bg)"
                      : "var(--surface-3)",
                  color:
                    filterStatus === tab.id
                      ? "var(--accent)"
                      : "var(--muted-2)",
                  minWidth: "18px",
                }}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            strokeWidth={1.5}
            style={{ color: "var(--muted-2)" }}
          />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-1.5 text-sm w-52 focus:outline-none"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--ink)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) =>
            setFilterType(e.target.value as DocumentType | "all")
          }
          className="py-1.5 px-3 text-sm focus:outline-none"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--muted-2)",
          }}
        >
          <option value="all">All Types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={filterRelatedTo}
          onChange={(e) =>
            setFilterRelatedTo(e.target.value as DocumentRelatedTo | "all")
          }
          className="py-1.5 px-3 text-sm focus:outline-none"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--muted-2)",
          }}
        >
          <option value="all">All Categories</option>
          <option value="company">Company</option>
          <option value="job">Job</option>
          <option value="subcontractor">Subcontractor</option>
          <option value="plant">Plant</option>
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={selectedDoc ? "xl:col-span-2" : "xl:col-span-3"}>
          <Panel title="Document Directory" noPad>
            {filtered.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title={
                  documents.length === 0
                    ? "No documents yet"
                    : "No documents match your filters"
                }
                description={
                  documents.length === 0
                    ? "Store RAMS, compliance certs, permits and insurance so nothing lapses unnoticed."
                    : "Try a different status, type or search term."
                }
                primaryLabel={
                  documents.length === 0 ? "Add your first document" : undefined
                }
                onPrimary={documents.length === 0 ? openNew : undefined}
                secondaryLabel="Import from spreadsheet"
                onSecondary={() => setLocation("/import")}
                hint={
                  documents.length === 0
                    ? "You can attach a file now or add it later."
                    : undefined
                }
              />
            ) : (
              filtered.map((doc, i) => {
                const days = daysUntil(doc.expiry_date);
                const isExpiringSoon = days !== null && days <= 30 && days > 0;
                const isExpired = doc.status === "expired";
                const needsAttention = isExpired || isExpiringSoon;
                const rowTint = isExpired
                  ? "var(--danger-bg)"
                  : isExpiringSoon
                    ? "var(--warning-bg)"
                    : undefined;
                const rowBorderColor = isExpired
                  ? "var(--danger)"
                  : isExpiringSoon
                    ? "var(--warning)"
                    : "transparent";
                return (
                  <div
                    key={doc.id}
                    onClick={() =>
                      setSelected(selected === doc.id ? null : doc.id)
                    }
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-5 py-4 cursor-pointer group transition-colors hover:bg-[var(--surface-2)]"
                    style={{
                      borderBottom:
                        i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                      backgroundColor:
                        selected === doc.id ? "var(--surface-2)" : rowTint,
                      borderLeft: `3px solid ${rowBorderColor}`,
                    }}
                  >
                    <div
                      className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: "var(--surface-3)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <FileText
                        className="w-3.5 h-3.5"
                        strokeWidth={1.5}
                        style={{ color: TYPE_COLORS[doc.type] }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-sm font-semibold truncate group-hover:text-[var(--accent)] transition-colors"
                          style={{ color: "var(--ink)" }}
                        >
                          {doc.name}
                        </span>
                        {needsAttention && (
                          <AlertTriangle
                            className="w-3.5 h-3.5 flex-shrink-0"
                            strokeWidth={1.5}
                            style={{ color: isExpired ? "var(--danger)" : "var(--warning)" }}
                          />
                        )}
                        {doc.file_path && (
                          <Paperclip
                            className="w-3 h-3 flex-shrink-0"
                            strokeWidth={1.5}
                            style={{ color: "var(--muted-2)" }}
                            aria-label="File attached"
                          />
                        )}
                      </div>
                      <div className="text-xs" style={{ color: "var(--muted)" }}>
                        <span className="font-medium">
                          {TYPE_LABELS[doc.type]}
                        </span>
                        {doc.related_name && <span> · {doc.related_name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge status={doc.status} />
                      <div
                        className="text-right text-xs hidden md:block font-mono"
                        style={{ color: "var(--muted)", minWidth: "90px" }}
                      >
                        {doc.expiry_date ? (
                          <span
                            style={{
                              color: isExpired
                                ? "var(--danger)"
                                : isExpiringSoon
                                  ? "var(--warning)"
                                  : "var(--muted)",
                            }}
                          >
                            {formatDate(doc.expiry_date)}
                          </span>
                        ) : (
                          <span>No expiry</span>
                        )}
                      </div>
                      <ChevronRight
                        className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        strokeWidth={1.5}
                        style={{ color: "var(--muted)" }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </Panel>
        </div>

        {selectedDoc && (
          <div>
            <Panel
              actions={
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(selectedDoc)}
                    className="p-1 transition-colors hover:bg-[var(--surface-3)]"
                    style={{ color: "var(--muted)" }}
                    title="Edit document"
                  >
                    <Pencil className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() =>
                      handleDelete(selectedDoc.id, selectedDoc.name)
                    }
                    className="p-1 transition-colors hover:bg-red-50"
                    style={{ color: "var(--danger)" }}
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    style={{ color: "var(--muted)" }}
                  >
                    <X className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              }
            >
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FolderOpen
                      className="w-3.5 h-3.5"
                      strokeWidth={1.5}
                      style={{ color: TYPE_COLORS[selectedDoc.type] }}
                    />
                    <span
                      className="text-xs"
                      style={{
                        color: TYPE_COLORS[selectedDoc.type],
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {TYPE_LABELS[selectedDoc.type]}
                    </span>
                  </div>
                  <h3
                    className="text-base font-semibold leading-snug mb-2"
                    style={{ color: "var(--ink)" }}
                  >
                    {selectedDoc.name}
                  </h3>
                  <Badge status={selectedDoc.status} />
                </div>

                <div
                  className="space-y-3 pt-1"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  {[
                    {
                      label: "Related To",
                      value: `${selectedDoc.related_to}${selectedDoc.related_name ? ` — ${selectedDoc.related_name}` : ""}`,
                    },
                    {
                      label: "Issued",
                      value: formatDate(selectedDoc.issued_date),
                    },
                    {
                      label: "Expiry",
                      value: formatDate(selectedDoc.expiry_date),
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex justify-between items-baseline gap-3 pt-3"
                      style={{ borderTop: "1px solid var(--surface-3)" }}
                    >
                      <span
                        className="text-xs flex-shrink-0 capitalize"
                        style={{ color: "var(--muted)" }}
                      >
                        {label}
                      </span>
                      <span
                        className={`text-sm text-right ${label === "Issued" || label === "Expiry" ? "font-mono" : ""}`}
                        style={{ color: "var(--ink)" }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {selectedDoc.expiry_date &&
                  (() => {
                    const days = daysUntil(selectedDoc.expiry_date);
                    if (days === null) return null;
                    const color =
                      days <= 0
                        ? "var(--danger)"
                        : days <= 30
                          ? "var(--warning)"
                          : "var(--success)";
                    return (
                      <div
                        className="p-3 text-xs font-mono font-medium"
                        style={{
                          backgroundColor: "var(--surface-2)",
                          border: `1px solid ${color}30`,
                          color,
                        }}
                      >
                        {days <= 0
                          ? `Expired ${Math.abs(days)} days ago`
                          : days <= 30
                            ? `Expires in ${days} days — renew now`
                            : `${days} days remaining`}
                      </div>
                    );
                  })()}

                {selectedDoc.file_path && (
                  <a
                    href={`${BASE}/api/storage${selectedDoc.file_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: "var(--accent-bg)",
                      color: "var(--accent)",
                      border: "1px solid var(--border-2)",
                    }}
                  >
                    <Download className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                    View / Download File
                  </a>
                )}

                {selectedDoc.notes && (
                  <div>
                    <p
                      className="text-xs font-medium uppercase tracking-widest mb-2"
                      style={{ color: "var(--muted)", letterSpacing: "0.08em" }}
                    >
                      Notes
                    </p>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--muted-2)" }}
                    >
                      {selectedDoc.notes}
                    </p>
                  </div>
                )}
              </div>
            </Panel>
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? "Edit Document" : "Add Document"}
      >
        <div className="space-y-4">
          <Field label="Document Name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. RAMS — Drain Installation Plot 4"
            />
            {errors.name && (
              <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                {errors.name}
              </p>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Document Type">
              <Select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    type: e.target.value as DocumentType,
                  }))
                }
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Related To">
              <Select
                value={form.related_to}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    related_to: e.target.value as DocumentRelatedTo,
                  }))
                }
              >
                <option value="company">Company</option>
                <option value="job">Job</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="plant">Plant</option>
              </Select>
            </Field>
          </div>
          <Field label="Related Name" hint="e.g. Job name, subcontractor name">
            <Input
              value={form.related_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, related_name: e.target.value }))
              }
              placeholder="e.g. Longbridge Drainage Phase 2"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue Date">
              <Input
                type="date"
                value={form.issued_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, issued_date: e.target.value }))
                }
              />
            </Field>
            <Field label="Expiry Date" hint="Leave blank if no expiry">
              <Input
                type="date"
                value={form.expiry_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expiry_date: e.target.value }))
                }
              />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Any relevant notes..."
              rows={2}
            />
          </Field>

          <Field label="Attach File" hint="PDF, image, or document (optional)">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
            {selectedFile ? (
              <div
                className="flex items-center justify-between px-3 py-2.5"
                style={{
                  backgroundColor: "var(--accent-bg)",
                  border: "1px solid var(--border-2)",
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Paperclip
                    className="w-3.5 h-3.5 flex-shrink-0"
                    strokeWidth={1.5}
                    style={{ color: "var(--accent)" }}
                  />
                  <span
                    className="text-sm truncate font-medium"
                    style={{ color: "var(--accent)" }}
                  >
                    {selectedFile.name}
                  </span>
                  <span
                    className="text-xs flex-shrink-0"
                    style={{ color: "var(--muted)" }}
                  >
                    ({(selectedFile.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="ml-2 flex-shrink-0"
                  style={{ color: "var(--muted)" }}
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:opacity-80"
                style={{
                  backgroundColor: "var(--surface-2)",
                  border: "1px dashed var(--border-2)",
                  color: "var(--muted)",
                }}
              >
                <Upload className="w-4 h-4" strokeWidth={1.5} />
                Click to attach a file
              </button>
            )}
          </Field>

          <div className="flex gap-3 pt-2">
            <Btn
              className="flex-1 justify-center"
              onClick={handleSubmit}
              disabled={isBusy}
            >
              {busyLabel}
            </Btn>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
