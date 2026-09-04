import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useDql, useAppState, useSetAppState, useUserAppState, useSetUserAppState } from "@dynatrace-sdk/react-hooks";
import { queryExecutionClient } from "@dynatrace-sdk/client-query";
import type { PersonaId, TimeframeTab, SavedSettings, AssessmentItem } from "../types";
import {
  PERSONAS,
  NOOP_QUERY,
  getTimeframeInfo,
  APP_VERSION,
  IQ_WHATS_NEW,
  TIMEFRAME_TABS,
  DEFAULT_HEAT_METRICS,
} from "../constants";
import {
  serviceHealthQuery, parseServiceHealth,
  logErrorsQuery, parseLogErrors,
  hostHealthQuery, parseHostHealth,
  k8sQuery, parseK8s,
  securityQuery, attacksQuery, parseSecurity,
  databaseQuery, parseDatabase,
  networkQuery, networkErrorsQuery, parseNetwork,
  digitalExpQuery, syntheticQuery, parseDigitalExp,
  deploymentQuery, workflowQuery, parseDeployments,
  deploymentTimelineQuery, parseDeploymentTimeline,
  davisProblemsQuery, parseDavisProblems,
  digitalTimelapseQuery, parseDigitalTimelapse,
  platformTimelineQuery, parsePlatformTimeline,
  securityTimelapseQuery, parseSecurityTimelapse,
  buildCustomHeatQuery, parseCustomHeat, buildDqlHeatQuery, parseDqlHeatResult,
} from "../queries";
import type { DavisProblemsResult } from "../queries";
import { computeAssessment } from "../intelligence";
import type { CustomHeatMetric } from "../intelligence";
import { PersonaPickerModal } from "../components/PersonaPickerModal";
import { SettingsPanel } from "../components/SettingsPanel";
import { AssessmentPanel } from "../components/AssessmentPanel";
import { AppLinksPanel } from "../components/AppLinksPanel";
import { ForecastModal } from "../components/ForecastModal";
import { HelpModal } from "../components/HelpModal";
import "./NavigatorIQ.css";

const SHARED_SETTINGS_KEY = "iq-settings-v1";    // shared across all users (customPersonas only)
const USER_SETTINGS_KEY = "iq-user-settings-v1";  // per-user (personas + global)
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
  "2h":    "Last 2 Hours",
  today:   "Today",
  yesterday: "Yesterday",
  "7d":    "Last 7 Days",
};

