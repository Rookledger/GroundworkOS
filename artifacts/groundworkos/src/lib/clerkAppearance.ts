import { shadcn } from "@clerk/themes";

// Shared brand theming for every Clerk-rendered surface (sign-in/sign-up
// pages in App.tsx, and the account/security modal opened from
// DashboardLayout.tsx) so they all look consistent with the rest of the app.
export const clerkAppearance = {
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
