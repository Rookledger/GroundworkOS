import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "../../lib/utils";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Receipt,
  Calendar,
  Users,
  HardHat,
  FolderOpen,
  BarChart3,
  Settings,
  Menu,
  Bell,
  X,
  Truck,
  Search,
  LogOut,
  Clock,
  ShoppingCart,
  Upload,
  ScrollText,
  FileWarning,
  AlertTriangle,
  Wrench,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
import { useAlerts } from "../../hooks/useAlerts";
import { GlobalSearch } from "../ui/GlobalSearch";
import { authClient, useSession } from "../../lib/authClient";
import { useRole, isAtLeast, type Role } from "../../hooks/useRole";
import { useApp } from "../../store/AppContext";
import { AccountModal } from "./AccountModal";

const ALL_NAV = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    minRole: "foreman" as Role,
  },
  { gap: true },
  { name: "Jobs", href: "/jobs", icon: Briefcase, minRole: "foreman" as Role },
  {
    name: "Schedule",
    href: "/schedule",
    icon: Calendar,
    minRole: "foreman" as Role,
  },
  {
    name: "Quotes",
    href: "/quotes",
    icon: FileText,
    minRole: "manager" as Role,
  },
  {
    name: "Invoices",
    href: "/invoices",
    icon: Receipt,
    minRole: "manager" as Role,
  },
  { gap: true },
  {
    name: "Clients",
    href: "/clients",
    icon: Users,
    minRole: "manager" as Role,
  },
  {
    name: "Subcontractors",
    href: "/subcontractors",
    icon: HardHat,
    minRole: "manager" as Role,
  },
  {
    name: "Documents",
    href: "/documents",
    icon: FolderOpen,
    minRole: "manager" as Role,
  },
  {
    name: "RAMS",
    href: "/rams",
    icon: ShieldAlert,
    minRole: "foreman" as Role,
  },
  { name: "Plant", href: "/plant", icon: Truck, minRole: "manager" as Role },
  {
    name: "Timesheets",
    href: "/timesheets",
    icon: Clock,
    minRole: "foreman" as Role,
  },
  {
    name: "Purchase Orders",
    href: "/purchase-orders",
    icon: ShoppingCart,
    minRole: "manager" as Role,
  },
  { gap: true },
  {
    name: "Reports",
    href: "/reports",
    icon: BarChart3,
    minRole: "manager" as Role,
  },
  { name: "Import", href: "/import", icon: Upload, minRole: "manager" as Role },
  {
    name: "Audit Log",
    href: "/audit",
    icon: ScrollText,
    minRole: "admin" as Role,
  },
  // "Deploy Guide" (formerly here, href: "/deploy") has been removed from
  // production navigation - it was an internal ops runbook (server
  // provisioning steps, an "Environment & Secrets" tab listing every
  // production env var name) that had no business being reachable from a
  // live customer-facing app just because the viewer holds the "admin"
  // role. Keep deployment docs in the repo (see DEPLOYMENT.md) or an
  // internal wiki instead of shipping them inside the product.
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    minRole: "manager" as Role,
  },
  {
    name: "Users",
    href: "/settings/users",
    icon: Users,
    minRole: "admin" as Role,
  },
];

const ROLE_BADGE: Record<Role, { label: string; bg: string; color: string }> = {
  admin: { label: "Admin", bg: "#f0a11e", color: "#1d2d3d" },
  manager: { label: "Manager", bg: "rgba(89,128,166,0.18)", color: "#8fb0cc" },
  foreman: { label: "Foreman", bg: "rgba(255,255,255,0.12)", color: "#c7ced5" },
};

const ALERT_ICONS = {
  document: FileWarning,
  invoice: Receipt,
  plant: Wrench,
  rams: ShieldAlert,
};

