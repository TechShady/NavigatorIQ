import React, { useState, useEffect, useRef } from "react";
import { publicClient as davisCopilotClient } from "@dynatrace-sdk/client-davis-copilot";
import { AIAssistPanel, ensureStyles } from "./AIAssist";
import type { AIAssistData } from "./AIAssist";
import type { Assessment, AllQueryResults } from "../types";

// ── Spinner CSS (injected once) ───────────────────────────────────────────────
const DT_STYLE_ID = "iq-dt-intelligence-styles";
function ensureDTStyles() {
  if (typeof document === "undefined" || document.getElementById(DT_STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = DT_STYLE_ID;
  s.textContent = `
@keyframes iq-dt-spin { to { transform: rotate(360deg); } }
.iq-dt-spinner {
  width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid rgba(192,132,252,0.2);
  border-top-color: #c084fc;
  animation: iq-dt-spin 0.75s linear infinite;
}
`;
  document.head.appendChild(s);
}

// ── Context ───────────────────────────────────────────────────────────────────
export const DTIntelligenceContext = React.createContext<{ open: boolean; close: () => void; activeTab: number }>({
  open: false,
  close: () => {},
  activeTab: 0,
});

// ── Loading / Error panels ────────────────────────────────────────────────────
function DTLoadingPanel({ onClose }: { onClose: () => void }) {
  ensureDTStyles();
  return (
    <div className="cio-ai-panel">
      <div className="cio-ai-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L13.5 10.5L22 12L13.5 13.5L12 22L10.5 13.5L2 12L10.5 10.5Z" fill="#c084fc" />
        </svg>
        <span className="cio-ai-title">Dynatrace Intelligence</span>
        <button className="cio-ai-close" onClick={onClose}>✕</button>
      </div>
      <div className="cio-ai-body">
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
          <div className="iq-dt-spinner" />
          <span style={{ fontSize: 13, color: "#8b92a8" }}>Analyzing with Davis CoPilot…</span>
        </div>
      </div>
    </div>
  );
}

function DTErrorPanel({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="cio-ai-panel">
      <div className="cio-ai-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L13.5 10.5L22 12L13.5 13.5L12 22L10.5 13.5L2 12L10.5 10.5Z" fill="#c084fc" />
        </svg>
        <span className="cio-ai-title">Dynatrace Intelligence</span>
        <button className="cio-ai-close" onClick={onClose}>✕</button>
      </div>
      <div className="cio-ai-body">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "4px 10px", borderRadius: 6, background: "rgba(248,49,47,0.06)", borderLeft: "3px solid #F8312F" }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
          <span style={{ fontSize: 13, color: "#c8cedf" }}>{message}</span>
        </div>
      </div>
    </div>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useDTIntelligence(tabIndex: number, buildPrompt: () => { text: string; contextData: string }): { panel: React.ReactNode } {
  const { open, close, activeTab } = React.useContext(DTIntelligenceContext);
  const [analysis, setAnalysis] = useState<AIAssistData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const buildPromptRef = useRef(buildPrompt);
  useEffect(() => { buildPromptRef.current = buildPrompt; });

  useEffect(() => {
    if (!open || activeTab !== tabIndex) {
      fetchedRef.current = false;
      setAnalysis(null);
      setError(null);
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const { text, contextData } = buildPromptRef.current();
    setLoading(true);

    davisCopilotClient.recommenderConversation({
      body: {
        text,
        ...(contextData ? { context: [{ type: "supplementary" as const, value: contextData }] } : {}),
        annotations: { "origin-app": "my.navigator.iq.app" },
      },
    }).then((response) => {
      if (Array.isArray(response)) {
        setError("Unexpected streaming response from Davis CoPilot.");
        setLoading(false);
        return;
      }
      try {
        const cleaned = response.text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
        const parsed = JSON.parse(cleaned) as AIAssistData;
        setAnalysis(parsed);
      } catch {
        setAnalysis({ summary: response.text, insights: [], recommendations: [] });
      }
      setLoading(false);
    }).catch((err: unknown) => {
      setError(
        err instanceof Error
          ? err.message
          : "Dynatrace Intelligence is unavailable. Verify the Davis CoPilot scope is granted."
      );
      setLoading(false);
    });
  }, [open, activeTab]);

  if (!open) return { panel: null };

  return {
    panel: (
      <div style={{ padding: "12px 20px 0" }}>
        {loading ? (
          <DTLoadingPanel onClose={close} />
        ) : error ? (
          <DTErrorPanel message={error} onClose={close} />
        ) : analysis ? (
          <AIAssistPanel data={analysis} onClose={close} title="Dynatrace Intelligence" />
        ) : null}
      </div>
    ),
  };
}

// ── Button ────────────────────────────────────────────────────────────────────
export function DTIntelligenceButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  ensureStyles();
  return (
    <button
      className={`cio-ai-assist-btn${open ? " active" : ""}`}
      onClick={onToggle}
      title="Dynatrace Intelligence — generative analysis via Davis CoPilot"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <path d="M14 4L15.2 9.6L20 12L15.2 14.4L14 20L12.8 14.4L8 12L12.8 9.6Z" fill="url(#iq-dt-btn-g)" />
        <path d="M7 2L7.7 4.8L10 6L7.7 7.2L7 10L6.3 7.2L4 6L6.3 4.8Z" fill="url(#iq-dt-btn-g)" />
        <path d="M5 13L5.5 14.8L7 16L5.5 17.2L5 19L4.5 17.2L3 16L4.5 14.8Z" fill="url(#iq-dt-btn-g)" />
        <defs>
          <linearGradient id="iq-dt-btn-g" x1="3" y1="2" x2="20" y2="20">
            <stop stopColor="#c084fc" /><stop offset="1" stopColor="#818cf8" />
          </linearGradient>
        </defs>
      </svg>
      Dynatrace Intelligence
    </button>
  );
}

// ── NavigatorIQ prompt builder ────────────────────────────────────────────────
export function buildDTPromptNavigatorIQ(params: {
  assessment: Assessment;
  curResults: AllQueryResults;
  persona: string;
  tabLabel: string;
}): { text: string; contextData: string } {
  const { assessment, curResults, persona, tabLabel } = params;

  const redLines = assessment.redItems.map(i => `  CRITICAL: ${i.title} — ${i.detail}`).join("\n");
  const yellowLines = assessment.yellowItems.map(i => `  WARNING: ${i.title} — ${i.detail}`).join("\n");
  const greenLines = assessment.greenItems.slice(0, 5).map(i => `  OK: ${i.title}`).join("\n");

  const svc = curResults.serviceHealth;
  const host = curResults.hostHealth;
  const dx = curResults.digitalExp;
  const sec = curResults.security;
  const db = curResults.database;
  const dep = curResults.deployments;
  const log = curResults.logErrors;
  const net = curResults.network;
  const k8s = curResults.k8s;

  const lines: string[] = [
    `NavigatorIQ — ${persona} persona — ${tabLabel}`,
    `Overall health: ${assessment.overallHealth.toUpperCase()} (score: ${assessment.healthScore}/100)`,
    `Critical items: ${assessment.redItems.length} | Warnings: ${assessment.yellowItems.length} | Healthy: ${assessment.greenItems.length}`,
  ];

  if (assessment.narrative) lines.push(`Narrative: ${assessment.narrative}`);

  lines.push("", "Assessment signals:");
  if (redLines) lines.push(redLines);
  if (yellowLines) lines.push(yellowLines);
  if (greenLines) lines.push(greenLines);
  lines.push("");

  if (svc) lines.push(`Service health: ${svc.errorRatePct.toFixed(2)}% error rate, ${svc.avgRtMs.toFixed(0)}ms avg response time, ${svc.totalRequests.toLocaleString()} total requests`);
  if (host) lines.push(`Host infrastructure: ${host.avgCpuPct.toFixed(0)}% avg CPU, ${host.avgMemPct.toFixed(0)}% avg memory, ${host.totalHosts} hosts (${host.highCpuHosts} high CPU, ${host.highMemHosts} high memory)`);
  if (dx) lines.push(`Digital experience: ${dx.sessionErrorRatePct.toFixed(1)}% session error rate, ${dx.avgApdex.toFixed(2)} Apdex, ${dx.avgLcpMs.toFixed(0)}ms LCP, ${dx.totalSessions.toLocaleString()} sessions`);
  if (sec) lines.push(`Security: ${sec.criticalVulns} critical vulns, ${sec.highVulns} high vulns, ${sec.totalAttacks} attacks (${sec.exploitedAttacks} exploited)`);
  if (db) lines.push(`Database: ${db.avgRtMs.toFixed(0)}ms avg query time, ${db.totalErrors} errors, ${db.slowQueries} slow queries`);
  if (net) lines.push(`Network: ${net.totalNetErrors} errors, ${net.connectivityEvents} connectivity events`);
  if (k8s) lines.push(`Kubernetes: ${k8s.totalPodRestarts} pod restarts, ${k8s.totalNotReadyPods} not-ready pods`);
  if (dep) lines.push(`Deployments: ${dep.totalDeployments} total, ${dep.workflowFailures} workflow failures`);
  if (log) lines.push(`Log errors: ${log.totalLogErrors.toLocaleString()} total`);

  return {
    text: `Analyze this NavigatorIQ observability assessment for the ${persona} persona over the ${tabLabel} timeframe. Review all critical and warning signals, identify the highest-priority risks, and provide specific remediation recommendations.`,
    contextData: lines.join("\n"),
  };
}
