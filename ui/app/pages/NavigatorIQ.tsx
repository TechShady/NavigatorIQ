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
  davisProblemsRawQuery, parseDavisProblemsTimeseries,
  digitalTimelapseQuery, parseDigitalTimelapse,
  platformTimelineQuery, parsePlatformTimeline,
  securityTimelapseQuery, parseSecurityTimelapse,
  buildCustomHeatQuery, parseCustomHeat, buildDqlHeatQuery, parseDqlHeatResult,
} from "../queries";
import type { DavisProblemsResult } from "../queries";
import { computeAssessment, computeHeat } from "../intelligence";
import type { CustomHeatMetric } from "../intelligence";
import { PersonaPickerModal } from "../components/PersonaPickerModal";
import { SettingsPanel } from "../components/SettingsPanel";
import { AssessmentPanel } from "../components/AssessmentPanel";
import { AppLinksPanel } from "../components/AppLinksPanel";
import { ForecastModal } from "../components/ForecastModal";
import { HelpModal } from "../components/HelpModal";
import { AutomateModal } from "../components/AutomateModal";
import "./NavigatorIQ.css";

const SHARED_SETTINGS_KEY = "iq-settings-v1";    // shared across all users (customPersonas only)
const USER_SETTINGS_KEY = "iq-user-settings-v1";  // per-user (personas + global)
const HEALTH_HISTORY_KEY = "iq-health-v1";         // per-user health score history (all personas)
const EMPTY_SETTINGS: SavedSettings = { personas: {}, global: {} };

