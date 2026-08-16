import React from "react";
import ReactDOM from "react-dom/client";
import { AppRoot } from "@dynatrace/strato-components/core";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";

const isQueryGone = (msg: string) =>
  msg.includes("QUERY_GONE") || msg.includes("query ID is not available") || msg.includes("410");

window.addEventListener("unhandledrejection", (e) => {
  const msg = e.reason?.message || e.reason?.toString?.() || "";
  if (isQueryGone(msg)) { e.preventDefault(); }
});
window.addEventListener("error", (e) => {
  if (isQueryGone(e.message || "")) { e.preventDefault(); return true; }
});

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <AppRoot>
    <BrowserRouter basename="ui">
      <App />
    </BrowserRouter>
  </AppRoot>
);
