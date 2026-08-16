import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useDql, useUserAppState, useSetUserAppState } from "@dynatrace-sdk/react-hooks";
import { queryExecutionClient } from "@dynatrace-sdk/client-query";
import type { PersonaId, TimeframeTab, SavedSettings, AssessmentItem } from "../types";
import {
  PERSONAS,
  NOOP_QUERY,
  getTimeframeInfo,
  APP_VERSION,
  IQ_WHATS_NEW,
  TIMEFRAME_TABS,
} from "../constants";
import {
  serviceHealthQuery, parseServiceHealth,
  logErrorsQuery, parseLogErrors,
  problemsQuery, parseProblems,
  hostHealthQuery, parseHostHealth,
  k8sQuery, parseK8s,
  securityQuery, attacksQuery, parseSecurity,
  databaseQuery, parseDatabase,
  networkQuery, networkErrorsQuery, parseNetwork,
  digitalExpQuery, syntheticQuery, parseDigitalExp,
  deploymentQuery, workflowQuery, parseDeployments,
} from "../queries";
import { computeAssessment } from "../intelligence";
import { PersonaPickerModal } from "../components/PersonaPickerModal";
import { SettingsPanel } from "../components/SettingsPanel";
import { AssessmentPanel } from "../components/AssessmentPanel";
import { AppLinksPanel } from "../components/AppLinksPanel";
import { ForecastModal } from "../components/ForecastModal";
import "./NavigatorIQ.css";

const SETTINGS_KEY = "iq-settings-v1";
const EMPTY_SETTINGS: SavedSettings = { personas: {}, global: {} };

function parseSettings(raw: string | undefined): SavedSettings {
  if (!raw) return EMPTY_SETTINGS;
  try { return JSON.parse(raw); } catch { return EMPTY_SETTINGS; }
}

// Appending a harmless comment forces useDql to re-run when refreshSeed changes.
// DQL supports // single-line comments.
function withSeed(query: string, seed: number): string {
  return seed > 0 ? `${query}\n// r:${seed}` : query;
}

type DqlRecord = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function recs(r: any): DqlRecord[] | undefined {
  return r?.data?.records;
}

const TAB_LABELS: Record<TimeframeTab, string> = {
  "30min": "Last 30 Min",
  "2h":    "Last 2 Hours",
  today:   "Today",
  yesterday: "Yesterday",
  "7d":    "Last 7 Days",
};

