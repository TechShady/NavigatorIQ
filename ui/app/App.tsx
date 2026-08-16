import React from "react";
import { Route, Routes } from "react-router-dom";
import { DisclaimerModal } from "./components/DisclaimerModal";
import { NavigatorIQ } from "./pages/NavigatorIQ";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: unknown) {
    const msg = (error as { message?: string })?.message ?? String(error);
    if (msg.includes("QUERY_GONE") || msg.includes("query ID is not available") || msg.includes("410")) {
      setTimeout(() => this.setState({ hasError: false }), 100);
      return;
    }
    console.error("[NavigatorIQ ErrorBoundary]", error);
  }
  render() {
    if (this.state.hasError) {
      setTimeout(() => window.location.reload(), 1500);
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
