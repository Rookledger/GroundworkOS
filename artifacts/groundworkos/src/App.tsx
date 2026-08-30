import { useEffect, useRef, useState } from "react";
import {
  Switch,
  Route,
  Router as WouterRouter,
  useLocation,
  useSearch,
  Redirect,
  Link,
} from "wouter";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { Toaster } from "sonner";
import { authClient, useSession } from "./lib/authClient";
import { AppProvider } from "./store/AppContext";
import { DataLoader } from "./store/DataLoader";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { JobsPage } from "./pages/JobsPage";
import { QuotesPage } from "./pages/QuotesPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { SchedulePage } from "./pages/SchedulePage";
import { ClientsPage } from "./pages/ClientsPage";
import { SubcontractorsPage } from "./pages/SubcontractorsPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { PlantPage } from "./pages/PlantPage";
import { ReportsPage } from "./pages/ReportsPage";
import { TimesheetsPage } from "./pages/TimesheetsPage";
import { PurchaseOrdersPage } from "./pages/PurchaseOrdersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsersPage } from "./pages/UsersPage";
import { PortalPage } from "./pages/PortalPage";
import { useRole } from "./hooks/useRole";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { ImportPage } from "./pages/ImportPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import NotFound from "./pages/not-found";
import { useApp } from "./store/AppContext";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Clears the React Query cache whenever the signed-in user changes (sign
 * out, sign in as someone else) - replaces ClerkQueryClientCacheInvalidator,
 * which used to watch Clerk's own listener for the same purpose. Better
 * Auth's `useSession()` hook re-renders on session changes, so a plain
 * effect keyed on the session's user id does the same job.
 */
function AuthQueryClientCacheInvalidator() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const userId = session?.user?.id ?? null;
    if (
      prevUserIdRef.current !== undefined &&
      prevUserIdRef.current !== userId
    ) {
      qc.clear();
    }
    prevUserIdRef.current = userId;
  }, [session?.user?.id, qc]);
  return null;
}

// Auto-promotes the very first signed-in user to admin, the moment the app
// loads for them - not just when they happen to open Settings -> Users.
// Mirrors the same GET /api/admin/bootstrap-status call UsersPage.tsx makes;
// see routes/admin.ts on the backend for the actual promotion logic and its
// safety guards (BOOTSTRAP_ADMIN_EMAIL, single-winner race handling). Only
// ever promotes while the workspace has zero admins - a no-op for everyone
// after that first signup.
function AutoAdminBootstrap() {
  const role = useRole();
  const attempted = useRef(false);

  useEffect(() => {
    if (role === "admin" || attempted.current) return;
    attempted.current = true;
    (async () => {
      try {
        const r = await fetch(`${basePath}/api/admin/bootstrap-status`);
        if (!r.ok) return;
        const data = await r.json();
        if (data.justBootstrapped) {
          // Refetch the session so its (now-updated) `role` field is
          // current before reloading - mirrors the old `user.reload()`
          // call this replaces.
          await authClient.getSession({ query: { disableCookieCache: true } });
          window.location.reload();
        }
      } catch {
        // Best-effort - Settings -> Users still offers the manual
        // "Make me admin" fallback if this silently fails.
      }
    })();
  }, [role]);

  return null;
}

const authCardStyle: React.CSSProperties = {
  width: 400,
  maxWidth: "100%",
  backgroundColor: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 32,
  boxShadow: "0 8px 32px rgba(24,20,16,0.08)",
};

const authLabelStyle: React.CSSProperties = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontWeight: 600,
  fontSize: 11,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const authInputStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: 14,
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  backgroundColor: "#ffffff",
  color: "var(--ink)",
  width: "100%",
};

const authButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "10px 20px",
  borderRadius: 6,
  backgroundColor: "var(--accent)",
  color: "#fff",
  fontFamily: "'Space Grotesk', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  border: "none",
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.6 : 1,
  width: "100%",
});

/**
 * Whether POST /setup/first-admin is currently usable - i.e. the workspace
 * has zero users. Shared by SignInPage (to decide whether to show the
 * "Set up GroundworkOS" link at all) and SetupPage (to redirect away, rather
 * than show a form that would only 409 on submit, once someone's already
 * finished setup - e.g. a second browser tab left open from before).
 */
