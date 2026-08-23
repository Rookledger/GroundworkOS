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
  Server,
} from "lucide-react";
import { useAlerts } from "../../hooks/useAlerts";
import { GlobalSearch } from "../ui/GlobalSearch";
import { useUser, useClerk } from "@clerk/react";
import { useRole, isAtLeast, type Role } from "../../hooks/useRole";
import { useApp } from "../../store/AppContext";

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
  {
    name: "Deploy Guide",
    href: "/deploy",
    icon: Server,
    minRole: "admin" as Role,
  },
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
  admin: { label: "Admin", bg: "#fef3c7", color: "#92400e" },
  manager: { label: "Manager", bg: "#e8f3f7", color: "#1b5e78" },
  foreman: { label: "Foreman", bg: "#f0ede8", color: "#7a7469" },
};

const ALERT_ICONS = {
  document: FileWarning,
  invoice: Receipt,
  plant: Wrench,
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
          border: "3px solid #d9d4ce",
          borderTopColor: "#1b5e78",
        }}
      />
      <p
        className="mt-4 text-[11px] font-bold uppercase tracking-widest"
        style={{ color: "#7a7469", fontFamily: "'Space Grotesk', sans-serif" }}
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
  const { user } = useUser();
  const { signOut } = useClerk();
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
    ? (
        (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")
      ).toUpperCase() ||
      user.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
      "G"
    : "G";

  const displayName = user
    ? user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : (user.firstName ?? user.primaryEmailAddress?.emailAddress ?? "User")
    : "Loading…";

  const displayEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const badge = ROLE_BADGE[role];

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const bellCount = alerts.length;

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
      style={{ backgroundColor: "#f0ede8", color: "#181410" }}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ backgroundColor: "rgba(24,20,16,0.4)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-56 flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ backgroundColor: "#fafaf8", borderRight: "1px solid #d9d4ce" }}
      >
        <div
          className="h-13 flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid #d9d4ce" }}
        >
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: "13px",
                color: "#181410",
                letterSpacing: "0.04em",
              }}
            >
              GROUNDWORK<span style={{ color: "#1b5e78" }}>OS</span>
            </span>
          </Link>
          <button
            className="lg:hidden p-1 rounded"
            onClick={() => setSidebarOpen(false)}
            style={{ color: "#7a7469" }}
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
                    borderBottom: "1px solid #ece8e3",
                    margin: "6px 8px",
                  }}
                />
              );
            }
            const Icon = item.icon;
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="relative flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors no-underline mb-0.5"
                style={{
                  backgroundColor: isActive ? "#eeeae4" : "transparent",
                  color: isActive ? "#181410" : "#4a4540",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "#eeeae4";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "transparent";
                }}
              >
                {isActive && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r"
                    style={{
                      width: "3px",
                      height: "16px",
                      backgroundColor: "#1b5e78",
                    }}
                  />
                )}
                <Icon
                  className="w-4 h-4 flex-shrink-0"
                  style={{ opacity: isActive ? 1 : 0.65 }}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-2 py-3" style={{ borderTop: "1px solid #d9d4ce" }}>
          <div className="px-2 py-2 rounded-md">
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  backgroundColor: "#1b5e78",
                  color: "#ffffff",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-xs font-semibold truncate"
                  style={{
                    color: "#181410",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {displayName}
                </p>
                {displayEmail && (
                  <p
                    className="text-[10px] truncate"
                    style={{
                      color: "#7a7469",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {displayEmail}
                  </p>
                )}
              </div>
              <button
                onClick={() => signOut()}
                title="Sign out"
                className="flex-shrink-0 p-1 rounded transition-colors hover:bg-[#e8e4dd]"
                style={{ color: "#a8a099" }}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-2 px-0">
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: 99,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "'Space Grotesk', sans-serif",
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
            backgroundColor: "#fafaf8",
            borderBottom: "1px solid #d9d4ce",
          }}
        >
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded"
              onClick={() => setSidebarOpen(true)}
              style={{ color: "#7a7469" }}
            >
              <Menu className="w-5 h-5" />
            </button>
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: "17px",
                letterSpacing: "-0.01em",
                color: "#181410",
              }}
            >
              {pageTitle}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors"
              style={{
                backgroundColor: "#eeeae4",
                border: "1px solid #d9d4ce",
                color: "#7a7469",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "12px",
              }}
            >
              <Search className="w-3 h-3" />
              <span>Search</span>
              <kbd
                style={{
                  backgroundColor: "#fafaf8",
                  color: "#8a8377",
                  border: "1px solid #d9d4ce",
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
                className="relative p-2 rounded transition-colors hover:bg-[#eeeae4]"
                style={{ color: bellCount > 0 ? "#c13a2a" : "#7a7469" }}
                title={
                  bellCount > 0
                    ? `${bellCount} alert${bellCount !== 1 ? "s" : ""}`
                    : "No alerts"
                }
              >
                <Bell className="w-4 h-4" />
                {bellCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold"
                    style={{
                      backgroundColor:
                        criticalCount > 0 ? "#c13a2a" : "#d87c2a",
                      color: "#ffffff",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    {bellCount > 9 ? "9+" : bellCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-80 rounded-xl overflow-hidden z-50"
                  style={{
                    backgroundColor: "#fafaf8",
                    border: "1px solid #d9d4ce",
                    boxShadow: "0 8px 32px rgba(24,20,16,0.12)",
                  }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: "1px solid #e8e4dd" }}
                  >
                    <span
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 600,
                        fontSize: "13px",
                        color: "#181410",
                      }}
                    >
                      Alerts{" "}
                      {bellCount > 0 && (
                        <span style={{ color: "#c13a2a" }}>({bellCount})</span>
                      )}
                    </span>
                    <button
                      onClick={() => setBellOpen(false)}
                      style={{ color: "#a8a099" }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {alerts.length === 0 ? (
                    <div className="py-8 flex flex-col items-center gap-2">
                      <Bell className="w-5 h-5" style={{ color: "#d9d4ce" }} />
                      <p className="text-sm" style={{ color: "#7a7469" }}>
                        No alerts right now
                      </p>
                    </div>
                  ) : (
                    <div
                      className="max-h-80 overflow-y-auto divide-y"
                      style={{ borderColor: "#e8e4dd" }}
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
                              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{
                                backgroundColor: isCritical
                                  ? "rgba(193,58,42,0.1)"
                                  : "rgba(216,124,42,0.1)",
                              }}
                            >
                              <Icon
                                className="w-3.5 h-3.5"
                                style={{
                                  color: isCritical ? "#c13a2a" : "#d87c2a",
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-xs font-semibold"
                                style={{
                                  color: "#181410",
                                  fontFamily: "'Space Grotesk', sans-serif",
                                }}
                              >
                                {alert.title}
                              </p>
                              <p
                                className="text-[11px] mt-0.5"
                                style={{ color: "#7a7469" }}
                              >
                                {alert.detail}
                              </p>
                            </div>
                            {isCritical && (
                              <AlertTriangle
                                className="w-3 h-3 flex-shrink-0 mt-1"
                                style={{ color: "#c13a2a" }}
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
    </div>
  );
}