function InitialLoadingState() {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ minHeight: "50vh" }}
    >
      <div
        className="w-8 h-8 rounded-full animate-spin"
        style={{
          border: "3px solid var(--border)",
          borderTopColor: "var(--accent)",
        }}
      />
      <p
        className="mt-4 text-[11px] font-bold uppercase tracking-widest"
        style={{ color: "var(--muted)", fontFamily: "var(--font-heading)" }}
      >
        Loading workspace…
      </p>
    </div>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { state } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();
  const { data: session } = useSession();
  const user = session?.user;
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const role = useRole();
  const alerts = useAlerts();

  // Close bell on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    if (bellOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [bellOpen]);

  const navigation = ALL_NAV.filter((item) => {
    if ("gap" in item) {
      return true; // gaps filtered below if adjacent
    }
    return isAtLeast(role, item.minRole);
  }).filter((item, i, arr) => {
    if (!("gap" in item)) return true;
    const next = arr[i + 1];
    if (!next || "gap" in next) return false;
    return true;
  });

  const currentItem = navigation.find(
    (item) =>
      "href" in item &&
      typeof item.href === "string" &&
      (location === item.href ||
        (item.href !== "/" && location.startsWith(item.href))),
  );
  const pageTitle =
    currentItem && "name" in currentItem ? currentItem.name : "Dashboard";

  const initials = user
    ? (user.name?.[0] ?? user.email?.[0] ?? "G").toUpperCase()
    : "G";

  const displayName = user ? (user.name || user.email || "User") : "Loading…";

  const displayEmail = user?.email ?? "";
  const badge = ROLE_BADGE[role];

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const bellCount = alerts.length;

  const invoicesOverdueCount = state.invoices.filter(
    (i) => i.status === "overdue",
  ).length;
  const documentsAlertCount = alerts.filter(
    (a) => a.category === "document",
  ).length;
  const plantAlertCount = alerts.filter((a) => a.category === "plant").length;
  const ramsAlertCount = alerts.filter((a) => a.category === "rams").length;
  const subsUnverifiedCount = state.subcontractors.filter(
    (s) => s.cis_status === "unverified" || s.cis_status === "unmatched",
  ).length;

  const NAV_BADGES: Record<string, { count: number; color: string } | undefined> = {
    "/invoices": { count: invoicesOverdueCount, color: "#b23a26" },
    "/documents": { count: documentsAlertCount, color: "#b8730c" },
    "/plant": { count: plantAlertCount, color: "#b23a26" },
    "/rams": { count: ramsAlertCount, color: "#b8730c" },
    "/subcontractors": { count: subsUnverifiedCount, color: "#b8730c" },
  };

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div
      className="min-h-screen flex"
      style={{ backgroundColor: "var(--bg)", color: "var(--ink)" }}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ backgroundColor: "rgba(29,45,61,0.5)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-56 flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ backgroundColor: "#1d2d3d", color: "#e9edf1" }}
      >
        <div
          className="h-13 flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,.14)" }}
        >
          <Link href="/" className="flex items-center gap-2.5 no-underline min-w-0">
            {state.settings.companyLogo ? (
              <img
                src={state.settings.companyLogo}
                alt={state.settings.companyName || "Company logo"}
                className="h-7 max-w-[9rem] object-contain flex-shrink-0"
              />
            ) : (
              <>
                <span
                  className="flex-shrink-0"
                  style={{
                    width: 22,
                    height: 22,
                    background:
                      "repeating-linear-gradient(135deg,#f0a11e 0 4px,#1d2d3d 4px 8px)",
                    border: "1px solid rgba(255,255,255,.35)",
                  }}
                />
                <span
                  className="truncate"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: "15px",
                    color: "#fff",
                    letterSpacing: "0.02em",
                  }}
                >
                  {state.settings.companyName &&
                  state.settings.companyName !== "GroundworkOS Ltd" ? (
                    state.settings.companyName
                  ) : (
                    <>
                      GROUNDWORK<span style={{ color: "#f0a11e" }}>OS</span>
                    </>
                  )}
                </span>
              </>
            )}
          </Link>
          <button
            className="lg:hidden p-1"
            onClick={() => setSidebarOpen(false)}
            style={{ color: "rgba(233,237,241,.7)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {navigation.map((item, index) => {
            if ("gap" in item) {
              return (
                <div
                  key={`g-${index}`}
                  className="my-1"
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,.1)",
                    margin: "6px 8px",
                  }}
                />
              );
            }
            const Icon = item.icon;
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            const navBadge = NAV_BADGES[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="relative flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors no-underline mb-0.5"
                style={{
                  backgroundColor: isActive ? "rgba(89,128,166,0.22)" : "transparent",
                  color: isActive ? "#ffffff" : "rgba(233,237,241,.75)",
                  fontFamily: "var(--font-heading)",
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "rgba(255,255,255,.06)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "transparent";
                }}
              >
                {isActive && (
                  <div
                    className="absolute left-0 top-0 bottom-0"
                    style={{
                      width: "3px",
                      backgroundColor: "#f0a11e",
                    }}
                  />
                )}
                <Icon
                  className="w-4 h-4 flex-shrink-0"
                  strokeWidth={1.5}
                  style={{ opacity: isActive ? 1 : 0.7 }}
                />
                <span>{item.name}</span>
                {navBadge && navBadge.count > 0 && (
                  <span
                    className="ml-auto flex-shrink-0 text-[11px] font-bold px-1.5"
                    style={{
                      backgroundColor: navBadge.color,
                      color: "#fff",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {navBadge.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-2 py-3" style={{ borderTop: "1px solid rgba(255,255,255,.14)" }}>
          <div className="px-2 py-2">
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  backgroundColor: "#f0a11e",
                  color: "#1d2d3d",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-xs font-semibold truncate"
                  style={{
                    color: "#fff",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {displayName}
                </p>
                {displayEmail && (
                  <p
                    className="text-[10px] truncate"
                    style={{
                      color: "rgba(233,237,241,.55)",
                    }}
                  >
                    {displayEmail}
                  </p>
                )}
              </div>
              <button
                onClick={() => setAccountModalOpen(true)}
                title="Account / change password"
                className="flex-shrink-0 p-1 transition-colors hover:bg-[rgba(255,255,255,.1)]"
                style={{ color: "rgba(233,237,241,.55)" }}
              >
                <KeyRound className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() =>
                  authClient.signOut({
                    fetchOptions: {
                      onSuccess: () => window.location.reload(),
                    },
                  })
                }
                title="Sign out"
                className="flex-shrink-0 p-1 transition-colors hover:bg-[rgba(255,255,255,.1)]"
                style={{ color: "rgba(233,237,241,.55)" }}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-2 px-0">
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "var(--font-heading)",
                  backgroundColor: badge.bg,
                  color: badge.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {badge.label}
              </span>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header
          className="h-14 flex items-center justify-between px-4 sm:px-6 flex-shrink-0"
          style={{
            backgroundColor: "var(--surface)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2"
              onClick={() => setSidebarOpen(true)}
              style={{ color: "var(--muted)" }}
            >
              <Menu className="w-5 h-5" />
            </button>
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: "17px",
                letterSpacing: "-0.01em",
                color: "var(--ink)",
              }}
            >
              {pageTitle}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
              style={{
                backgroundColor: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
                fontFamily: "var(--font-body)",
                fontSize: "12px",
              }}
            >
              <Search className="w-3 h-3" />
              <span>Search</span>
              <kbd
                style={{
                  backgroundColor: "var(--surface)",
                  color: "var(--muted-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "3px",
                  padding: "1px 5px",
                  fontSize: "10px",
                  fontFamily: "inherit",
                }}
              >
                ⌘K
              </kbd>
            </button>

            {/* Bell / alerts */}
            <div ref={bellRef} className="relative">
              <button
                onClick={() => setBellOpen((o) => !o)}
                className="relative p-2 transition-colors hover:bg-[var(--surface-2)]"
                style={{ color: bellCount > 0 ? "var(--danger)" : "var(--muted)" }}
                title={
                  bellCount > 0
                    ? `${bellCount} alert${bellCount !== 1 ? "s" : ""}`
                    : "No alerts"
                }
              >
                <Bell className="w-4 h-4" />
                {bellCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold"
                    style={{
                      backgroundColor:
                        criticalCount > 0 ? "var(--danger)" : "#d87c2a",
                      color: "#ffffff",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {bellCount > 9 ? "9+" : bellCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-80 overflow-hidden z-50"
                  style={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                    boxShadow: "0 8px 32px rgba(29,45,61,0.16)",
                  }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: "1px solid var(--surface-3)" }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 600,
                        fontSize: "13px",
                        color: "var(--ink)",
                      }}
                    >
                      Alerts{" "}
                      {bellCount > 0 && (
                        <span style={{ color: "var(--danger)" }}>({bellCount})</span>
                      )}
                    </span>
                    <button
                      onClick={() => setBellOpen(false)}
                      style={{ color: "var(--muted-2)" }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {alerts.length === 0 ? (
                    <div className="py-8 flex flex-col items-center gap-2">
                      <Bell className="w-5 h-5" style={{ color: "var(--border)" }} />
                      <p className="text-sm" style={{ color: "var(--muted)" }}>
                        No alerts right now
                      </p>
                    </div>
                  ) : (
                    <div
                      className="max-h-80 overflow-y-auto divide-y"
                      style={{ borderColor: "var(--surface-3)" }}
                    >
                      {alerts.map((alert) => {
                        const Icon = ALERT_ICONS[alert.category];
                        const isCritical = alert.severity === "critical";
                        return (
                          <Link
                            key={alert.id}
                            href={alert.href}
                            onClick={() => setBellOpen(false)}
                            className="flex items-start gap-3 px-4 py-3 no-underline transition-colors hover:bg-[#f5f2ee]"
                          >
                            <div
                              className="w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{
                                backgroundColor: isCritical
                                  ? "rgba(178,58,38,0.1)"
                                  : "rgba(216,124,42,0.1)",
                              }}
                            >
                              <Icon
                                className="w-3.5 h-3.5"
                                style={{
                                  color: isCritical ? "var(--danger)" : "#d87c2a",
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-xs font-semibold"
                                style={{
                                  color: "var(--ink)",
                                  fontFamily: "var(--font-heading)",
                                }}
                              >
                                {alert.title}
                              </p>
                              <p
                                className="text-[11px] mt-0.5"
                                style={{ color: "var(--muted)" }}
                              >
                                {alert.detail}
                              </p>
                            </div>
                            {isCritical && (
                              <AlertTriangle
                                className="w-3 h-3 flex-shrink-0 mt-1"
                                style={{ color: "var(--danger)" }}
                              />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {state.isLoading ? <InitialLoadingState /> : children}
        </main>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <AccountModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        name={displayName}
        email={displayEmail}
      />
    </div>
  );
}
