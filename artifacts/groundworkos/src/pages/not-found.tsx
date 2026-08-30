import { Link, useLocation } from "wouter";
import { Compass, ArrowLeft, Search } from "lucide-react";
import { CornerMarks } from "../components/ui/Blueprint";
import { Btn } from "../components/ui/Btn";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div
      className="flex items-center justify-center px-6"
      style={{ minHeight: "60vh" }}
    >
      <div className="text-center max-w-sm w-full flex flex-col items-center">
        <div
          className="blueprint relative flex items-center justify-center"
          style={{
            width: 120,
            height: 120,
            backgroundColor: "var(--accent-bg)",
            marginBottom: 24,
          }}
        >
          <CornerMarks />
          <span
            className="tnum"
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: 44,
              letterSpacing: "-0.02em",
              color: "var(--accent)",
              lineHeight: 1,
            }}
          >
            404
          </span>
        </div>

        <div
          className="flex items-center gap-2 mb-3"
          style={{ color: "var(--muted-2)" }}
        >
          <Compass className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Off the map
          </span>
        </div>

        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 20,
            color: "var(--ink)",
            marginBottom: 8,
          }}
        >
          This page doesn't exist
        </h1>

        <p
          className="text-sm"
          style={{
            color: "var(--muted)",
            lineHeight: 1.6,
            marginBottom: 28,
          }}
        >
          Check the address, or you don't have access to it — head back to
          the dashboard or search your jobs instead.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <Link href="/">
            <Btn variant="primary" className="w-full sm:w-auto justify-center">
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              Back to dashboard
            </Btn>
          </Link>
          <Btn
            variant="outline"
            className="w-full sm:w-auto justify-center"
            onClick={() => navigate("/jobs")}
          >
            <Search className="w-3.5 h-3.5" strokeWidth={1.5} />
            Search jobs
          </Btn>
        </div>
      </div>
    </div>
  );
}
