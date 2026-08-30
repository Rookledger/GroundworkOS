import { cn } from "../../lib/utils";
import type {
  JobStatus,
  QuoteStatus,
  InvoiceStatus,
  DocumentStatus,
  CISStatus,
  PlantStatus,
} from "../../types";

type BadgeStatus =
  | JobStatus
  | QuoteStatus
  | InvoiceStatus
  | DocumentStatus
  | CISStatus
  | PlantStatus
  | string;

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  enquiry: { label: "Enquiry", color: "#5980a6", bg: "rgba(89,128,166,0.12)" },
  quoted: { label: "Quoted", color: "#5d5d60", bg: "rgba(93,93,96,0.1)" },
  active: { label: "Active", color: "#2a6e45", bg: "rgba(42,110,69,0.1)" },
  on_hold: { label: "On Hold", color: "#b8730c", bg: "rgba(184,115,12,0.12)" },
  complete: { label: "Complete", color: "#5d5d60", bg: "rgba(93,93,96,0.08)" },
  cancelled: {
    label: "Cancelled",
    color: "#b23a26",
    bg: "rgba(178,58,38,0.1)",
  },
  draft: { label: "Draft", color: "#5d5d60", bg: "rgba(93,93,96,0.08)" },
  sent: { label: "Sent", color: "#5d5d60", bg: "rgba(93,93,96,0.1)" },
  accepted: { label: "Accepted", color: "#2a6e45", bg: "rgba(42,110,69,0.1)" },
  declined: { label: "Declined", color: "#b23a26", bg: "rgba(178,58,38,0.1)" },
  expired: { label: "Expired", color: "#b23a26", bg: "rgba(178,58,38,0.1)" },
  paid: { label: "Paid", color: "#2a6e45", bg: "rgba(42,110,69,0.1)" },
  overdue: { label: "Overdue", color: "#b23a26", bg: "rgba(178,58,38,0.1)" },
  credited: { label: "Credited", color: "#5d5d60", bg: "rgba(93,93,96,0.08)" },
  valid: { label: "Valid", color: "#2a6e45", bg: "rgba(42,110,69,0.1)" },
  expiring_soon: {
    label: "Expiring",
    color: "#b8730c",
    bg: "rgba(184,115,12,0.12)",
  },
  pending: { label: "Pending", color: "#5d5d60", bg: "rgba(93,93,96,0.08)" },
  gross: { label: "Gross", color: "#2a6e45", bg: "rgba(42,110,69,0.1)" },
  net: { label: "Net 20%", color: "#5d5d60", bg: "rgba(93,93,96,0.1)" },
  unmatched: {
    label: "Unmatched",
    color: "#b8730c",
    bg: "rgba(184,115,12,0.12)",
  },
  unverified: {
    label: "Unverified",
    color: "#b23a26",
    bg: "rgba(178,58,38,0.1)",
  },
  available: {
    label: "Available",
    color: "#2a6e45",
    bg: "rgba(42,110,69,0.1)",
  },
  on_site: { label: "On Site", color: "#5980a6", bg: "rgba(89,128,166,0.12)" },
  maintenance: {
    label: "Workshop",
    color: "#b8730c",
    bg: "rgba(184,115,12,0.12)",
  },
  hired_in: { label: "Hired In", color: "#5980a6", bg: "rgba(89,128,166,0.12)" },
  disposed: { label: "Disposed", color: "#5d5d60", bg: "rgba(93,93,96,0.08)" },
};

interface BadgeProps {
  status: BadgeStatus;
  className?: string;
}

export function Badge({ status, className }: BadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    color: "#5d5d60",
    bg: "rgba(93,93,96,0.08)",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-semibold uppercase",
        className,
      )}
      style={{
        color: config.color,
        backgroundColor: config.bg,
        fontFamily: "var(--font-heading)",
        letterSpacing: "0.05em",
        borderRadius: 0,
      }}
    >
      {config.label}
    </span>
  );
}