export function NavigatorIQ() {
  // ─── Active persona & tab ───────────────────────────────────────────────
  const [persona, setPersona] = useState<PersonaId>("developer");
  const [tab, setTab] = useState<TimeframeTab>("30min");
  const [visitedTabs, setVisitedTabs] = useState<Set<TimeframeTab>>(new Set(["30min"]));
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [forecastItem, setForecastItem] = useState<AssessmentItem | null>(null);
  // ─── Settings from user-app-state ──────────────────────────────────────
  const settingsState = useUserAppState({ key: SETTINGS_KEY });
  const { execute: saveSettingsRaw } = useSetUserAppState();
  const settings = useMemo(() => parseSettings(settingsState.data?.value as string | undefined), [settingsState.data?.value]);

  const handleSaveSettings = useCallback((s: SavedSettings) => {
    saveSettingsRaw({ key: SETTINGS_KEY, body: { value: JSON.stringify(s) } });
  }, [saveSettingsRaw]);

  // ─── Auto-refresh ───────────────────────────────────────────────────────
  const refreshMs = settings.global?.refreshIntervalMs ?? 0;
  useEffect(() => {
    if (!refreshMs) return;
    const id = setInterval(() => setRefreshSeed((s) => s + 1), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  // ─── Timeframe info for current & previous period ───────────────────────
  const tf = useMemo(() => getTimeframeInfo(tab), [tab]);
  const isTabLoaded = visitedTabs.has(tab);

  const handleTabChange = (newTab: TimeframeTab) => {
    setTab(newTab);
    setVisitedTabs((prev) => new Set([...prev, newTab]));
  };

  // ─── Query strings: only run real queries for visited tabs ──────────────
  const seed = refreshSeed;
  const svcQ     = isTabLoaded ? withSeed(serviceHealthQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const svcPrevQ = isTabLoaded ? withSeed(serviceHealthQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const logQ     = isTabLoaded ? withSeed(logErrorsQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const logPrevQ = isTabLoaded ? withSeed(logErrorsQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const probQ    = isTabLoaded ? withSeed(problemsQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const probPrevQ= isTabLoaded ? withSeed(problemsQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const hostQ    = isTabLoaded ? withSeed(hostHealthQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const hostPrevQ= isTabLoaded ? withSeed(hostHealthQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const k8sQ     = isTabLoaded ? withSeed(k8sQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const k8sPrevQ = isTabLoaded ? withSeed(k8sQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const secQ     = isTabLoaded ? withSeed(securityQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const secPrevQ = isTabLoaded ? withSeed(securityQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const atkQ     = isTabLoaded ? withSeed(attacksQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const atkPrevQ = isTabLoaded ? withSeed(attacksQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const dbQ      = isTabLoaded ? withSeed(databaseQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const dbPrevQ  = isTabLoaded ? withSeed(databaseQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const netErrQ  = isTabLoaded ? withSeed(networkErrorsQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const netErrPQ = isTabLoaded ? withSeed(networkErrorsQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const netConQ  = isTabLoaded ? withSeed(networkQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const netConPQ = isTabLoaded ? withSeed(networkQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const dxQ      = isTabLoaded ? withSeed(digitalExpQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const dxPrevQ  = isTabLoaded ? withSeed(digitalExpQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const synthQ   = isTabLoaded ? withSeed(syntheticQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const synthPQ  = isTabLoaded ? withSeed(syntheticQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const deplQ    = isTabLoaded ? withSeed(deploymentQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const deplPQ   = isTabLoaded ? withSeed(deploymentQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const wfQ      = isTabLoaded ? withSeed(workflowQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const wfPQ     = isTabLoaded ? withSeed(workflowQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;

  // ─── DQL hooks (all at top level — no conditional hooks) ───────────────
  const svcR      = useDql({ query: svcQ });
  const svcPrevR  = useDql({ query: svcPrevQ });
  const logR      = useDql({ query: logQ });
  const logPrevR  = useDql({ query: logPrevQ });
  const probR     = useDql({ query: probQ });
  const probPrevR = useDql({ query: probPrevQ });
  const hostR     = useDql({ query: hostQ });
  const hostPrevR = useDql({ query: hostPrevQ });
  const k8sR      = useDql({ query: k8sQ });
  const k8sPrevR  = useDql({ query: k8sPrevQ });
  const secR      = useDql({ query: secQ });
  const secPrevR  = useDql({ query: secPrevQ });
  const atkR      = useDql({ query: atkQ });
  const atkPrevR  = useDql({ query: atkPrevQ });
  const dbR       = useDql({ query: dbQ });
  const dbPrevR   = useDql({ query: dbPrevQ });
  const netErrR   = useDql({ query: netErrQ });
  const netErrPR  = useDql({ query: netErrPQ });
  const netConR   = useDql({ query: netConQ });
  const netConPR  = useDql({ query: netConPQ });
  const dxR       = useDql({ query: dxQ });
  const dxPrevR   = useDql({ query: dxPrevQ });
  const synthR    = useDql({ query: synthQ });
  const synthPR   = useDql({ query: synthPQ });
  const deplR     = useDql({ query: deplQ });
  const deplPR    = useDql({ query: deplPQ });
  const wfR       = useDql({ query: wfQ });
  const wfPR      = useDql({ query: wfPQ });

  // ─── Parse results ──────────────────────────────────────────────────────

  const curResults = useMemo(() => ({
    serviceHealth: parseServiceHealth(recs(svcR)),
    logErrors:     parseLogErrors(recs(logR)),
    problems:      parseProblems(recs(probR)),
    hostHealth:    parseHostHealth(recs(hostR)),
    k8s:           parseK8s(recs(k8sR)),
    security:      parseSecurity(recs(secR), recs(atkR)),
    database:      parseDatabase(recs(dbR)),
    network:       parseNetwork(recs(netErrR), recs(netConR)),
    digitalExp:    parseDigitalExp(recs(dxR), recs(synthR)),
    deployments:   parseDeployments(recs(deplR), recs(wfR)),
  }), [svcR.data, logR.data, probR.data, hostR.data, k8sR.data, secR.data, atkR.data, dbR.data, netErrR.data, netConR.data, dxR.data, synthR.data, deplR.data, wfR.data]);

  const prevResults = useMemo(() => ({
    serviceHealth: parseServiceHealth(recs(svcPrevR)),
    logErrors:     parseLogErrors(recs(logPrevR)),
    problems:      parseProblems(recs(probPrevR)),
    hostHealth:    parseHostHealth(recs(hostPrevR)),
    k8s:           parseK8s(recs(k8sPrevR)),
    security:      parseSecurity(recs(secPrevR), recs(atkPrevR)),
    database:      parseDatabase(recs(dbPrevR)),
    network:       parseNetwork(recs(netErrPR), recs(netConPR)),
    digitalExp:    parseDigitalExp(recs(dxPrevR), recs(synthPR)),
    deployments:   parseDeployments(recs(deplPR), recs(wfPR)),
  }), [svcPrevR.data, logPrevR.data, probPrevR.data, hostPrevR.data, k8sPrevR.data, secPrevR.data, atkPrevR.data, dbPrevR.data, netErrPR.data, netConPR.data, dxPrevR.data, synthPR.data, deplPR.data, wfPR.data]);

  // ─── Loading state ──────────────────────────────────────────────────────
  const isLoading = isTabLoaded && [svcR, logR, probR, hostR, k8sR, secR, atkR, dbR, netErrR, netConR, dxR, synthR, deplR, wfR].some((r) => r.isLoading);

  // ─── Assessment ─────────────────────────────────────────────────────────
  const personaThresholds = settings.personas[persona]?.thresholds;
  const assessment = useMemo(
    () => computeAssessment(curResults, prevResults, persona, personaThresholds ?? {}, tf),
    [curResults, prevResults, persona, personaThresholds, tf]
  );

  // ─── Forecast helpers ───────────────────────────────────────────────────
  const [forecastSparkline, setForecastSparkline] = useState<number[]>([]);
  const [forecastLabel, setForecastLabel] = useState("");
  const [forecastColor, setForecastColor] = useState("#4589FF");
  const [forecastFromMs, setForecastFromMs] = useState(0);
  const [forecastToMs, setForecastToMs] = useState(0);

  const handleForecast = useCallback((item: AssessmentItem) => {
    const sparkline = (() => {
      if (item.title.toLowerCase().includes("response") || item.title.toLowerCase().includes("latency")) return curResults.serviceHealth?.rtTimeline ?? [];
      if (item.title.toLowerCase().includes("cpu")) return curResults.hostHealth?.cpuTimeline ?? [];
      if (item.title.toLowerCase().includes("lcp") || item.title.toLowerCase().includes("experience")) return curResults.digitalExp?.lcpTimeline ?? [];
      if (item.title.toLowerCase().includes("database") || item.title.toLowerCase().includes("query")) return curResults.database?.rtTimeline ?? [];
      if (item.title.toLowerCase().includes("error") && curResults.serviceHealth) return curResults.serviceHealth.errorTimeline;
      return [];
    })();
    const colors = { red: "#EF4444", yellow: "#F59E0B", green: "#10B981" };
    const nowMs = Date.now();
    const durationMs: Record<TimeframeTab, number> = { "30min": 30 * 60000, "2h": 2 * 3600000, today: Date.now() % 86400000, yesterday: 86400000, "7d": 7 * 86400000 };
    setForecastSparkline(sparkline);
    setForecastLabel(item.title);
    setForecastColor(colors[item.severity]);
    setForecastToMs(nowMs);
    setForecastFromMs(nowMs - (durationMs[tab] ?? 3600000));
    setForecastItem(item);
  }, [curResults, tab]);

  const handleForecastRequery = useCallback(async (analyzeDays: number, _datapointMinutes: number): Promise<number[]> => {
    const from = `now()-${analyzeDays}d`;
    const to = "now()";
    const title = forecastItem?.title?.toLowerCase() ?? "";
    const q = title.includes("response") || title.includes("latency")
      ? serviceHealthQuery(from, to)
      : title.includes("cpu")
        ? hostHealthQuery(from, to)
        : title.includes("lcp") || title.includes("experience")
          ? digitalExpQuery(from, to)
          : title.includes("database") || title.includes("query")
            ? databaseQuery(from, to)
            : serviceHealthQuery(from, to);
    try {
      const res = await queryExecutionClient.queryExecute({ body: { query: q, requestTimeoutMilliseconds: 60000 } });
      const records = (res.result as any)?.records ?? [];
      const parsed = parseServiceHealth(records);
      return parsed?.rtTimeline ?? [];
    } catch {
      return forecastSparkline;
    }
  }, [forecastItem, forecastSparkline]);

  // ─── Persona picker ─────────────────────────────────────────────────────
  const handlePersonaApply = useCallback((p: PersonaId) => {
    setPersona(p);
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────
  const activePersonaDef = PERSONAS.find((p) => p.id === persona)!;
  const personaLinks = settings.personas[persona]?.appLinks;
  const allItems = [...assessment.redItems, ...assessment.yellowItems, ...assessment.greenItems];

  const headerStyle: React.CSSProperties = {
    background: "linear-gradient(135deg,rgba(9,12,22,0.98) 0%,rgba(12,16,28,0.98) 100%)",
    borderBottom: "1px solid rgba(69,137,255,0.2)",
    padding: "0 24px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    height: 56,
    flexShrink: 0,
    backdropFilter: "blur(8px)",
  };

  return (
    <div className="iq-page">
      <PersonaPickerModal
        appVersion={APP_VERSION}
        whatsNew={IQ_WHATS_NEW}
        personas={PERSONAS}
        defaultPersonaId={(settings.global?.defaultPersona) ?? "developer"}
        onApply={handlePersonaApply}
      />

      {/* ── Header ── */}
      <div style={headerStyle}>
        {/* Branding */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 20 }}>🧭</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "0.01em", whiteSpace: "nowrap" }}>NavigatorIQ</span>
        </div>

        {/* Persona chip */}
        <PersonaChip persona={activePersonaDef} personas={PERSONAS} onSelect={setPersona} />

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.12)", flexShrink: 0 }} />

        {/* Timeframe tabs */}
        <div style={{ display: "flex", gap: 4, flex: 1 }}>
          {TIMEFRAME_TABS.map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`iq-tab${tab === t ? " iq-tab--active" : ""}`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
          <button
            onClick={() => setRefreshSeed((s) => s + 1)}
            title="Refresh queries"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "rgba(255,255,255,0.7)", fontSize: 14, padding: "4px 10px", cursor: "pointer" }}
          >
            ⟳
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            style={{ background: "rgba(69,137,255,0.1)", border: "1px solid rgba(69,137,255,0.25)", borderRadius: 6, color: "#7ab4ff", fontSize: 12, fontWeight: 600, padding: "5px 12px", cursor: "pointer" }}
          >
            ⚙ Settings
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="iq-content">
        <div className="iq-main">
          <AssessmentPanel assessment={assessment} isLoading={isLoading} onForecast={handleForecast} />
        </div>
        <div className="iq-sidebar">
          <AppLinksPanel personaId={persona} savedLinks={personaLinks} assessmentItems={allItems} />
        </div>
      </div>

      {/* ── Modals ── */}
      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {forecastItem && forecastSparkline.length > 0 && (
        <ForecastModal
          label={forecastLabel}
          sparkline={forecastSparkline}
          color={forecastColor}
          fromMs={forecastFromMs}
          toMs={forecastToMs}
          onClose={() => setForecastItem(null)}
          getRequeryData={handleForecastRequery}
        />
      )}
    </div>
  );
}

// ─── Persona chip with inline dropdown ──────────────────────────────────────

interface PersonaChipProps {
  persona: { id: PersonaId; icon: string; label: string };
  personas: { id: PersonaId; icon: string; label: string; description: string }[];
  onSelect: (id: PersonaId) => void;
}

function PersonaChip({ persona, personas, onSelect }: PersonaChipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(69,137,255,0.12)", border: "1px solid rgba(69,137,255,0.3)", borderRadius: 20, padding: "4px 12px", color: "#7ab4ff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
      >
        <span>{persona.icon}</span>
        <span>{persona.label}</span>
        <span style={{ fontSize: 10, opacity: 0.7 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, background: "#0f1422", border: "1px solid rgba(69,137,255,0.25)", borderRadius: 10, padding: 8, zIndex: 1000, minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => { onSelect(p.id); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: p.id === persona.id ? "rgba(69,137,255,0.15)" : "transparent", color: p.id === persona.id ? "#7ab4ff" : "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: p.id === persona.id ? 700 : 400, cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ fontSize: 16 }}>{p.icon}</span>
              <div>
                <div style={{ fontWeight: p.id === persona.id ? 700 : 600 }}>{p.label}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{p.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
