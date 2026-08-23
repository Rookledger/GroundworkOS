import { useEffect, useRef, useState } from "react";
import {
  Switch,
  Route,
  Router as WouterRouter,
  useLocation,
  Redirect,
} from "wouter";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Toaster } from "sonner";
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
import { DeployPage } from "./pages/DeployPage";
import { useApp } from "./store/AppContext";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "#1b5e78",
    colorForeground: "#181410",
    colorMutedForeground: "#7a7469",
    colorDanger: "#c13a2a",
    colorBackground: "#fafaf8",
    colorInput: "#ffffff",
    colorInputForeground: "#181410",
    colorNeutral: "#d9d4ce",
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    borderRadius: "6px",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-[#fafaf8] rounded-xl w-[440px] max-w-full overflow-hidden shadow-xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: {
      color: "#181410",
      fontWeight: "700",
      fontFamily: "'Space Grotesk', sans-serif",
      letterSpacing: "-0.02em",
    },
    headerSubtitle: { color: "#7a7469", fontSize: "14px" },
    formFieldLabel: {
      color: "#4a4540",
      fontWeight: "600",
      fontSize: "11px",
      textTransform: "uppercase" as const,
      letterSpacing: "0.06em",
    },
    footerActionLink: { color: "#1b5e78", fontWeight: "600" },
    footerActionText: { color: "#7a7469" },
    dividerText: { color: "#a8a099", fontSize: "12px" },
    identityPreviewEditButton: { color: "#1b5e78" },
    formFieldSuccessText: { color: "#2a6e45" },
    alertText: { color: "#c13a2a" },
    logoBox: "hidden",
    formButtonPrimary: {
      backgroundColor: "#1b5e78",
      color: "#ffffff",
      fontFamily: "'Space Grotesk', sans-serif",
      fontWeight: "600",
      borderRadius: "6px",
    },
    formFieldInput: {
      border: "1px solid #d9d4ce",
      backgroundColor: "#ffffff",
      color: "#181410",
      borderRadius: "6px",
    },
    footerAction: {
      backgroundColor: "#eeeae4",
      borderTop: "1px solid #d9d4ce",
    },
    dividerLine: { backgroundColor: "#e0dbd5" },
    alert: {
      border: "1px solid rgba(193,58,42,0.2)",
      backgroundColor: "rgba(193,58,42,0.05)",
      borderRadius: "6px",
    },
    otpCodeFieldInput: { border: "1px solid #d9d4ce", borderRadius: "6px" },
    formFieldRow: {},
    main: {},
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);
  return null;
}

function SignInPage() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4"
      style={{ backgroundColor: "#f0ede8" }}
    >
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4"
      style={{ backgroundColor: "#f0ede8" }}
    >
      <p
        style={{
          maxWidth: 440,
          textAlign: "center",
          fontSize: 13,
          color: "#7a7469",
          fontFamily: "'Inter', sans-serif",
          lineHeight: 1.6,
        }}
      >
        GroundworkOS is invite-only. If you've received an invitation email, use
        the same email address below to finish setting up your account.
        Otherwise, ask your admin to invite you from Settings &rarr; Users.
      </p>
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
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
          color: "#7a7469",
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
            <Route path="/deploy" component={DeployPage} />
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
      <DataLoader />
      <AppRoutes />
    </AppProvider>
  );
}

function RouteGuard() {
  return (
    <>
      <Show when="signed-in">
        <AuthenticatedApp />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: { title: "Welcome back", subtitle: "Sign in to GroundworkOS" },
        },
        signUp: {
          start: {
            title: "Create account",
            subtitle: "Join GroundworkOS today",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Toaster position="bottom-right" richColors closeButton />
        <Switch>
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/portal/:token" component={PortalPage} />
          <Route component={RouteGuard} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