export function NavigatorIQ() {
  // ─── Active persona & tab ───────────────────────────────────────────────
  const [persona, setPersona] = useState<PersonaId>("developer");
  const [tab, setTab] = useState<TimeframeTab>("2h");
  const [visitedTabs, setVisitedTabs] = useState<Set<TimeframeTab>>(new Set(["2h"]));
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [forecastItem, setForecastItem] = useState<AssessmentItem | null>(null);
  // ─── Settings: per-user (personas + global) + shared (customPersonas) ──
  const sharedState = useAppState({ key: SHARED_SETTINGS_KEY });
  const userState = useUserAppState({ key: USER_SETTINGS_KEY });
  const { execute: saveSharedRaw } = useSetAppState();
  const { execute: saveUserRaw } = useSetUserAppState();
  const [localSettings, setLocalSettings] = useState<SavedSettings | null>(null);
  const settings = useMemo(() => {
    if (localSettings) return localSettings;
    const shared = parseSettings(sharedState.data?.value as string | undefined);
    const user = parseSettings(userState.data?.value as string | undefined);
    // Migration: if user key is empty, pull personas+global from old shared key
    const hasUserData = Object.keys(user.personas).length > 0 || !!user.global?.defaultPersona;
    const userPart = hasUserData ? user : { personas: shared.personas, global: shared.global };
    return { ...userPart, customPersonas: shared.customPersonas };
  }, [localSettings, sharedState.data?.value, userState.data?.value]);

  const handleSaveSettings = useCallback((s: SavedSettings) => {
    saveUserRaw({ key: USER_SETTINGS_KEY, body: { value: JSON.stringify({ personas: s.personas, global: s.global }) } });
    saveSharedRaw({ key: SHARED_SETTINGS_KEY, body: { value: JSON.stringify({ customPersonas: s.customPersonas }) } });
    setLocalSettings(s);
  }, [saveUserRaw, saveSharedRaw]);

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

  const personaSettings = settings.personas[persona];
  const heatMetrics = useMemo(() => {
    const saved = personaSettings?.heatMetrics;
    const defaults = DEFAULT_HEAT_METRICS[persona] ?? [];
    if (!saved) return defaults;
    // Rebuild in defaults order so new default metrics appear at their natural position.
    // Saved values override defaults; user-added custom metrics (not in defaults) go at end.
    const savedByLabel = new Map(saved.map((m) => [m.label, m]));
    const defaultLabels = new Set(defaults.map((m) => m.label));
    const result = defaults.map((def) => {
      const m = savedByLabel.get(def.label);
      if (!m) return def;
      return {
        ...m,
        metricKey: def.metricKey,
        denominatorKey: def.denominatorKey,
        type: def.type,
        dqlQuery: def.dqlQuery,
        aggregation: def.aggregation,
        isTraffic: def.isTraffic,
        displayUnit: def.displayUnit,
        warningThreshold: m.warningThreshold ?? def.warningThreshold,
        criticalThreshold: m.criticalThreshold ?? def.criticalThreshold,
        exploreAppPath: m.exploreAppPath ?? def.exploreAppPath,
        repoUrl: m.repoUrl ?? def.repoUrl,
      };
    });
    const custom = saved.filter((m) => !defaultLabels.has(m.label));
    return custom.length > 0 ? [...result, ...custom] : result;
  }, [personaSettings, persona]); // eslint-disable-line react-hooks/exhaustive-deps
  const dqlMetrics = useMemo(() => heatMetrics.filter((m) => m.type === "dql" || Boolean(m.dqlQuery?.trim())), [JSON.stringify(heatMetrics)]); // eslint-disable-line react-hooks/exhaustive-deps
  const customHeatQ = useMemo(
    () => (isTabLoaded && heatMetrics.length > 0)
      ? withSeed(buildCustomHeatQuery(heatMetrics, tf.from, tf.to, tf.interval), refreshSeed)
      : withSeed(NOOP_QUERY, refreshSeed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isTabLoaded, JSON.stringify(heatMetrics), persona, tf.from, tf.to, tf.interval, refreshSeed]
  );
  const customHeatR = useDql({ query: customHeatQ });
  // DQL heat metric slots — fixed hooks (React rules); noop when slot unused.
  // Must use useDql (not queryExecutionClient) — it runs in the platform context that
  // allows fetch user.events and other dataset reads the app OAuth token cannot access.
  const dql0Q = useMemo(() => isTabLoaded && dqlMetrics[0] ? withSeed(buildDqlHeatQuery(dqlMetrics[0], tf.from, tf.to, tf.interval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[0]), tf.from, tf.to, tf.interval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql1Q = useMemo(() => isTabLoaded && dqlMetrics[1] ? withSeed(buildDqlHeatQuery(dqlMetrics[1], tf.from, tf.to, tf.interval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[1]), tf.from, tf.to, tf.interval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql2Q = useMemo(() => isTabLoaded && dqlMetrics[2] ? withSeed(buildDqlHeatQuery(dqlMetrics[2], tf.from, tf.to, tf.interval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[2]), tf.from, tf.to, tf.interval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql3Q = useMemo(() => isTabLoaded && dqlMetrics[3] ? withSeed(buildDqlHeatQuery(dqlMetrics[3], tf.from, tf.to, tf.interval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[3]), tf.from, tf.to, tf.interval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql4Q = useMemo(() => isTabLoaded && dqlMetrics[4] ? withSeed(buildDqlHeatQuery(dqlMetrics[4], tf.from, tf.to, tf.interval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[4]), tf.from, tf.to, tf.interval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql5Q = useMemo(() => isTabLoaded && dqlMetrics[5] ? withSeed(buildDqlHeatQuery(dqlMetrics[5], tf.from, tf.to, tf.interval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[5]), tf.from, tf.to, tf.interval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql6Q = useMemo(() => isTabLoaded && dqlMetrics[6] ? withSeed(buildDqlHeatQuery(dqlMetrics[6], tf.from, tf.to, tf.interval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[6]), tf.from, tf.to, tf.interval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql7Q = useMemo(() => isTabLoaded && dqlMetrics[7] ? withSeed(buildDqlHeatQuery(dqlMetrics[7], tf.from, tf.to, tf.interval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[7]), tf.from, tf.to, tf.interval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql8Q = useMemo(() => isTabLoaded && dqlMetrics[8] ? withSeed(buildDqlHeatQuery(dqlMetrics[8], tf.from, tf.to, tf.interval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[8]), tf.from, tf.to, tf.interval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql9Q = useMemo(() => isTabLoaded && dqlMetrics[9] ? withSeed(buildDqlHeatQuery(dqlMetrics[9], tf.from, tf.to, tf.interval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[9]), tf.from, tf.to, tf.interval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql0R = useDql({ query: dql0Q });
  const dql1R = useDql({ query: dql1Q });
  const dql2R = useDql({ query: dql2Q });
  const dql3R = useDql({ query: dql3Q });
  const dql4R = useDql({ query: dql4Q });
  const dql5R = useDql({ query: dql5Q });
  const dql6R = useDql({ query: dql6Q });
  const dql7R = useDql({ query: dql7Q });
  const dql8R = useDql({ query: dql8Q });
  const dql9R = useDql({ query: dql9Q });

  const handleTabChange = (newTab: TimeframeTab) => {
    setTab(newTab);
    setVisitedTabs((prev) => new Set([...prev, newTab]));
  };

  // ─── Query strings: only run real queries for visited tabs ──────────────
  const seed = refreshSeed;
  const svcQ     = isTabLoaded ? withSeed(serviceHealthQuery(tf.from, tf.to, tf.interval), seed) : NOOP_QUERY;
  const svcPrevQ = isTabLoaded ? withSeed(serviceHealthQuery(tf.prevFrom, tf.prevTo, tf.interval), seed) : NOOP_QUERY;
  const logQ     = isTabLoaded ? withSeed(logErrorsQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const logPrevQ = isTabLoaded ? withSeed(logErrorsQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const hostQ    = isTabLoaded ? withSeed(hostHealthQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const hostPrevQ= isTabLoaded ? withSeed(hostHealthQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const k8sQ     = isTabLoaded ? withSeed(k8sQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const k8sPrevQ = isTabLoaded ? withSeed(k8sQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const secQ     = isTabLoaded ? withSeed(securityQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const secPrevQ = isTabLoaded ? withSeed(securityQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const atkQ     = isTabLoaded ? withSeed(attacksQuery(tf.from, tf.to), seed) : NOOP_QUERY;
  const atkPrevQ = isTabLoaded ? withSeed(attacksQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const dbQ      = isTabLoaded ? withSeed(databaseQuery(tf.from, tf.to, tf.interval), seed) : NOOP_QUERY;
  const dbPrevQ  = isTabLoaded ? withSeed(databaseQuery(tf.prevFrom, tf.prevTo, tf.interval), seed) : NOOP_QUERY;
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
  const dxTlQ    = isTabLoaded ? withSeed(digitalTimelapseQuery(tf.from, tf.to, tf.interval), seed) : NOOP_QUERY;
  const dxTlPQ   = isTabLoaded ? withSeed(digitalTimelapseQuery(tf.prevFrom, tf.prevTo, tf.interval), seed) : NOOP_QUERY;
  const ptlQ     = isTabLoaded ? withSeed(platformTimelineQuery(tf.from, tf.to, tf.interval), seed) : NOOP_QUERY;
  const ptlPQ    = isTabLoaded ? withSeed(platformTimelineQuery(tf.prevFrom, tf.prevTo, tf.interval), seed) : NOOP_QUERY;
  const secTlQ   = isTabLoaded ? withSeed(securityTimelapseQuery(tf.from, tf.to, tf.interval), seed) : NOOP_QUERY;
  const deplTlQ  = isTabLoaded ? withSeed(deploymentTimelineQuery(tf.from, tf.to, tf.interval), seed) : NOOP_QUERY;
  const davisQ   = isTabLoaded ? withSeed(davisProblemsQuery(tf.from, tf.to), seed) : NOOP_QUERY;

  // ─── DQL hooks (all at top level — no conditional hooks) ───────────────
  const svcR      = useDql({ query: svcQ });
  const svcPrevR  = useDql({ query: svcPrevQ });
  const logR      = useDql({ query: logQ });
  const logPrevR  = useDql({ query: logPrevQ });
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
  const dxTlR     = useDql({ query: dxTlQ });
  const dxTlPR    = useDql({ query: dxTlPQ });
  const ptlR      = useDql({ query: ptlQ });
  const ptlPR     = useDql({ query: ptlPQ });
  const secTlR    = useDql({ query: secTlQ });
  const deplTlR   = useDql({ query: deplTlQ });
  const davisR    = useDql({ query: davisQ });

  // ─── Parse results ──────────────────────────────────────────────────────

  const curResults = useMemo(() => ({
    serviceHealth:    parseServiceHealth(recs(svcR)),
    logErrors:        parseLogErrors(recs(logR)),
    hostHealth:       parseHostHealth(recs(hostR)),
    k8s:              parseK8s(recs(k8sR)),
    security:         parseSecurity(recs(secR), recs(atkR)),
    database:         parseDatabase(recs(dbR)),
    network:          parseNetwork(recs(netErrR), recs(netConR)),
    digitalExp:       parseDigitalExp(recs(dxR), recs(synthR)),
    deployments:      parseDeployments(recs(deplR), recs(wfR)),
    digitalTimelapse: parseDigitalTimelapse(recs(dxTlR)),
    platformTimeline: parsePlatformTimeline(recs(ptlR)),
    securityTimelapse: parseSecurityTimelapse(recs(secTlR)),
  }), [svcR.data, logR.data, hostR.data, k8sR.data, secR.data, atkR.data, dbR.data, netErrR.data, netConR.data, dxR.data, synthR.data, deplR.data, wfR.data, dxTlR.data, ptlR.data, secTlR.data]);

  const prevResults = useMemo(() => ({
    serviceHealth:    parseServiceHealth(recs(svcPrevR)),
    logErrors:        parseLogErrors(recs(logPrevR)),
    hostHealth:       parseHostHealth(recs(hostPrevR)),
    k8s:              parseK8s(recs(k8sPrevR)),
    security:         parseSecurity(recs(secPrevR), recs(atkPrevR)),
    database:         parseDatabase(recs(dbPrevR)),
    network:          parseNetwork(recs(netErrPR), recs(netConPR)),
    digitalExp:       parseDigitalExp(recs(dxPrevR), recs(synthPR)),
    deployments:      parseDeployments(recs(deplPR), recs(wfPR)),
    digitalTimelapse: parseDigitalTimelapse(recs(dxTlPR)),
    platformTimeline: parsePlatformTimeline(recs(ptlPR)),
  }), [svcPrevR.data, logPrevR.data, hostPrevR.data, k8sPrevR.data, secPrevR.data, atkPrevR.data, dbPrevR.data, netErrPR.data, netConPR.data, dxPrevR.data, synthPR.data, deplPR.data, wfPR.data, dxTlPR.data, ptlPR.data]);

  // ─── Loading state ──────────────────────────────────────────────────────
  const deploymentBuckets = useMemo(() => parseDeploymentTimeline(recs(deplTlR)), [deplTlR.data]);
  const davisProblems: DavisProblemsResult | null = useMemo(() => parseDavisProblems(recs(davisR)), [davisR.data]);

  const isLoading = isTabLoaded && [svcR, logR, hostR, k8sR, secR, atkR, dbR, netErrR, netConR, dxR, synthR, deplR, wfR, dxTlR, ptlR, secTlR, deplTlR, davisR, customHeatR, dql0R, dql1R, dql2R, dql3R, dql4R, dql5R, dql6R, dql7R, dql8R, dql9R].some((r) => r.isLoading);

  // ─── Assessment ─────────────────────────────────────────────────────────
  const personaThresholds = settings.personas[persona]?.thresholds;
  const assessment = useMemo(
    () => {
      const standardMetrics: CustomHeatMetric[] = parseCustomHeat(recs(customHeatR), heatMetrics);
      const dqlResults = [
        dqlMetrics[0] ? parseDqlHeatResult(recs(dql0R), dqlMetrics[0]) : null,
        dqlMetrics[1] ? parseDqlHeatResult(recs(dql1R), dqlMetrics[1]) : null,
        dqlMetrics[2] ? parseDqlHeatResult(recs(dql2R), dqlMetrics[2]) : null,
        dqlMetrics[3] ? parseDqlHeatResult(recs(dql3R), dqlMetrics[3]) : null,
        dqlMetrics[4] ? parseDqlHeatResult(recs(dql4R), dqlMetrics[4]) : null,
        dqlMetrics[5] ? parseDqlHeatResult(recs(dql5R), dqlMetrics[5]) : null,
        dqlMetrics[6] ? parseDqlHeatResult(recs(dql6R), dqlMetrics[6]) : null,
        dqlMetrics[7] ? parseDqlHeatResult(recs(dql7R), dqlMetrics[7]) : null,
        dqlMetrics[8] ? parseDqlHeatResult(recs(dql8R), dqlMetrics[8]) : null,
        dqlMetrics[9] ? parseDqlHeatResult(recs(dql9R), dqlMetrics[9]) : null,
      ].filter(Boolean) as CustomHeatMetric[];
      const customMetrics = [...standardMetrics, ...dqlResults];
      return computeAssessment(curResults, prevResults, persona, personaThresholds ?? {}, tf, customMetrics.length > 0 ? customMetrics : undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [curResults, prevResults, persona, personaThresholds, tf, customHeatR.data, dql0R.data, dql1R.data, dql2R.data, dql3R.data, dql4R.data, dql5R.data, dql6R.data, dql7R.data, dql8R.data, dql9R.data, dqlMetrics]
  );

  // ─── Forecast helpers ───────────────────────────────────────────────────
  const [forecastSparkline, setForecastSparkline] = useState<number[]>([]);
  const [forecastLabel, setForecastLabel] = useState("");
  const [forecastColor, setForecastColor] = useState("#4589FF");
  const [forecastFromMs, setForecastFromMs] = useState(0);
  const [forecastToMs, setForecastToMs] = useState(0);
  // tracks which data source / field to use when requerying forecast over a longer range
  const [forecastRequeryType, setForecastRequeryType] = useState<
    "svcRt" | "svcErr" | "cpu" | "lcp" | "db" | "log" | "dxErr" | "dxDur" | "dxTtfb" | "dxFcp"
  >("svcRt");

  const handleForecast = useCallback((item: AssessmentItem) => {
    const t = item.title.toLowerCase();
    type RequeryType = "svcRt" | "svcErr" | "cpu" | "lcp" | "db" | "log" | "dxErr" | "dxDur" | "dxTtfb" | "dxFcp";
    let requeryType: RequeryType = "svcRt";
    const sparkline = (() => {
      if (t.includes("response") || t.includes("latency")) { requeryType = "svcRt"; return curResults.serviceHealth?.rtTimeline ?? []; }
      if (t.includes("cpu")) { requeryType = "cpu"; return curResults.hostHealth?.cpuTimeline ?? []; }
      if (t.includes("lcp") || t.includes("experience")) { requeryType = "lcp"; return curResults.digitalTimelapse?.lcpTimeline ?? curResults.digitalExp?.lcpTimeline ?? []; }
      if (t.includes("database") || t.includes("query")) { requeryType = "db"; return curResults.database?.rtTimeline ?? []; }
      if (t.includes("log")) { requeryType = "log"; return curResults.logErrors?.logTimeline ?? []; }
      if (t.includes("error")) {
        const svcTl = curResults.serviceHealth?.errorTimeline;
        if (svcTl?.length) { requeryType = "svcErr"; return svcTl; }
        requeryType = "dxErr"; return curResults.digitalTimelapse?.errorRateTimeline ?? [];
      }
      if (t.includes("duration")) { requeryType = "dxDur"; return curResults.digitalTimelapse?.durationTimeline ?? []; }
      if (t.includes("ttfb")) { requeryType = "dxTtfb"; return curResults.digitalTimelapse?.ttfbTimeline ?? []; }
      if (t.includes("fcp")) { requeryType = "dxFcp"; return curResults.digitalTimelapse?.lcpTimeline ?? []; }
      return [];
    })();
    const colors = { red: "#EF4444", yellow: "#F59E0B", green: "#10B981" };
    const nowMs = Date.now();
    const durationMs: Record<TimeframeTab, number> = { "2h": 2 * 3600000, today: Date.now() % 86400000, yesterday: 86400000, "7d": 7 * 86400000 };
    setForecastSparkline(sparkline);
    setForecastLabel(item.title);
    setForecastColor(colors[item.severity]);
    setForecastToMs(nowMs);
    setForecastFromMs(nowMs - (durationMs[tab] ?? 3600000));
    setForecastItem(item);
    setForecastRequeryType(requeryType);
  }, [curResults, tab]);

  const handleForecastRequery = useCallback(async (analyzeDays: number, _datapointMinutes: number): Promise<number[]> => {
    const from = `now()-${analyzeDays}d`;
    const to = "now()";
    const isDx = forecastRequeryType.startsWith("dx");
    const q = forecastRequeryType === "log" ? logErrorsQuery(from, to)
      : forecastRequeryType === "cpu" ? hostHealthQuery(from, to)
      : forecastRequeryType === "db" ? databaseQuery(from, to)
      : isDx ? digitalTimelapseQuery(from, to)
      : serviceHealthQuery(from, to);
    try {
      const res = await queryExecutionClient.queryExecute({ body: { query: q, requestTimeoutMilliseconds: 60000 } });
      const records = (res.result as any)?.records ?? [];
      if (forecastRequeryType === "log") return parseLogErrors(records)?.logTimeline ?? [];
      if (isDx) {
        const parsed = parseDigitalTimelapse(records);
        if (!parsed) return forecastSparkline;
        if (forecastRequeryType === "dxErr") return parsed.errorRateTimeline;
        if (forecastRequeryType === "dxDur") return parsed.durationTimeline;
        if (forecastRequeryType === "dxTtfb") return parsed.ttfbTimeline;
        return parsed.lcpTimeline;
      }
      const parsed = parseServiceHealth(records);
      if (forecastRequeryType === "svcErr") return parsed?.errorTimeline ?? [];
      return parsed?.rtTimeline ?? [];
    } catch {
      return forecastSparkline;
    }
  }, [forecastRequeryType, forecastSparkline]);

  // ─── Persona picker ─────────────────────────────────────────────────────
  const handlePersonaApply = useCallback((p: PersonaId) => {
    setPersona(p);
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────
  const allPersonas = useMemo(
    () => [...PERSONAS, ...(settings.customPersonas ?? [])],
    [settings.customPersonas]
  );
  const activePersonaDef = allPersonas.find((p) => p.id === persona) ?? PERSONAS[0];
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
    zIndex: 200,
  };

  return (
    <div className="iq-page">
      <PersonaPickerModal
        appVersion={APP_VERSION}
        whatsNew={IQ_WHATS_NEW}
        personas={allPersonas}
        defaultPersonaId={(settings.global?.defaultPersona) ?? "developer"}
        onApply={handlePersonaApply}
      />

      {/* ── Header ── */}
      <div style={headerStyle}>
        {/* Branding */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 20 }}>🧭</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "0.01em", whiteSpace: "nowrap" }}>NavigatorIQ Launcher</span>
        </div>

        {/* Persona chip */}
        <PersonaChip persona={activePersonaDef} personas={allPersonas} onSelect={setPersona} />

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
          <span style={{ fontSize: 11, opacity: 0.4, fontFamily: "monospace", marginRight: 4 }}>v{APP_VERSION}</span>
          <button
            onClick={() => setRefreshSeed((s) => s + 1)}
            title="Refresh queries"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "rgba(255,255,255,0.7)", fontSize: 14, padding: "4px 10px", cursor: "pointer" }}
          >
            ⟳
          </button>
          <button
            onClick={() => setHelpOpen(true)}
            title="Help"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 700, padding: "5px 10px", cursor: "pointer", lineHeight: 1 }}
          >
            ?
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
          <AssessmentPanel assessment={assessment} isLoading={isLoading} onForecast={handleForecast} persona={persona} heatMetrics={heatMetrics} deploymentBuckets={deploymentBuckets} davisProblems={davisProblems} bucketMs={(() => { const m = tf.interval.match(/^(\d+)([mh])$/); return m ? parseInt(m[1]) * (m[2] === "h" ? 3600000 : 60000) : 60000; })()} />
        </div>
        <div className="iq-sidebar">
          <AppLinksPanel personaId={persona} savedLinks={personaLinks} assessmentItems={allItems} />
        </div>
      </div>

      {/* ── Modals ── */}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

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
