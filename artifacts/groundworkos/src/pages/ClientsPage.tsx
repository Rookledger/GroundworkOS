import { useState } from "react";
import {
  Plus,
  Mail,
  Phone,
  X,
  ChevronRight,
  Building2,
  MapPin,
  Trash2,
  Pencil,
} from "lucide-react";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { Btn } from "../components/ui/Btn";
import { SearchInput } from "../components/ui/SearchInput";
import { ListPanel } from "../components/ui/ListPanel";
import { Modal, Field, Input, Textarea } from "../components/ui/Modal";
import { cn, formatCurrency } from "../lib/utils";
import { useApp } from "../store/AppContext";
import {
  createClient,
  updateClient,
  deleteClient,
} from "@workspace/api-client-react";
import { toClient } from "../lib/apiTransforms";
import type { Client } from "../types";
import { toast } from "sonner";

const emptyForm = {
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  vat_number: "",
  notes: "",
};

export function ClientsPage() {
  const { state, dispatch } = useApp();
  const { clients } = state;

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const filtered = clients.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.company_name.toLowerCase().includes(q) ||
      (c.contact_name ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  const selectedClient = selected
    ? clients.find((c) => c.id === selected)
    : null;
  const totalValue = clients.reduce((s, c) => s + c.total_value, 0);
  const totalJobs = clients.reduce((s, c) => s + c.total_jobs, 0);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  }

  function openEdit(client: Client) {
    setEditingId(client.id);
    setForm({
      company_name: client.company_name,
      contact_name: client.contact_name ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      address: client.address ?? "",
      vat_number: client.vat_number ?? "",
      notes: client.notes ?? "",
    });
    setErrors({});
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.company_name.trim()) e.company_name = "Company name is required";
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
        const result = await updateClient(editingId, {
          companyName: form.company_name.trim(),
          contactName: form.contact_name || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          vatNumber: form.vat_number || undefined,
          notes: form.notes || undefined,
        });
        dispatch({
          type: "UPDATE_CLIENT",
          id: editingId,
          updates: toClient(result),
        });
        setShowModal(false);
        toast.success("Client updated");
      } else {
        const result = await createClient({
          companyName: form.company_name.trim(),
          contactName: form.contact_name || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          vatNumber: form.vat_number || undefined,
          notes: form.notes || undefined,
        } as any);
        dispatch({ type: "ADD_CLIENT", client: toClient(result) });
        setShowModal(false);
        toast.success(`${result.companyName} added`);
      }
    } catch {
      toast.error(
        editingId ? "Failed to update client" : "Failed to add client",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      await deleteClient(id);
      dispatch({ type: "REMOVE_CLIENT", id });
      setSelected(null);
      toast.success(`${name} deleted`);
    } catch {
      toast.error("Failed to delete client");
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h1
          className="text-2xl font-bold"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            color: "#181410",
            letterSpacing: "-0.02em",
          }}
        >
          Clients
        </h1>
        <Btn onClick={openNew}>
          <Plus className="w-4 h-4" /> New Client
        </Btn>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          accent
          label="Total Clients"
          value={clients.length}
          sub="Active directory"
        />
        <StatCard
          label="Total Jobs"
          value={totalJobs}
          sub="Across all clients"
        />
        <StatCard
          label="Total Value"
          value={formatCurrency(totalValue)}
          sub="All-time revenue"
        />
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search clients..."
        className="py-2 w-full max-w-sm rounded-lg focus:outline-none transition-colors"
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={selectedClient ? "xl:col-span-2" : "xl:col-span-3"}>
          <ListPanel
            title="Client Directory"
            items={filtered}
            emptyMessage="No clients found"
            renderRow={(client, i, total) => (
              <div
                key={client.id}
                onClick={() =>
                  setSelected(selected === client.id ? null : client.id)
                }
                className={cn(
                  "flex items-center gap-5 px-5 py-4 cursor-pointer transition-colors group",
                  selected === client.id
                    ? "bg-[#eeeae4]"
                    : "hover:bg-[#eeeae4]",
                )}
                style={{
                  borderBottom: i < total - 1 ? "1px solid #d9d4ce" : "none",
                  borderLeft:
                    selected === client.id
                      ? "3px solid #1b5e78"
                      : "3px solid transparent",
                }}
              >
                <div
                  className="w-10 h-10 rounded flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{
                    backgroundColor: "#e8e4dd",
                    color: "#4a4540",
                    border: "1px solid #d9d4ce",
                  }}
                >
                  {client.company_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-semibold truncate"
                    style={{ color: "#181410" }}
                  >
                    {client.company_name}
                  </div>
                  <div
                    className="text-xs mt-0.5 truncate"
                    style={{ color: "#7a7469" }}
                  >
                    {client.contact_name ?? "No contact"}
                  </div>
                </div>
                {client.email && (
                  <div
                    className="hidden md:flex items-center gap-1.5 w-48 flex-shrink-0 text-xs"
                    style={{ color: "#7a7469" }}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span className="truncate font-mono">{client.email}</span>
                  </div>
                )}
                <div className="text-right hidden sm:block w-28 flex-shrink-0">
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "#7a7469" }}
                  >
                    Jobs
                  </div>
                  <div
                    className="text-sm font-medium font-mono tnum"
                    style={{ color: "#181410" }}
                  >
                    {client.total_jobs}
                  </div>
                </div>
                <div className="text-right hidden sm:block w-28 flex-shrink-0">
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: "#7a7469" }}
                  >
                    Value
                  </div>
                  <div
                    className="text-sm font-medium font-mono tnum"
                    style={{ color: "#181410" }}
                  >
                    {formatCurrency(client.total_value)}
                  </div>
                </div>
                <ChevronRight
                  className={cn(
                    "w-4 h-4 flex-shrink-0 transition-opacity ml-2",
                    selected === client.id
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100",
                  )}
                  style={{ color: "#7a7469" }}
                />
              </div>
            )}
          />
        </div>

        {selectedClient && (
          <div>
            <Panel
              actions={
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(selectedClient)}
                    className="p-1.5 rounded transition-colors hover:bg-[#e8e4dd]"
                    style={{ color: "#7a7469" }}
                    title="Edit client"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      handleDelete(
                        selectedClient.id,
                        selectedClient.company_name,
                      )
                    }
                    className="p-1.5 rounded transition-colors hover:bg-red-50"
                    style={{ color: "#c13a2a" }}
                    title="Delete client"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="hover:bg-[#e8e4dd] p-1.5 rounded transition-colors"
                    style={{ color: "#7a7469" }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              }
            >
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded flex items-center justify-center text-lg font-bold flex-shrink-0"
                    style={{
                      backgroundColor: "#e8e4dd",
                      color: "#181410",
                      border: "1px solid #d9d4ce",
                    }}
                  >
                    {selectedClient.company_name[0]}
                  </div>
                  <div className="pt-1">
                    <h2
                      className="text-xl font-bold leading-none mb-1.5"
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        color: "#181410",
                      }}
                    >
                      {selectedClient.company_name}
                    </h2>
                    <div
                      className="flex items-center gap-2 text-sm"
                      style={{ color: "#7a7469" }}
                    >
                      <span className="font-medium">
                        {selectedClient.contact_name ?? "No contact"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: "#eeeae4",
                      border: "1px solid #d9d4ce",
                    }}
                  >
                    <div
                      className="text-[11px] font-bold uppercase tracking-widest mb-1"
                      style={{ color: "#7a7469" }}
                    >
                      Total Jobs
                    </div>
                    <div
                      className="text-2xl font-bold font-mono tnum"
                      style={{ color: "#181410" }}
                    >
                      {selectedClient.total_jobs}
                    </div>
                  </div>
                  <div
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: "#eeeae4",
                      border: "1px solid #d9d4ce",
                    }}
                  >
                    <div
                      className="text-[11px] font-bold uppercase tracking-widest mb-1"
                      style={{ color: "#7a7469" }}
                    >
                      Total Value
                    </div>
                    <div
                      className="text-2xl font-bold font-mono tnum"
                      style={{ color: "#1b5e78" }}
                    >
                      {formatCurrency(selectedClient.total_value)}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3
                    className="text-[11px] font-bold uppercase tracking-widest"
                    style={{
                      color: "#7a7469",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    Contact Details
                  </h3>
                  <div
                    className="space-y-3"
                    style={{
                      borderTop: "1px solid #d9d4ce",
                      paddingTop: "12px",
                    }}
                  >
                    {[
                      {
                        label: "Email",
                        value: selectedClient.email,
                        icon: <Mail className="w-3.5 h-3.5" />,
                      },
                      {
                        label: "Phone",
                        value: selectedClient.phone,
                        icon: <Phone className="w-3.5 h-3.5" />,
                      },
                      {
                        label: "Address",
                        value: selectedClient.address,
                        icon: <MapPin className="w-3.5 h-3.5" />,
                      },
                      {
                        label: "VAT No",
                        value: selectedClient.vat_number,
                        icon: <Building2 className="w-3.5 h-3.5" />,
                      },
                    ].map(({ label, value, icon }) => (
                      <div key={label} className="flex gap-3">
                        <div
                          className="w-6 flex-shrink-0 flex items-center justify-center mt-0.5"
                          style={{ color: "#7a7469" }}
                        >
                          {icon}
                        </div>
                        <div className="min-w-0">
                          <div
                            className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
                            style={{ color: "#7a7469" }}
                          >
                            {label}
                          </div>
                          {value ? (
                            <div
                              className="text-sm font-medium truncate"
                              style={{
                                color: "#181410",
                                fontFamily:
                                  label === "Email" ||
                                  label === "Phone" ||
                                  label === "VAT No"
                                    ? "'JetBrains Mono', monospace"
                                    : "inherit",
                              }}
                            >
                              {value}
                            </div>
                          ) : (
                            <div
                              className="text-sm italic"
                              style={{ color: "#a8a099" }}
                            >
                              Not provided
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedClient.notes && (
                  <div>
                    <h3
                      className="text-[11px] font-bold uppercase tracking-widest mb-3"
                      style={{
                        color: "#7a7469",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      Notes
                    </h3>
                    <div
                      className="p-4 rounded-lg text-sm leading-relaxed whitespace-pre-wrap"
                      style={{
                        backgroundColor: "#fafaf8",
                        border: "1px solid #d9d4ce",
                        color: "#4a4540",
                      }}
                    >
                      {selectedClient.notes}
                    </div>
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
        title={editingId ? "Edit Client" : "New Client"}
      >
        <div className="space-y-4">
          <Field label="Company Name" required>
            <Input
              value={form.company_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, company_name: e.target.value }))
              }
              placeholder="e.g. Midlands Groundworks Ltd"
            />
            {errors.company_name && (
              <p className="mt-1 text-xs" style={{ color: "#c13a2a" }}>
                {errors.company_name}
              </p>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact Name">
              <Input
                value={form.contact_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact_name: e.target.value }))
                }
                placeholder="e.g. John Smith"
              />
            </Field>
            <Field label="VAT Number">
              <Input
                value={form.vat_number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, vat_number: e.target.value }))
                }
                placeholder="e.g. GB123456789"
                className="font-mono"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="john@company.co.uk"
                className="font-mono"
              />
            </Field>
            <Field label="Phone">
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="07700 900000"
                className="font-mono"
              />
            </Field>
          </div>
          <Field label="Address">
            <Textarea
              value={form.address}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
              }
              placeholder="123 Business Park, Birmingham, B1 1AA"
              rows={2}
            />
          </Field>
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
          <div className="flex gap-3 pt-2">
            <Btn
              className="flex-1 justify-center"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving
                ? editingId
                  ? "Saving…"
                  : "Adding…"
                : editingId
                  ? "Save Changes"
                  : "Add Client"}
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