interface HealthReading { score: number; ts: number; }
type HealthHistory = Partial<Record<string, HealthReading[]>>;

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
  const [automateOpen, setAutomateOpen] = useState(false);
  const [forecastItem, setForecastItem] = useState<AssessmentItem | null>(null);
  // ─── Settings: per-user (personas + global) + shared (customPersonas) ──
  const sharedState = useAppState({ key: SHARED_SETTINGS_KEY });
  const userState = useUserAppState({ key: USER_SETTINGS_KEY });
  const healthHistoryState = useUserAppState({ key: HEALTH_HISTORY_KEY });
  const { execute: saveSharedRaw } = useSetAppState();
  const { execute: saveUserRaw } = useSetUserAppState();
  const { execute: saveHealthRaw } = useSetUserAppState();
  const [localSettings, setLocalSettings] = useState<SavedSettings | null>(null);
  const settings = useMemo(() => {
    if (localSettings) return localSettings;
    const shared = parseSettings(sharedState.data?.value as string | undefined);
    const user = parseSettings(userState.data?.value as string | undefined);
    // Migration: if user key is empty, pull personas+global from old shared key
    const hasUserData = Object.keys(user.personas).length > 0 || !!user.global?.defaultPersona;
    const userPart = hasUserData ? user : { personas: shared.personas ?? {}, global: shared.global ?? {} };
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

  // ─── Zoom: custom time window from drag-select on heat strip ───────────
  const [zoom, setZoom] = useState<{ from: string; to: string; interval: string; label: string } | null>(null);

  const handleZoomRange = useCallback((fromIso: string, toIso: string) => {
    const durMs = new Date(toIso).getTime() - new Date(fromIso).getTime();
    const interval = durMs <= 30 * 60000 ? "1m" : durMs <= 3 * 3600000 ? "5m" : durMs <= 12 * 3600000 ? "10m" : "1h";
    const fmt = (iso: string) => {
      const d = new Date(iso);
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    };
    // DQL requires quoted ISO strings: from:"2026-09-30T10:11:00Z"
    setZoom({ from: `"${fromIso}"`, to: `"${toIso}"`, interval, label: `${fmt(fromIso)} → ${fmt(toIso)}` });
    setRefreshSeed((s) => s + 1);
  }, []);

  // ─── Timeframe info for current & previous period ───────────────────────
  const tf = useMemo(() => getTimeframeInfo(tab), [tab]);
  const isTabLoaded = visitedTabs.has(tab);

  // Clear zoom when user changes the tab
  const handleSetTab = useCallback((t: typeof tab) => { setTab(t); setZoom(null); }, []);

  // Effective timeframe: zoom overrides tab when active
  const effectiveFrom = zoom?.from ?? tf.from;
  const effectiveTo = zoom?.to ?? tf.to;
  const effectiveInterval = zoom?.interval ?? tf.interval;

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
      ? withSeed(buildCustomHeatQuery(heatMetrics, effectiveFrom, effectiveTo, effectiveInterval), refreshSeed)
      : withSeed(NOOP_QUERY, refreshSeed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isTabLoaded, JSON.stringify(heatMetrics), persona, effectiveFrom, effectiveTo, effectiveInterval, refreshSeed]
  );
  const customHeatR = useDql({ query: customHeatQ });
  // DQL heat metric slots — fixed hooks (React rules); noop when slot unused.
  // Must use useDql (not queryExecutionClient) — it runs in the platform context that
  // allows fetch user.events and other dataset reads the app OAuth token cannot access.
  const dql0Q = useMemo(() => isTabLoaded && dqlMetrics[0] ? withSeed(buildDqlHeatQuery(dqlMetrics[0], effectiveFrom, effectiveTo, effectiveInterval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[0]), effectiveFrom, effectiveTo, effectiveInterval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql1Q = useMemo(() => isTabLoaded && dqlMetrics[1] ? withSeed(buildDqlHeatQuery(dqlMetrics[1], effectiveFrom, effectiveTo, effectiveInterval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[1]), effectiveFrom, effectiveTo, effectiveInterval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql2Q = useMemo(() => isTabLoaded && dqlMetrics[2] ? withSeed(buildDqlHeatQuery(dqlMetrics[2], effectiveFrom, effectiveTo, effectiveInterval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[2]), effectiveFrom, effectiveTo, effectiveInterval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql3Q = useMemo(() => isTabLoaded && dqlMetrics[3] ? withSeed(buildDqlHeatQuery(dqlMetrics[3], effectiveFrom, effectiveTo, effectiveInterval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[3]), effectiveFrom, effectiveTo, effectiveInterval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql4Q = useMemo(() => isTabLoaded && dqlMetrics[4] ? withSeed(buildDqlHeatQuery(dqlMetrics[4], effectiveFrom, effectiveTo, effectiveInterval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[4]), effectiveFrom, effectiveTo, effectiveInterval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql5Q = useMemo(() => isTabLoaded && dqlMetrics[5] ? withSeed(buildDqlHeatQuery(dqlMetrics[5], effectiveFrom, effectiveTo, effectiveInterval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[5]), effectiveFrom, effectiveTo, effectiveInterval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql6Q = useMemo(() => isTabLoaded && dqlMetrics[6] ? withSeed(buildDqlHeatQuery(dqlMetrics[6], effectiveFrom, effectiveTo, effectiveInterval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[6]), effectiveFrom, effectiveTo, effectiveInterval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql7Q = useMemo(() => isTabLoaded && dqlMetrics[7] ? withSeed(buildDqlHeatQuery(dqlMetrics[7], effectiveFrom, effectiveTo, effectiveInterval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[7]), effectiveFrom, effectiveTo, effectiveInterval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql8Q = useMemo(() => isTabLoaded && dqlMetrics[8] ? withSeed(buildDqlHeatQuery(dqlMetrics[8], effectiveFrom, effectiveTo, effectiveInterval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[8]), effectiveFrom, effectiveTo, effectiveInterval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dql9Q = useMemo(() => isTabLoaded && dqlMetrics[9] ? withSeed(buildDqlHeatQuery(dqlMetrics[9], effectiveFrom, effectiveTo, effectiveInterval), refreshSeed) : withSeed(NOOP_QUERY, refreshSeed), [isTabLoaded, JSON.stringify(dqlMetrics[9]), effectiveFrom, effectiveTo, effectiveInterval, refreshSeed]); // eslint-disable-line react-hooks/exhaustive-deps
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
    setZoom(null);
    setVisitedTabs((prev) => new Set([...prev, newTab]));
  };

  // ─── Query strings: only run real queries for visited tabs ──────────────
  const seed = refreshSeed;
  const svcQ     = isTabLoaded ? withSeed(serviceHealthQuery(effectiveFrom, effectiveTo, effectiveInterval), seed) : NOOP_QUERY;
  const svcPrevQ = isTabLoaded ? withSeed(serviceHealthQuery(tf.prevFrom, tf.prevTo, effectiveInterval), seed) : NOOP_QUERY;
  const logQ     = isTabLoaded ? withSeed(logErrorsQuery(effectiveFrom, effectiveTo), seed) : NOOP_QUERY;
  const logPrevQ = isTabLoaded ? withSeed(logErrorsQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const hostQ    = isTabLoaded ? withSeed(hostHealthQuery(effectiveFrom, effectiveTo), seed) : NOOP_QUERY;
  const hostPrevQ= isTabLoaded ? withSeed(hostHealthQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const k8sQ     = isTabLoaded ? withSeed(k8sQuery(effectiveFrom, effectiveTo), seed) : NOOP_QUERY;
  const k8sPrevQ = isTabLoaded ? withSeed(k8sQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const secQ     = isTabLoaded ? withSeed(securityQuery(effectiveFrom, effectiveTo), seed) : NOOP_QUERY;
  const secPrevQ = isTabLoaded ? withSeed(securityQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const atkQ     = isTabLoaded ? withSeed(attacksQuery(effectiveFrom, effectiveTo), seed) : NOOP_QUERY;
  const atkPrevQ = isTabLoaded ? withSeed(attacksQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const dbQ      = isTabLoaded ? withSeed(databaseQuery(effectiveFrom, effectiveTo, effectiveInterval), seed) : NOOP_QUERY;
  const dbPrevQ  = isTabLoaded ? withSeed(databaseQuery(tf.prevFrom, tf.prevTo, effectiveInterval), seed) : NOOP_QUERY;
  const netErrQ  = isTabLoaded ? withSeed(networkErrorsQuery(effectiveFrom, effectiveTo), seed) : NOOP_QUERY;
  const netErrPQ = isTabLoaded ? withSeed(networkErrorsQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const netConQ  = isTabLoaded ? withSeed(networkQuery(effectiveFrom, effectiveTo), seed) : NOOP_QUERY;
  const netConPQ = isTabLoaded ? withSeed(networkQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const dxQ      = isTabLoaded ? withSeed(digitalExpQuery(effectiveFrom, effectiveTo), seed) : NOOP_QUERY;
  const dxPrevQ  = isTabLoaded ? withSeed(digitalExpQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const synthQ   = isTabLoaded ? withSeed(syntheticQuery(effectiveFrom, effectiveTo), seed) : NOOP_QUERY;
  const synthPQ  = isTabLoaded ? withSeed(syntheticQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const deplQ    = isTabLoaded ? withSeed(deploymentQuery(effectiveFrom, effectiveTo), seed) : NOOP_QUERY;
  const deplPQ   = isTabLoaded ? withSeed(deploymentQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const wfQ      = isTabLoaded ? withSeed(workflowQuery(effectiveFrom, effectiveTo), seed) : NOOP_QUERY;
  const wfPQ     = isTabLoaded ? withSeed(workflowQuery(tf.prevFrom, tf.prevTo), seed) : NOOP_QUERY;
  const dxTlQ    = isTabLoaded ? withSeed(digitalTimelapseQuery(effectiveFrom, effectiveTo, effectiveInterval), seed) : NOOP_QUERY;
  const dxTlPQ   = isTabLoaded ? withSeed(digitalTimelapseQuery(tf.prevFrom, tf.prevTo, effectiveInterval), seed) : NOOP_QUERY;
  const ptlQ     = isTabLoaded ? withSeed(platformTimelineQuery(effectiveFrom, effectiveTo, effectiveInterval), seed) : NOOP_QUERY;
  const ptlPQ    = isTabLoaded ? withSeed(platformTimelineQuery(tf.prevFrom, tf.prevTo, effectiveInterval), seed) : NOOP_QUERY;
  const secTlQ   = isTabLoaded ? withSeed(securityTimelapseQuery(effectiveFrom, effectiveTo, effectiveInterval), seed) : NOOP_QUERY;
  const deplTlQ  = isTabLoaded ? withSeed(deploymentTimelineQuery(effectiveFrom, effectiveTo, effectiveInterval), seed) : NOOP_QUERY;
  const davisQ   = isTabLoaded ? withSeed(davisProblemsQuery(effectiveFrom, effectiveTo), seed) : NOOP_QUERY;
  const davisTlQ = isTabLoaded ? withSeed(davisProblemsRawQuery(effectiveFrom, effectiveTo, effectiveInterval), seed) : NOOP_QUERY;

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
  const davisTlR  = useDql({ query: davisTlQ });

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
  // Count of problems opened per bucket — aligned to the heat strip bars by makeTimeseries
  const davisProblemCounts: number[] | null = useMemo(() => parseDavisProblemsTimeseries(recs(davisTlR)), [davisTlR.data]);

  const isLoading = isTabLoaded && [svcR, logR, hostR, k8sR, secR, atkR, dbR, netErrR, netConR, dxR, synthR, deplR, wfR, dxTlR, ptlR, secTlR, deplTlR, davisR, davisTlR, customHeatR, dql0R, dql1R, dql2R, dql3R, dql4R, dql5R, dql6R, dql7R, dql8R, dql9R].some((r) => r.isLoading);

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
      return computeAssessment(curResults, prevResults, persona, personaThresholds ?? {}, tf, customMetrics.length > 0 ? customMetrics : undefined, heatMetrics);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [curResults, prevResults, persona, personaThresholds, tf, customHeatR.data, dql0R.data, dql1R.data, dql2R.data, dql3R.data, dql4R.data, dql5R.data, dql6R.data, dql7R.data, dql8R.data, dql9R.data, dqlMetrics, heatMetrics]
  );

  // ─── Sparkline enrichment — attach per-metric timeline to each item ────
  const assessmentWithSparklines = useMemo(() => {
    const sparklineFor = (title: string): number[] => {
      const t = title.toLowerCase();
      if (t.includes("response") || t.includes("latency")) return curResults.serviceHealth?.rtTimeline ?? [];
      if (t.includes("cpu")) return curResults.hostHealth?.cpuTimeline ?? [];
      if (t.includes("lcp") || t.includes("experience")) return curResults.digitalTimelapse?.lcpTimeline ?? curResults.digitalExp?.lcpTimeline ?? [];
      if (t.includes("database") || t.includes("query")) return curResults.database?.rtTimeline ?? [];
      if (t.includes("log")) return curResults.logErrors?.logTimeline ?? [];
      if (t.includes("error")) return curResults.serviceHealth?.errorTimeline?.length ? curResults.serviceHealth.errorTimeline : curResults.digitalTimelapse?.errorRateTimeline ?? [];
      if (t.includes("duration")) return curResults.digitalTimelapse?.durationTimeline ?? [];
      if (t.includes("ttfb")) return curResults.digitalTimelapse?.ttfbTimeline ?? [];
      if (t.includes("attack") || t.includes("security")) return curResults.securityTimelapse?.attackTimeline ?? [];
      return [];
    };
    const enrich = (items: import("../types").AssessmentItem[]) =>
      items.map((item) => {
        const sl = sparklineFor(item.title);
        return sl.length >= 2 ? { ...item, sparkline: sl } : item;
      });
    return { ...assessment, redItems: enrich(assessment.redItems), yellowItems: enrich(assessment.yellowItems), greenItems: enrich(assessment.greenItems) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment, curResults]);

  // ─── Cross-persona health signals ──────────────────────────────────────
  const personaHealthMap = useMemo((): Record<string, "red" | "yellow" | "green"> => {
    const map: Record<string, "red" | "yellow" | "green"> = {};
    const standardIds = new Set(PERSONAS.map((p) => p.id));
    const all = [...PERSONAS, ...(settings.customPersonas ?? [])];

    // Propagate signals from active assessment's hot buckets to related standard personas
    const crossSignals: Record<string, "red" | "yellow"> = {};
    const METRIC_PERSONA: [RegExp, string[]][] = [
      [/^dt\.service\.|^dt\.database_service\./, ["developer", "sre", "devops"]],
      [/^dt\.database\.|^dt\.db\./, ["dba"]],
      [/^dt\.host\.|^dt\.process\.(?!network)/, ["platform", "k8s"]],
      [/^dt\.process\.network\.|^dt\.network\./, ["network"]],
      [/^dt\.rum\.|^dt\.frontend\./, ["digital"]],
      [/^dt\.kubernetes\.|^dt\.k8s\./, ["k8s", "platform"]],
    ];
    for (const bd of assessment.bucketDetails) {
      if (bd.level === "normal" || bd.level === "elevated") continue;
      const sev: "red" | "yellow" = bd.level === "spike" ? "red" : "yellow";
      for (const m of bd.metrics) {
        if (!m.metricKey) continue;
        for (const [pat, pids] of METRIC_PERSONA) {
          if (pat.test(m.metricKey)) {
            for (const pid of pids) {
              if (!crossSignals[pid] || (crossSignals[pid] === "yellow" && sev === "red")) crossSignals[pid] = sev;
            }
          }
        }
      }
    }

    for (const p of all) {
      try {
        if (p.id === persona) { map[p.id] = assessment.overallHealth; continue; }
        if (!standardIds.has(p.id)) { map[p.id] = "green"; continue; }
        const a = computeAssessment(curResults, prevResults, p.id, settings.personas[p.id]?.thresholds ?? {}, tf);
        const cross = crossSignals[p.id];
        const std = a.overallHealth;
        if (!cross || std === "red") { map[p.id] = std; }
        else if (cross === "red") { map[p.id] = "red"; }
        else if (std === "green") { map[p.id] = "yellow"; }
        else { map[p.id] = std; }
      } catch { /* skip */ }
    }

    // Adjacency: when active persona is non-green, nudge related personas to at least yellow
    if (assessment.overallHealth !== "green") {
      const ADJACENT: Record<string, string[]> = {
        developer: ["sre", "devops"],
        sre:       ["developer", "devops"],
        platform:  ["k8s"],
        k8s:       ["platform"],
        dba:       ["developer", "sre"],
        network:   ["platform"],
        digital:   ["developer", "sre"],
        devops:    ["developer", "sre"],
      };
      for (const pid of ADJACENT[persona] ?? []) {
        if (map[pid] === "green") map[pid] = "yellow";
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curResults, prevResults, tf, settings, persona, assessment.overallHealth, assessment.bucketDetails]);

  // ─── Health score history ───────────────────────────────────────────────
  const healthHistory: HealthHistory = useMemo(() => {
    try { return JSON.parse(healthHistoryState.data?.value as string ?? "{}"); } catch { return {}; }
  }, [healthHistoryState.data?.value]); // eslint-disable-line react-hooks/exhaustive-deps

  const personaHealthReadings: HealthReading[] = useMemo(
    () => (healthHistory[persona] ?? []).slice(-14),
    [healthHistory, persona]
  );

  useEffect(() => {
    if (!assessment.dataAvailable) return;
    const now = Date.now();
    const prev = healthHistory[persona] ?? [];
    // Only record once per 15 min to avoid spam on auto-refresh
    if (prev.length > 0 && now - prev[prev.length - 1].ts < 15 * 60 * 1000) return;
    const next: HealthHistory = { ...healthHistory, [persona]: [...prev, { score: assessment.healthScore, ts: now }].slice(-14) };
    saveHealthRaw({ key: HEALTH_HISTORY_KEY, body: { value: JSON.stringify(next) } });
  }, [assessment.dataAvailable, assessment.healthScore, persona]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleUpdateThreshold = useCallback((label: string, warn: number | undefined, crit: number | undefined) => {
    const updated = heatMetrics.map((m) =>
      m.label === label ? { ...m, warningThreshold: warn, criticalThreshold: crit } : m
    );
    const nextSettings: SavedSettings = {
      ...settings,
      personas: {
        ...settings.personas,
        [persona]: {
          ...(settings.personas[persona] ?? { appLinks: [], thresholds: {} }),
          heatMetrics: updated,
        },
      },
    };
    handleSaveSettings(nextSettings);
  }, [heatMetrics, settings, persona, handleSaveSettings]);

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

  // ─── Hotness historical query (for Forecast panel "Analyze" slider) ────
  const getHotnessHistory = useCallback(async (days: number): Promise<number[]> => {
    if (heatMetrics.length === 0) return assessment.heatScores;
    const from = `now()-${days}d`;
    const to = "now()";
    const q = buildCustomHeatQuery(heatMetrics, from, to, "1h");
    try {
      const res = await queryExecutionClient.queryExecute({ body: { query: q, requestTimeoutMilliseconds: 60000 } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = (res.result as any)?.records ?? [];
      const metrics = parseCustomHeat(records, heatMetrics);
      const timelines = metrics.filter((m) => m.timeline.length > 1).map((m) => m.timeline);
      if (timelines.length === 0) return assessment.heatScores;
      return computeHeat(timelines);
    } catch {
      return assessment.heatScores;
    }
  }, [heatMetrics, assessment.heatScores]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const allItems = [...assessmentWithSparklines.redItems, ...assessmentWithSparklines.yellowItems, ...assessmentWithSparklines.greenItems];

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
        <PersonaChip persona={activePersonaDef} personas={allPersonas} onSelect={setPersona} personaHealth={personaHealthMap} />

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
          <CopyReportButton assessment={assessmentWithSparklines} persona={activePersonaDef.label} tabLabel={TAB_LABELS[tab]} />
          <button
            onClick={() => setAutomateOpen(true)}
            title="Create an automated weekly report workflow for this persona"
            style={{ background: "#4589FF", border: "1px solid rgba(69,137,255,0.8)", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 700, padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, lineHeight: 1 }}
          >
            <AutomateIcon />
            Automate
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

      {/* ── Zoom banner ── */}
      {zoom && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 16px", background: "rgba(69,137,255,0.1)", borderBottom: "1px solid rgba(69,137,255,0.3)" }}>
          <span style={{ fontSize: 11, color: "#7ab4ff", fontWeight: 700 }}>🔍 Zoomed:</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "monospace" }}>{zoom.label}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>({effectiveInterval} buckets)</span>
          <button
            onClick={() => setZoom(null)}
            style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 5, cursor: "pointer", background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.4)", color: "#7ab4ff" }}
          >
            ✕ Exit zoom
          </button>
        </div>
      )}

      {/* ── Content ── */}
      <div className="iq-content">
        <div className="iq-main">
          <AssessmentPanel assessment={assessmentWithSparklines} isLoading={isLoading} onForecast={handleForecast} persona={persona} heatMetrics={heatMetrics} deploymentBuckets={deploymentBuckets} davisProblemCounts={davisProblemCounts} davisProblems={davisProblems} onUpdateThreshold={handleUpdateThreshold} healthReadings={personaHealthReadings} getHotnessHistory={getHotnessHistory} bucketMs={(() => { const m = effectiveInterval.match(/^(\d+)([mh])$/); return m ? parseInt(m[1]) * (m[2] === "h" ? 3600000 : 60000) : 60000; })()} from={effectiveFrom} to={effectiveTo} onZoomRange={handleZoomRange} />
        </div>
        <div className="iq-sidebar">
          <AppLinksPanel personaId={persona} savedLinks={personaLinks} assessmentItems={allItems} />
        </div>
      </div>

      {/* ── Modals ── */}
      {automateOpen && (
        <AutomateModal
          persona={activePersonaDef}
          heatMetrics={heatMetrics}
          onClose={() => setAutomateOpen(false)}
        />
      )}
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

// ─── Automate button icon (3×3 grid of dots) ─────────────────────────────────

function AutomateIcon() {
  return (
    <span style={{ display: "inline-grid", gridTemplateColumns: "repeat(3, 3px)", gap: "1.5px", verticalAlign: "middle", lineHeight: 0 }}>
      {Array(9).fill(null).map((_, i) => (
        <span key={i} style={{ width: 3, height: 3, background: "rgba(255,255,255,0.9)", borderRadius: 0.5, display: "block" }} />
      ))}
    </span>
  );
}

// ─── Copy Report button ──────────────────────────────────────────────────────

function CopyReportButton({ assessment, persona, tabLabel }: { assessment: import("../types").Assessment; persona: string; tabLabel: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const statusEmoji = assessment.overallHealth === "red" ? "🔴" : assessment.overallHealth === "yellow" ? "🟡" : "🟢";
    const statusLabel = assessment.overallHealth === "red" ? "Critical" : assessment.overallHealth === "yellow" ? "Warning" : "Healthy";

    const lines: string[] = [
      `*NavigatorIQ — ${persona} — ${tabLabel}*`,
      `${statusEmoji} *${statusLabel}* · ${assessment.redItems.length} Critical · ${assessment.yellowItems.length} Warning · ${assessment.greenItems.length} Healthy`,
      "",
    ];

    if (assessment.narrative) {
      lines.push(`_${assessment.narrative}_`, "");
    }

    if (assessment.redItems.length > 0) {
      lines.push(`*🔴 Needs Immediate Attention (${assessment.redItems.length})*`);
      for (const item of assessment.redItems) {
        const val = item.metricValue !== undefined ? ` — ${item.metricValue.toFixed(1)}${item.metricUnit ?? ""}` : "";
        lines.push(`• ${item.title}${val}`);
      }
      lines.push("");
    }

    if (assessment.yellowItems.length > 0) {
      lines.push(`*🟡 Potential Issues (${assessment.yellowItems.length})*`);
      for (const item of assessment.yellowItems) {
        const val = item.metricValue !== undefined ? ` — ${item.metricValue.toFixed(1)}${item.metricUnit ?? ""}` : "";
        lines.push(`• ${item.title}${val}`);
      }
      lines.push("");
    }

    lines.push(`_Generated ${ts} via NavigatorIQ_`);

    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy assessment report to clipboard (Slack-ready)"
      style={{
        background: copied ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${copied ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.15)"}`,
        borderRadius: 6,
        color: copied ? "#34D399" : "rgba(255,255,255,0.6)",
        fontSize: 12, fontWeight: 600, padding: "5px 10px", cursor: "pointer",
        transition: "all 0.2s", whiteSpace: "nowrap" as const,
      }}
    >
      {copied ? "✓ Copied!" : "📋 Share"}
    </button>
  );
}

// ─── Persona chip with inline dropdown ──────────────────────────────────────

interface PersonaChipProps {
  persona: { id: PersonaId; icon: string; label: string };
  personas: { id: PersonaId; icon: string; label: string; description: string }[];
  onSelect: (id: PersonaId) => void;
  personaHealth?: Record<string, "red" | "yellow" | "green">;
}

function PersonaChip({ persona, personas, onSelect, personaHealth }: PersonaChipProps) {
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

  const otherIssue = Object.entries(personaHealth ?? {}).some(([id, h]) => id !== persona.id && (h === "red" || h === "yellow"));
  const otherIssueColor = Object.entries(personaHealth ?? {}).some(([id, h]) => id !== persona.id && h === "red") ? "#EF4444" : "#F59E0B";
  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(69,137,255,0.12)", border: "1px solid rgba(69,137,255,0.3)", borderRadius: 20, padding: "4px 12px", color: "#7ab4ff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
      >
        <span>{persona.icon}</span>
        <span>{persona.label}</span>
        {otherIssue && <div style={{ width: 6, height: 6, borderRadius: "50%", background: otherIssueColor, boxShadow: `0 0 5px ${otherIssueColor}`, flexShrink: 0 }} title="Another persona has issues" />}
        <span style={{ fontSize: 10, opacity: 0.7 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, background: "#0f1422", border: "1px solid rgba(69,137,255,0.25)", borderRadius: 10, padding: 8, zIndex: 1000, minWidth: 220, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          {personas.map((p) => {
            const health = personaHealth?.[p.id];
            const dotCol = health === "red" ? "#EF4444" : health === "yellow" ? "#F59E0B" : null;
            return (
              <button
                key={p.id}
                onClick={() => { onSelect(p.id); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", borderRadius: 6, background: p.id === persona.id ? "rgba(69,137,255,0.15)" : "transparent", color: p.id === persona.id ? "#7ab4ff" : "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: p.id === persona.id ? 700 : 400, cursor: "pointer", textAlign: "left" as const }}
              >
                <span style={{ fontSize: 16 }}>{p.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: p.id === persona.id ? 700 : 600 }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{p.description}</div>
                </div>
                {dotCol && (
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: dotCol, boxShadow: `0 0 5px ${dotCol}`, flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
