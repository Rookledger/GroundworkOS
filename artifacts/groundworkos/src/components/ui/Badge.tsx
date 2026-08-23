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
  enquiry: { label: "Enquiry", color: "#1b5e78", bg: "rgba(27,94,120,0.1)" },
  quoted: { label: "Quoted", color: "#5a544f", bg: "rgba(90,84,79,0.1)" },
  active: { label: "Active", color: "#2a6e45", bg: "rgba(42,110,69,0.1)" },
  on_hold: { label: "On Hold", color: "#b56918", bg: "rgba(181,105,24,0.1)" },
  complete: { label: "Complete", color: "#4a4540", bg: "rgba(74,69,64,0.08)" },
  cancelled: {
    label: "Cancelled",
    color: "#c13a2a",
    bg: "rgba(193,58,42,0.08)",
  },
  draft: { label: "Draft", color: "#7a7469", bg: "rgba(90,84,79,0.08)" },
  sent: { label: "Sent", color: "#5a544f", bg: "rgba(90,84,79,0.1)" },
  accepted: { label: "Accepted", color: "#2a6e45", bg: "rgba(42,110,69,0.1)" },
  declined: { label: "Declined", color: "#c13a2a", bg: "rgba(193,58,42,0.08)" },
  expired: { label: "Expired", color: "#c13a2a", bg: "rgba(193,58,42,0.08)" },
  paid: { label: "Paid", color: "#2a6e45", bg: "rgba(42,110,69,0.1)" },
  overdue: { label: "Overdue", color: "#c13a2a", bg: "rgba(193,58,42,0.08)" },
  credited: { label: "Credited", color: "#4a4540", bg: "rgba(74,69,64,0.08)" },
  valid: { label: "Valid", color: "#2a6e45", bg: "rgba(42,110,69,0.1)" },
  expiring_soon: {
    label: "Expiring",
    color: "#b56918",
    bg: "rgba(181,105,24,0.1)",
  },
  pending: { label: "Pending", color: "#7a7469", bg: "rgba(90,84,79,0.08)" },
  gross: { label: "Gross", color: "#2a6e45", bg: "rgba(42,110,69,0.1)" },
  net: { label: "Net 20%", color: "#5a544f", bg: "rgba(90,84,79,0.1)" },
  unmatched: {
    label: "Unmatched",
    color: "#b56918",
    bg: "rgba(181,105,24,0.1)",
  },
  unverified: {
    label: "Unverified",
    color: "#c13a2a",
    bg: "rgba(193,58,42,0.08)",
  },
  available: {
    label: "Available",
    color: "#2a6e45",
    bg: "rgba(42,110,69,0.1)",
  },
  on_site: { label: "On Site", color: "#1b5e78", bg: "rgba(27,94,120,0.1)" },
  maintenance: {
    label: "Workshop",
    color: "#b56918",
    bg: "rgba(181,105,24,0.1)",
  },
  hired_in: { label: "Hired In", color: "#1b5e78", bg: "rgba(27,94,120,0.1)" },
  disposed: { label: "Disposed", color: "#4a4540", bg: "rgba(74,69,64,0.08)" },
};

interface BadgeProps {
  status: BadgeStatus;
  className?: string;
}

export function Badge({ status, className }: BadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    color: "#4a4540",
    bg: "rgba(74,69,64,0.08)",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase",
        className,
      )}
      style={{
        color: config.color,
        backgroundColor: config.bg,
        fontFamily: "'Space Grotesk', sans-serif",
        letterSpacing: "0.05em",
      }}
    >
      {config.label}
    </span>
  );
}