function useSetupOpen() {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${basePath}/api/setup/status`);
        const data = await r.json().catch(() => ({}));
        if (!cancelled) setOpen(r.ok ? !!data.open : false);
      } catch {
        if (!cancelled) setOpen(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return open;
}

function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setupOpen = useSetupOpen();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.message ?? "Failed to sign in");
        return;
      }
      window.location.href = basePath || "/";
    } catch {
      setError("Failed to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <form onSubmit={handleSubmit} style={authCardStyle}>
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 20,
            color: "var(--ink)",
            letterSpacing: "-0.02em",
            marginBottom: 4,
          }}
        >
          Welcome back
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
          Sign in to GroundworkOS
        </p>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={authLabelStyle}>Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={authInputStyle}
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={authLabelStyle}>Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={authInputStyle}
            />
          </div>
          {error && (
            <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>
          )}
          <button type="submit" disabled={loading} style={authButtonStyle(loading)}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>
        <p
          style={{
            marginTop: 20,
            fontSize: 12,
            color: "var(--muted-2)",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          {setupOpen ? (
            <>
              No account yet?{" "}
              <Link to="/setup" style={{ color: "var(--accent)" }}>
                Set up GroundworkOS
              </Link>{" "}
              to create the first (admin) account.
            </>
          ) : (
            <>
              GroundworkOS is invite-only. If you've received an invitation
              email, follow its link to set up your account instead.
            </>
          )}
        </p>
      </form>
    </div>
  );
}

/**
 * The very first account on a brand-new deployment - the one self-service
 * registration surface GroundworkOS has (see routes/admin.ts's
 * GET /setup/status and POST /setup/first-admin on the backend). Only
 * functions while the workspace has zero users; once that first account
 * exists, POST /setup/first-admin starts refusing and this page redirects
 * to /sign-in instead of showing a form that can no longer succeed.
 */
function SetupPage() {
  const setupOpen = useSetupOpen();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await fetch(`${basePath}/api/setup/first-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error ?? "Failed to create account");
        return;
      }
      window.location.href = basePath || "/";
    } catch {
      setError("Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  if (setupOpen === false) {
    return <Redirect to="/sign-in" />;
  }

  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <form onSubmit={handleSubmit} style={authCardStyle}>
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 20,
            color: "var(--ink)",
            letterSpacing: "-0.02em",
            marginBottom: 4,
          }}
        >
          Set up GroundworkOS
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
          Create the first account. It becomes the admin - everyone after
          this signs up by invitation only.
        </p>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={authLabelStyle}>Your name</label>
            <input
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={authInputStyle}
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={authLabelStyle}>Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={authInputStyle}
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={authLabelStyle}>Password</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={authInputStyle}
            />
          </div>
          {error && (
            <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>
          )}
          <button type="submit" disabled={loading} style={authButtonStyle(loading)}>
            {loading ? "Creating account..." : "Create admin account"}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * There is no general public sign-up route any more (see
 * lib/betterAuth.ts's emailAndPassword.disableSignUp) - GroundworkOS is
 * invite-only end to end. This is what the invite email actually links to
 * (`${APP_URL}/accept-invite?token=...` - see routes/admin.ts's
 * POST /admin/invitations): the invitee sets their name/password, the
 * backend creates their account server-side with the role the invitation
 * specified, and they're signed in immediately.
 */
function AcceptInvitePage() {
  // wouter's useLocation() only ever returns the pathname, never the query
  // string (see https://github.com/molefrog/wouter#useLocation) - parsing
  // "?token=..." out of it here always came back empty, so every accept
  // link ever generated failed with "missing its token" for every
  // invitee, no exceptions. useSearch() is wouter's dedicated hook for the
  // query string itself.
  const search = useSearch();
  const token = new URLSearchParams(search).get("token");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const r = await fetch(`${basePath}/api/invitations/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, name: name.trim(), password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error ?? "Failed to accept invitation");
        return;
      }
      window.location.href = basePath || "/";
    } catch {
      setError("Failed to accept invitation");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center px-4"
        style={{ backgroundColor: "var(--bg)" }}
      >
        <div style={authCardStyle}>
          <p style={{ color: "var(--danger)", fontSize: 14 }}>
            This invitation link is missing its token. Ask your admin to
            resend the invitation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <form onSubmit={handleSubmit} style={authCardStyle}>
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 20,
            color: "var(--ink)",
            letterSpacing: "-0.02em",
            marginBottom: 4,
          }}
        >
          Accept your invitation
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
          Set your name and password to finish joining GroundworkOS
        </p>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={authLabelStyle}>Your name</label>
            <input
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={authInputStyle}
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={authLabelStyle}>Password</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={authInputStyle}
            />
          </div>
          {error && (
            <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>
          )}
          <button type="submit" disabled={loading} style={authButtonStyle(loading)}>
            {loading ? "Setting up..." : "Accept and sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ForemanRedirect({ children }: { children: React.ReactNode }) {
  const role = useRole();
  const [location, setLocation] = useLocation();
  // "/settings/users" is allowed for foremen too: UsersPage does its own
  // role gating, and a brand-new deployment has no admin yet, so the first
  // (default-foreman) user must be able to reach it to self-promote.
  const FOREMAN_ALLOWED = [
    "/",
    "/jobs",
    "/schedule",
    "/timesheets",
    "/settings/users",
  ];
  const blocked =
    role === "foreman" &&
    !FOREMAN_ALLOWED.some(
      (p) => location === p || (p !== "/" && location.startsWith(p)),
    );

  // Navigation is a side effect and must not run during render (it triggers a
  // parent state update while this component is still rendering, which React
  // flags and can leave the redirect in an inconsistent state).
  useEffect(() => {
    if (blocked) setLocation("/");
  }, [blocked, setLocation]);

  // Render a visible placeholder instead of null while the redirect effect
  // fires, so blocked routes never show a bare blank/white page.
  if (blocked) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--muted)",
          fontFamily: "'Inter', sans-serif",
          fontSize: 14,
        }}
      >
        Redirecting…
      </div>
    );
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { state } = useApp();
  const [wizardDone, setWizardDone] = useState(() => {
    try {
      return !!localStorage.getItem("gw_onboarding_done");
    } catch {
      return false;
    }
  });

  function completeWizard() {
    try {
      localStorage.setItem("gw_onboarding_done", "1");
    } catch {}
    setWizardDone(true);
  }

  const needsOnboarding =
    state.settingsLoaded &&
    (!state.settings.companyName ||
      state.settings.companyName === "GroundworkOS Ltd") &&
    !wizardDone;

  return (
    <>
      {needsOnboarding && <OnboardingWizard onComplete={completeWizard} />}
      <ForemanRedirect>
        <DashboardLayout>
          <Switch>
            <Route path="/" component={DashboardPage} />
            <Route path="/jobs" component={JobsPage} />
            <Route path="/jobs/:id" component={JobsPage} />
            <Route path="/quotes" component={QuotesPage} />
            <Route path="/invoices" component={InvoicesPage} />
            <Route path="/schedule" component={SchedulePage} />
            <Route path="/clients" component={ClientsPage} />
            <Route path="/subcontractors" component={SubcontractorsPage} />
            <Route path="/documents" component={DocumentsPage} />
            <Route path="/plant" component={PlantPage} />
            <Route path="/timesheets" component={TimesheetsPage} />
            <Route path="/purchase-orders" component={PurchaseOrdersPage} />
            <Route path="/reports" component={ReportsPage} />
            <Route path="/import" component={ImportPage} />
            <Route path="/audit" component={AuditLogPage} />
            {/* "/deploy" (DeployPage) removed from production routing - see
                DashboardLayout.tsx for why. Falls through to NotFound below
                if anything still links to it. */}
            <Route path="/settings" component={SettingsPage} />
            <Route path="/settings/users" component={UsersPage} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </ForemanRedirect>
    </>
  );
}

function AuthenticatedApp() {
  return (
    <AppProvider>
      <AutoAdminBootstrap />
      <DataLoader />
      <AppRoutes />
    </AppProvider>
  );
}

function RouteGuard() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center"
        style={{ backgroundColor: "var(--bg)", color: "var(--muted)" }}
      >
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Redirect to="/sign-in" />;
  }

  return <AuthenticatedApp />;
}

function AppShell() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthQueryClientCacheInvalidator />
      <Toaster position="bottom-right" richColors closeButton />
      <Switch>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/setup" component={SetupPage} />
        <Route path="/accept-invite" component={AcceptInvitePage} />
        <Route path="/portal/:token" component={PortalPage} />
        <Route component={RouteGuard} />
      </Switch>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AppShell />
    </WouterRouter>
  );
}

export default App;
