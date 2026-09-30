import React from "react";
import { Route, Routes } from "react-router-dom";
import { DisclaimerModal } from "./components/DisclaimerModal";
import { NavigatorIQ } from "./pages/NavigatorIQ";

const CRASH_COUNT_KEY = "iq-crash-count";
const CRASH_TS_KEY = "iq-crash-ts";

function getCrashCount(): number {
  try {
    const ts = parseInt(sessionStorage.getItem(CRASH_TS_KEY) ?? "0");
    if (Date.now() - ts > 30000) { sessionStorage.removeItem(CRASH_COUNT_KEY); return 0; }
    return parseInt(sessionStorage.getItem(CRASH_COUNT_KEY) ?? "0");
  } catch { return 0; }
}
function incrementCrashCount(): number {
  try {
    const n = getCrashCount() + 1;
    sessionStorage.setItem(CRASH_COUNT_KEY, String(n));
    sessionStorage.setItem(CRASH_TS_KEY, String(Date.now()));
    return n;
  } catch { return 99; }
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; fatal: boolean; lastErr: string }> {
  state = { hasError: false, fatal: false, lastErr: "" };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: unknown) {
    const msg = (error as { message?: string })?.message ?? String(error);
    if (msg.includes("QUERY_GONE") || msg.includes("query ID is not available") || msg.includes("410")) {
      setTimeout(() => this.setState({ hasError: false }), 100);
      return;
    }
    console.error("[NavigatorIQ ErrorBoundary]", error);
    try { sessionStorage.setItem("iq-last-error", msg); } catch { /* noop */ }
    const n = incrementCrashCount();
    if (n >= 3) {
      this.setState({ fatal: true, lastErr: msg });
    } else {
      setTimeout(() => window.location.reload(), 1500);
    }
  }
  render() {
    if (this.state.fatal) {
      const errMsg = this.state.lastErr || (() => { try { return sessionStorage.getItem("iq-last-error") ?? ""; } catch { return ""; } })();
      return (
        <div style={{ padding: 40, textAlign: "center", color: "#fff", background: "#090c16", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
          <h2 style={{ color: "#FF073A" }}>NavigatorIQ failed to load</h2>
          <p style={{ color: "rgba(255,255,255,0.6)", maxWidth: 440 }}>An error occurred during startup. Try clearing your browser cache or contact the app owner.</p>
          {errMsg && <code style={{ fontSize: 11, color: "rgba(255,100,100,0.8)", background: "rgba(255,0,0,0.08)", border: "1px solid rgba(255,0,0,0.2)", borderRadius: 6, padding: "6px 10px", maxWidth: 500, wordBreak: "break-all", textAlign: "left" }}>{errMsg}</code>}
          <button onClick={() => { sessionStorage.clear(); window.location.reload(); }} style={{ marginTop: 8, padding: "10px 24px", background: "#4589FF", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, cursor: "pointer" }}>Clear cache &amp; retry</button>
        </div>
      );
    }
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center", color: "#fff", background: "#090c16", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <h2>Refreshing…</h2>
          <p>Reconnecting to data source. Please wait.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export const App = () => {
  return (
    <ErrorBoundary>
      <DisclaimerModal />
      <Routes>
        <Route path="/" element={<NavigatorIQ />} />
      </Routes>
    </ErrorBoundary>
  );
};
