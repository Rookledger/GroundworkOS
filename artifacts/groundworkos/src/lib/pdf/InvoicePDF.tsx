import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Invoice } from "../../types";

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    paddingHorizontal: 48,
    paddingVertical: 48,
    fontSize: 10,
    color: "#181410",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 40,
  },
  logo: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#1b5e78",
    letterSpacing: 1,
  },
  logoSub: { fontSize: 8, color: "#7a7469", marginTop: 3, letterSpacing: 0.5 },
  invoiceLabel: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#181410",
    textAlign: "right",
  },
  invoiceNum: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1b5e78",
    textAlign: "right",
    marginTop: 4,
  },
  divider: { height: 1, backgroundColor: "#d9d4ce", marginVertical: 20 },
  thinDivider: { height: 1, backgroundColor: "#ece8e3", marginVertical: 12 },
  row: { flexDirection: "row", gap: 24, marginBottom: 24 },
  col: { flex: 1 },
  label: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#7a7469",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  value: { fontSize: 10, color: "#181410" },
  valueMono: { fontSize: 10, color: "#181410", fontFamily: "Courier" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0ede8",
    padding: "8 12",
    marginBottom: 0,
  },
  tableHeaderText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#7a7469",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: "row",
    padding: "10 12",
    borderBottomWidth: 1,
    borderBottomColor: "#ece8e3",
  },
  tableCell: { fontSize: 9, color: "#181410" },
  tableCellMuted: { fontSize: 9, color: "#7a7469" },
  totalsSection: { marginTop: 24, marginLeft: "auto", width: 200 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  totalLabel: { fontSize: 9, color: "#7a7469" },
  totalValue: { fontSize: 9, color: "#181410", fontFamily: "Courier" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 2,
    borderTopColor: "#1b5e78",
  },
  grandTotalLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#181410",
  },
  grandTotalValue: {
    fontSize: 13,
    fontFamily: "Courier-Bold",
    color: "#1b5e78",
  },
  notes: {
    marginTop: 32,
    padding: 16,
    backgroundColor: "#f5f1ec",
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#7a7469",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  notesText: { fontSize: 9, color: "#4a4540", lineHeight: 1.5 },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: "#a8a099", fontFamily: "Courier" },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  badgePaid: { backgroundColor: "#e0f0e8" },
  badgePaidText: {
    fontSize: 8,
    color: "#2a6e45",
    fontFamily: "Helvetica-Bold",
  },
  cisBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#e8f3f7",
    borderLeftWidth: 3,
    borderLeftColor: "#1b5e78",
  },
  cisText: { fontSize: 8, color: "#1b5e78" },
});

