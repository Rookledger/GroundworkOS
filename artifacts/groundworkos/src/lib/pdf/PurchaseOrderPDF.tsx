import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { PurchaseOrder } from "../../types";

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
  poLabel: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#181410",
    textAlign: "right",
  },
  poNum: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1b5e78",
    textAlign: "right",
    marginTop: 4,
  },
  divider: { height: 1, backgroundColor: "#d9d4ce", marginVertical: 20 },
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0ede8",
    padding: "8 12",
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
    padding: "12 12",
    borderBottomWidth: 1,
    borderBottomColor: "#ece8e3",
  },
  tableCell: { fontSize: 9, color: "#181410" },
  tableCellMuted: { fontSize: 9, color: "#7a7469" },
  totalsSection: { marginTop: 24, marginLeft: "auto", width: 220 },
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
  infoBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#e8f3f7",
    borderLeftWidth: 3,
    borderLeftColor: "#1b5e78",
  },
  infoText: { fontSize: 8, color: "#1b5e78", lineHeight: 1.5 },
});

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ordered: "Ordered",
  received: "Received",
  invoiced: "Invoiced",
};

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
  po: PurchaseOrder;
  company?: Record<string, string>;
}

export function PurchaseOrderPDF({ po, company }: Props) {
  const companyName = company?.companyName ?? "GroundworkOS Ltd";
  const companyAddress = company?.address ?? "";
  const companyVat = company?.vatNumber ?? "";
  const companyPhone = company?.phone ?? "";
  const companyEmail = company?.email ?? "";

  return (
    <Document title={`Purchase Order ${po.po_number}`} author={companyName}>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.logo}>{companyName.toUpperCase()}</Text>
            <Text style={S.logoSub}>PURCHASE ORDER</Text>
            {companyAddress ? (
              <Text style={{ ...S.logoSub, marginTop: 8, maxWidth: 200 }}>
                {companyAddress}
              </Text>
            ) : null}
            {companyPhone ? (
              <Text style={S.logoSub}>{companyPhone}</Text>
            ) : null}
            {companyEmail ? (
              <Text style={S.logoSub}>{companyEmail}</Text>
            ) : null}
            {companyVat ? (
              <Text style={S.logoSub}>VAT No: {companyVat}</Text>
            ) : null}
          </View>
          <View>
            <Text style={S.poLabel}>PURCHASE ORDER</Text>
            <Text style={S.poNum}>{po.po_number}</Text>
            <Text
              style={{
                ...S.value,
                textAlign: "right",
                marginTop: 8,
                fontSize: 9,
                color: "#7a7469",
              }}
            >
              Status: {STATUS_LABELS[po.status] ?? po.status}
            </Text>
          </View>
        </View>

        <View style={S.divider} />

        {/* Order Details */}
        <View style={S.row}>
          <View style={S.col}>
            <Text style={S.label}>Supplier</Text>
            <Text style={S.value}>{po.supplier}</Text>
          </View>
          <View style={S.col}>
            <Text style={S.label}>Order Date</Text>
            <Text style={S.valueMono}>{fmtDate(po.order_date)}</Text>
          </View>
          <View style={S.col}>
            <Text style={S.label}>Expected Delivery</Text>
            <Text style={S.valueMono}>{fmtDate(po.expected_delivery)}</Text>
          </View>
        </View>

        {(po.job_number || po.job_title) && (
          <View style={[S.row, { marginBottom: 0 }]}>
            <View style={S.col}>
              <Text style={S.label}>Related Job</Text>
              <Text style={S.value}>
                {po.job_number
                  ? `${po.job_number}${po.job_title ? ` — ${po.job_title}` : ""}`
                  : (po.job_title ?? "—")}
              </Text>
            </View>
          </View>
        )}

        <View style={S.divider} />

        {/* Items Table */}
        <View style={S.tableHeader}>
          <Text style={[S.tableHeaderText, { flex: 1 }]}>Description</Text>
          <Text style={[S.tableHeaderText, { width: 100, textAlign: "right" }]}>
            Amount (excl. VAT)
          </Text>
        </View>

        <View style={S.tableRow}>
          <View style={{ flex: 1 }}>
            <Text style={S.tableCell}>{po.description}</Text>
          </View>
          <Text
            style={[
              S.tableCell,
              { width: 100, textAlign: "right", fontFamily: "Courier" },
            ]}
          >
            {fmt(po.amount)}
          </Text>
        </View>

        {/* Totals */}
        <View style={S.totalsSection}>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>Subtotal</Text>
            <Text style={S.totalValue}>{fmt(po.amount)}</Text>
          </View>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>VAT @ 20%</Text>
            <Text style={S.totalValue}>{fmt(po.vat_amount)}</Text>
          </View>
          <View style={S.grandTotalRow}>
            <Text style={S.grandTotalLabel}>Total</Text>
            <Text style={S.grandTotalValue}>{fmt(po.total_amount)}</Text>
          </View>
        </View>

        {/* Delivery confirmation box */}
        {po.delivery_date && (
          <View style={S.infoBox}>
            <Text style={S.infoText}>
              Goods received: {fmtDate(po.delivery_date)}
            </Text>
          </View>
        )}

        {/* Notes */}
        {po.notes && (
          <View style={S.notes}>
            <Text style={S.notesLabel}>Notes</Text>
            <Text style={S.notesText}>{po.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>
            {companyName} · {po.po_number}
          </Text>
          <Text
            style={S.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
