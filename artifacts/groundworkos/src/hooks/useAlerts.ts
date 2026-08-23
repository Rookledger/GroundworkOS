import { useMemo } from "react";
import { useApp } from "../store/AppContext";

export type AlertSeverity = "critical" | "warning" | "info";

export interface AppAlert {
  id: string;
  severity: AlertSeverity;
  category: "document" | "invoice" | "plant";
  title: string;
  detail: string;
  href: string;
}

function daysUntil(dateStr: string | null | undefined): number {
  if (!dateStr) return Infinity;
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function daysAgo(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000),
  );
}

export function useAlerts(): AppAlert[] {
  const { state } = useApp();
  const { documents, invoices, plant } = state;

  return useMemo(() => {
    const alerts: AppAlert[] = [];

    // Documents expiring
    for (const doc of documents) {
      const days = daysUntil(doc.expiry_date);
      if (days <= 0) {
        alerts.push({
          id: `doc-exp-${doc.id}`,
          severity: "critical",
          category: "document",
          title: `${doc.name} expired`,
          detail: `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} ago`,
          href: "/documents",
        });
      } else if (days <= 14) {
        alerts.push({
          id: `doc-exp-${doc.id}`,
          severity: "critical",
          category: "document",
          title: `${doc.name} expires soon`,
          detail: `Expires in ${days} day${days !== 1 ? "s" : ""}`,
          href: "/documents",
        });
      } else if (days <= 30) {
        alerts.push({
          id: `doc-exp-${doc.id}`,
          severity: "warning",
          category: "document",
          title: `${doc.name} expiring`,
          detail: `Expires in ${days} days`,
          href: "/documents",
        });
      }
    }

    // Overdue invoices
    for (const inv of invoices) {
      if (
        inv.status === "overdue" ||
        (inv.status === "sent" && inv.due_date && daysAgo(inv.due_date) > 0)
      ) {
        const overdueDays = daysAgo(inv.due_date ?? undefined);
        alerts.push({
          id: `inv-overdue-${inv.id}`,
          severity: overdueDays > 30 ? "critical" : "warning",
          category: "invoice",
          title: `${inv.invoice_number} overdue`,
          detail: `${overdueDays} day${overdueDays !== 1 ? "s" : ""} overdue · £${inv.total_amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`,
          href: "/invoices",
        });
      }
    }

    // Plant service / MOT / thorough exam due
    for (const p of plant) {
      const checks = [
        { key: "svc", date: p.service_due, label: "service" },
        { key: "mot", date: p.mot_due, label: "MOT" },
        { key: "loler", date: p.thorough_exam_due, label: "LOLER exam" },
      ];
      for (const { key, date, label } of checks) {
        if (!date) continue;
        const days = daysUntil(date);
        if (days <= 0) {
          alerts.push({
            id: `plant-${key}-${p.id}`,
            severity: "critical",
            category: "plant",
            title: `${p.name} ${label} overdue`,
            detail: `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""}`,
            href: "/plant",
          });
        } else if (days <= 14) {
          alerts.push({
            id: `plant-${key}-${p.id}`,
            severity: "warning",
            category: "plant",
            title: `${p.name} ${label} due`,
            detail: `Due in ${days} day${days !== 1 ? "s" : ""}`,
            href: "/plant",
          });
        }
      }
    }

    // Sort: critical first, then by category
    return alerts.sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return sev[a.severity] - sev[b.severity];
    });
  }, [documents, invoices, plant]);
}