function fmt(n: number) {
  return `£${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}
function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

interface Props {
  invoice: Invoice;
  company?: Record<string, string>;
}

export function InvoicePDF({ invoice, company }: Props) {
  const companyName = company?.companyName ?? "GroundworkOS Ltd";
  const companyAddress = company?.address ?? "";
  const vatNumber = company?.vatNumber ?? "";
  const cisRef = company?.cisReference ?? "";
  const paymentTerms = company?.paymentTerms ?? "30 days";
  const bankName = company?.bankName ?? "";
  const sortCode = company?.sortCode ?? "";
  const accountNumber = company?.accountNumber ?? "";

  const hasCisDeduction = invoice.cis_deduction && invoice.cis_deduction > 0;

  return (
    <Document title={`Invoice ${invoice.invoice_number}`} author={companyName}>
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <View>
            <Text style={S.logo}>{companyName.toUpperCase()}</Text>
            {companyAddress ? (
              <Text style={S.logoSub}>{companyAddress}</Text>
            ) : null}
            {vatNumber ? <Text style={S.logoSub}>VAT: {vatNumber}</Text> : null}
          </View>
          <View>
            <Text style={S.invoiceLabel}>INVOICE</Text>
            <Text style={S.invoiceNum}>{invoice.invoice_number}</Text>
            {invoice.status === "paid" && (
              <View
                style={[
                  S.badge,
                  S.badgePaid,
                  { marginTop: 8, marginLeft: "auto" },
                ]}
              >
                <Text style={S.badgePaidText}>PAID</Text>
              </View>
            )}
          </View>
        </View>

        <View style={S.divider} />

        <View style={S.row}>
          <View style={S.col}>
            <Text style={S.label}>Bill To</Text>
            <Text
              style={[
                S.value,
                { fontFamily: "Helvetica-Bold", marginBottom: 3 },
              ]}
            >
              {invoice.client?.company_name ?? "—"}
            </Text>
          </View>
          <View style={S.col}>
            <Text style={S.label}>Related Job</Text>
            <Text style={S.value}>{invoice.job?.title ?? "—"}</Text>
          </View>
          <View style={{ width: 130 }}>
            {[
              { label: "Issue Date", value: fmtDate(invoice.issued_date) },
              { label: "Due Date", value: fmtDate(invoice.due_date) },
              { label: "Payment Terms", value: paymentTerms },
            ].map(({ label, value }) => (
              <View key={label} style={{ marginBottom: 10 }}>
                <Text style={S.label}>{label}</Text>
                <Text style={S.valueMono}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={S.divider} />

        <View style={S.tableHeader}>
          <Text style={[S.tableHeaderText, { flex: 1 }]}>Description</Text>
          <Text style={[S.tableHeaderText, { width: 80, textAlign: "right" }]}>
            Amount
          </Text>
        </View>

        {(invoice as any).line_items &&
        (invoice as any).line_items.length > 0 ? (
          (invoice as any).line_items.map((li: any) => (
            <View key={li.id} style={S.tableRow}>
              <View style={{ flex: 1 }}>
                <Text style={S.tableCell}>{li.description}</Text>
                <Text
                  style={[
                    S.tableCellMuted,
                    { marginTop: 2, fontFamily: "Courier" },
                  ]}
                >
                  {li.quantity} {li.unit} × {fmt(li.unit_price)}
                </Text>
              </View>
              <Text
                style={[
                  S.tableCell,
                  { width: 80, textAlign: "right", fontFamily: "Courier" },
                ]}
              >
                {fmt(li.total)}
              </Text>
            </View>
          ))
        ) : (
          <View style={S.tableRow}>
            <Text style={[S.tableCell, { flex: 1 }]}>Works as described</Text>
            <Text
              style={[
                S.tableCell,
                { width: 80, textAlign: "right", fontFamily: "Courier" },
              ]}
            >
              {fmt(invoice.subtotal)}
            </Text>
          </View>
        )}

        <View style={S.totalsSection}>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>Subtotal</Text>
            <Text style={S.totalValue}>{fmt(invoice.subtotal)}</Text>
          </View>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>VAT @ 20%</Text>
            <Text style={S.totalValue}>{fmt(invoice.vat_amount)}</Text>
          </View>
          {hasCisDeduction && (
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>CIS Deduction</Text>
              <Text style={[S.totalValue, { color: "#c13a2a" }]}>
                -{fmt(invoice.cis_deduction!)}
              </Text>
            </View>
          )}
          <View style={S.grandTotalRow}>
            <Text style={S.grandTotalLabel}>
              {hasCisDeduction ? "Net Due" : "Total Due"}
            </Text>
            <Text style={S.grandTotalValue}>
              {fmt(
                hasCisDeduction
                  ? invoice.total_amount - (invoice.cis_deduction ?? 0)
                  : invoice.total_amount,
              )}
            </Text>
          </View>
        </View>

        {cisRef ? (
          <View style={S.cisBox}>
            <Text style={S.cisText}>
              CIS Ref: {cisRef} — The contractor is a registered CIS contractor.
              The above amounts are subject to CIS deductions as appropriate.
            </Text>
          </View>
        ) : null}

        {(bankName || sortCode || accountNumber) && (
          <View
            style={{
              marginTop: 24,
              padding: 14,
              borderWidth: 1,
              borderColor: "#d9d4ce",
              borderRadius: 4,
            }}
          >
            <Text style={[S.label, { marginBottom: 8 }]}>Bank Details</Text>
            <View style={{ flexDirection: "row", gap: 24 }}>
              {bankName ? (
                <View>
                  <Text style={S.label}>Bank</Text>
                  <Text style={S.valueMono}>{bankName}</Text>
                </View>
              ) : null}
              {sortCode ? (
                <View>
                  <Text style={S.label}>Sort Code</Text>
                  <Text style={S.valueMono}>{sortCode}</Text>
                </View>
              ) : null}
              {accountNumber ? (
                <View>
                  <Text style={S.label}>Account No</Text>
                  <Text style={S.valueMono}>{accountNumber}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {invoice.notes && (
          <View style={S.notes}>
            <Text style={S.notesLabel}>Notes</Text>
            <Text style={S.notesText}>{invoice.notes}</Text>
          </View>
        )}

        <View style={S.footer}>
          <Text style={S.footerText}>{companyName}</Text>
          <Text style={S.footerText}>
            {invoice.invoice_number} · Due {fmtDate(invoice.due_date)}
          </Text>
          <Text style={S.footerText}>Page 1</Text>
        </View>
      </Page>
    </Document>
  );
}
