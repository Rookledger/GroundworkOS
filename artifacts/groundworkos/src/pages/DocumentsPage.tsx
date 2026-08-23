import { useState, useRef } from "react";
import {
  Plus,
  Search,
  AlertTriangle,
  FolderOpen,
  X,
  ChevronRight,
  Trash2,
  Paperclip,
  Download,
  Upload,
  Pencil,
} from "lucide-react";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { Badge } from "../components/ui/Badge";
import { Btn } from "../components/ui/Btn";
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
  certification: "#1b5e78",
  permit: "#a78bfa",
  compliance: "#fb923c",
  contract: "#181410",
  other: "#7a7469",
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

  const [search, setSearch] = useState("");
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
              color: "#181410",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Documents
          </h1>
          <p className="text-sm mt-1" style={{ color: "#7a7469" }}>
            RAMS, compliance certs, permits & insurance
          </p>
        </div>
        <Btn onClick={openNew}>
          <Plus className="w-4 h-4" /> Add Document
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
          className="flex items-start gap-3 p-4 rounded-xl"
          style={{ backgroundColor: "#eeeae4", border: "1px solid #d9d4ce" }}
        >
          <AlertTriangle
            className="w-4 h-4 flex-shrink-0 mt-0.5"
            style={{ color: "#c13a2a" }}
          />
          <div className="flex-1">
            <p
              className="text-sm font-semibold mb-1.5"
              style={{ color: "#c13a2a" }}
            >
              Attention Required
            </p>
            <div className="flex flex-wrap gap-2">
              {[...expired, ...expiring].map((d) => (
                <span
                  key={d.id}
                  className="text-xs px-2 py-1 rounded font-mono font-medium"
                  style={{
                    backgroundColor: "#fafaf8",
                    border: "1px solid #d9d4ce",
                    color: d.status === "expired" ? "#c13a2a" : "#b56918",
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: "#c0bab4" }}
          />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-1.5 rounded-md text-sm w-52 focus:outline-none"
            style={{
              backgroundColor: "#fafaf8",
              border: "1px solid #d9d4ce",
              color: "#181410",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#1b5e78")}
            onBlur={(e) => (e.target.style.borderColor = "#d9d4ce")}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) =>
            setFilterType(e.target.value as DocumentType | "all")
          }
          className="py-1.5 px-3 rounded-md text-sm focus:outline-none"
          style={{
            backgroundColor: "#fafaf8",
            border: "1px solid #d9d4ce",
            color: "#8a8377",
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
          className="py-1.5 px-3 rounded-md text-sm focus:outline-none"
          style={{
            backgroundColor: "#fafaf8",
            border: "1px solid #d9d4ce",
            color: "#8a8377",
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
              <p
                className="text-center py-12 text-sm"
                style={{ color: "#c0bab4" }}
              >
                No documents found
              </p>
            ) : (
              filtered.map((doc, i) => {
                const days = daysUntil(doc.expiry_date);
                const isExpiringSoon = days !== null && days <= 30 && days > 0;
                const isExpired = doc.status === "expired";
                return (
                  <div
                    key={doc.id}
                    onClick={() =>
                      setSelected(selected === doc.id ? null : doc.id)
                    }
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer group transition-colors hover:bg-[#eeeae4]"
                    style={{
                      borderBottom:
                        i < filtered.length - 1 ? "1px solid #d9d4ce" : "none",
                      backgroundColor:
                        selected === doc.id ? "#eeeae4" : undefined,
                      borderLeft:
                        selected === doc.id
                          ? "2px solid #1b5e78"
                          : "2px solid transparent",
                    }}
                  >
                    <div
                      className="w-1.5 h-8 rounded-full flex-shrink-0"
                      style={{ backgroundColor: TYPE_COLORS[doc.type] }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-sm font-semibold truncate group-hover:text-[#1b5e78] transition-colors"
                          style={{ color: "#181410" }}
                        >
                          {doc.name}
                        </span>
                        {(isExpired || isExpiringSoon) && (
                          <AlertTriangle
                            className="w-3.5 h-3.5 flex-shrink-0"
                            style={{ color: isExpired ? "#c13a2a" : "#e07b39" }}
                          />
                        )}
                        {doc.file_path && (
                          <Paperclip
                            className="w-3 h-3 flex-shrink-0"
                            style={{ color: "#a8a099" }}
                            aria-label="File attached"
                          />
                        )}
                      </div>
                      <div className="text-xs" style={{ color: "#7a7469" }}>
                        <span className="font-medium">
                          {TYPE_LABELS[doc.type]}
                        </span>
                        {doc.related_name && <span> · {doc.related_name}</span>}
                      </div>
                    </div>
                    <Badge status={doc.status} />
                    <div
                      className="text-right text-xs hidden md:block flex-shrink-0 ml-4 font-mono"
                      style={{ color: "#7a7469", minWidth: "90px" }}
                    >
                      {doc.expiry_date ? (
                        <span
                          style={{
                            color: isExpired
                              ? "#c13a2a"
                              : isExpiringSoon
                                ? "#e07b39"
                                : "#7a7469",
                          }}
                        >
                          {formatDate(doc.expiry_date)}
                        </span>
                      ) : (
                        <span>No expiry</span>
                      )}
                    </div>
                    <ChevronRight
                      className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                      style={{ color: "#7a7469" }}
                    />
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
                    className="p-1 rounded transition-colors hover:bg-[#e8e4dd]"
                    style={{ color: "#7a7469" }}
                    title="Edit document"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      handleDelete(selectedDoc.id, selectedDoc.name)
                    }
                    className="p-1 rounded transition-colors hover:bg-red-50"
                    style={{ color: "#c13a2a" }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    style={{ color: "#7a7469" }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              }
            >
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FolderOpen
                      className="w-3.5 h-3.5"
                      style={{ color: TYPE_COLORS[selectedDoc.type] }}
                    />
                    <span
                      className="text-xs"
                      style={{
                        color: TYPE_COLORS[selectedDoc.type],
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {TYPE_LABELS[selectedDoc.type]}
                    </span>
                  </div>
                  <h3
                    className="text-base font-semibold leading-snug mb-2"
                    style={{ color: "#181410" }}
                  >
                    {selectedDoc.name}
                  </h3>
                  <Badge status={selectedDoc.status} />
                </div>

                <div
                  className="space-y-3 pt-1"
                  style={{ borderTop: "1px solid #d9d4ce" }}
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
                      style={{ borderTop: "1px solid #ece8e3" }}
                    >
                      <span
                        className="text-xs flex-shrink-0 capitalize"
                        style={{ color: "#7a7469" }}
                      >
                        {label}
                      </span>
                      <span
                        className={`text-sm text-right ${label === "Issued" || label === "Expiry" ? "font-mono" : ""}`}
                        style={{ color: "#181410" }}
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
                        ? "#c13a2a"
                        : days <= 30
                          ? "#e07b39"
                          : "#2a6e45";
                    return (
                      <div
                        className="p-3 rounded-md text-xs font-mono font-medium"
                        style={{
                          backgroundColor: "#eeeae4",
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
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: "#e8f3f7",
                      color: "#1b5e78",
                      border: "1px solid #b8d8e8",
                    }}
                  >
                    <Download className="w-4 h-4 flex-shrink-0" />
                    View / Download File
                  </a>
                )}

                {selectedDoc.notes && (
                  <div>
                    <p
                      className="text-xs font-medium uppercase tracking-widest mb-2"
                      style={{ color: "#7a7469", letterSpacing: "0.08em" }}
                    >
                      Notes
                    </p>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "#8a8377" }}
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
              <p className="mt-1 text-xs" style={{ color: "#c13a2a" }}>
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
                className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                style={{
                  backgroundColor: "#e8f3f7",
                  border: "1px solid #b8d8e8",
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Paperclip
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: "#1b5e78" }}
                  />
                  <span
                    className="text-sm truncate font-medium"
                    style={{ color: "#1b5e78" }}
                  >
                    {selectedFile.name}
                  </span>
                  <span
                    className="text-xs flex-shrink-0"
                    style={{ color: "#7a7469" }}
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
                  style={{ color: "#7a7469" }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors hover:opacity-80"
                style={{
                  backgroundColor: "#f5f3ef",
                  border: "1px dashed #c0bab4",
                  color: "#7a7469",
                }}
              >
                <Upload className="w-4 h-4" />
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
