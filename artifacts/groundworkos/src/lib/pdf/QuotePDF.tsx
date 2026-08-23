import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Quote } from "../../types";

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
  quoteLabel: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#181410",
    textAlign: "right",
  },
  quoteNum: {
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
    padding: "10 12",
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
  terms: {
    marginTop: 32,
    padding: 16,
    backgroundColor: "#f5f1ec",
    borderRadius: 4,
  },
  termsLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#7a7469",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  termsText: { fontSize: 9, color: "#4a4540", lineHeight: 1.5 },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: "#a8a099", fontFamily: "Courier" },
  validBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#e8f3f7",
    borderLeftWidth: 3,
    borderLeftColor: "#1b5e78",
  },
  validText: { fontSize: 8, color: "#1b5e78" },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
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
  quote: Quote;
  company?: Record<string, string>;
}

export function QuotePDF({ quote, company }: Props) {
  const companyName = company?.companyName ?? "GroundworkOS Ltd";
  const companyAddress = company?.address ?? "";
  const vatNumber = company?.vatNumber ?? "";
  const paymentTerms = company?.paymentTerms ?? "30 days net from invoice";

  const statusColors: Record<string, string> = {
    accepted: "#2a6e45",
    sent: "#1b5e78",
    draft: "#7a7469",
    declined: "#c13a2a",
  };

  return (
    <Document title={`Quote ${quote.quote_number}`} author={companyName}>
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
            <Text style={S.quoteLabel}>QUOTATION</Text>
            <Text style={S.quoteNum}>{quote.quote_number}</Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                marginTop: 6,
              }}
            >
              <View
                style={[
                  S.statusBadge,
                  {
                    backgroundColor: `${statusColors[quote.status] ?? "#7a7469"}18`,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 8,
                    fontFamily: "Helvetica-Bold",
                    color: statusColors[quote.status] ?? "#7a7469",
                  }}
                >
                  {quote.status.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={S.divider} />

        <View style={S.row}>
          <View style={S.col}>
            <Text style={S.label}>Prepared For</Text>
            <Text
              style={[
                S.value,
                { fontFamily: "Helvetica-Bold", marginBottom: 3 },
              ]}
            >
              {quote.client?.company_name ?? "—"}
            </Text>
          </View>
          <View style={S.col}>
            <Text style={S.label}>Project</Text>
            <Text style={S.value}>{quote.title ?? "—"}</Text>
          </View>
          <View style={{ width: 130 }}>
            {[
              { label: "Quote Date", value: fmtDate(quote.created_at) },
              { label: "Valid Until", value: fmtDate(quote.valid_until) },
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
          <Text style={[S.tableHeaderText, { width: 50, textAlign: "right" }]}>
            Qty
          </Text>
          <Text style={[S.tableHeaderText, { width: 40, textAlign: "right" }]}>
            Unit
          </Text>
          <Text style={[S.tableHeaderText, { width: 70, textAlign: "right" }]}>
            Rate
          </Text>
          <Text style={[S.tableHeaderText, { width: 70, textAlign: "right" }]}>
            Amount
          </Text>
        </View>

        {quote.line_items.length > 0 ? (
          quote.line_items.map((li) => (
            <View key={li.id} style={S.tableRow}>
              <Text style={[S.tableCell, { flex: 1 }]}>{li.description}</Text>
              <Text
                style={[
                  S.tableCellMuted,
                  { width: 50, textAlign: "right", fontFamily: "Courier" },
                ]}
              >
                {li.quantity}
              </Text>
              <Text
                style={[S.tableCellMuted, { width: 40, textAlign: "right" }]}
              >
                {li.unit}
              </Text>
              <Text
                style={[
                  S.tableCellMuted,
                  { width: 70, textAlign: "right", fontFamily: "Courier" },
                ]}
              >
                {fmt(li.unit_price)}
              </Text>
              <Text
                style={[
                  S.tableCell,
                  { width: 70, textAlign: "right", fontFamily: "Courier" },
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
                { width: 70, textAlign: "right", fontFamily: "Courier" },
              ]}
            >
              {fmt(quote.subtotal)}
            </Text>
          </View>
        )}

        <View style={S.totalsSection}>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>Subtotal (excl. VAT)</Text>
            <Text style={S.totalValue}>{fmt(quote.subtotal)}</Text>
          </View>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>VAT @ 20%</Text>
            <Text style={S.totalValue}>{fmt(quote.vat_amount)}</Text>
          </View>
          <View style={S.grandTotalRow}>
            <Text style={S.grandTotalLabel}>Total (incl. VAT)</Text>
            <Text style={S.grandTotalValue}>{fmt(quote.total_amount)}</Text>
          </View>
        </View>

        <View style={S.validBox}>
          <Text style={S.validText}>
            This quotation is valid until {fmtDate(quote.valid_until)} and
            subject to our standard terms and conditions.
            {quote.status === "accepted"
              ? " This quotation has been accepted."
              : " To accept, please contact us or sign below."}
          </Text>
        </View>

        {quote.notes && (
          <View style={S.terms}>
            <Text style={S.termsLabel}>Notes & Qualifications</Text>
            <Text style={S.termsText}>{quote.notes}</Text>
          </View>
        )}

        <View style={{ marginTop: 32 }}>
          <Text style={S.termsText}>
            Payment terms: {paymentTerms}. All prices are subject to VAT at the
            prevailing rate.
          </Text>
        </View>

        <View style={S.footer}>
          <Text style={S.footerText}>{companyName}</Text>
          <Text style={S.footerText}>
            {quote.quote_number} · Valid until {fmtDate(quote.valid_until)}
          </Text>
          <Text style={S.footerText}>Page 1</Text>
        </View>
      </Page>
    </Document>
  );
}
