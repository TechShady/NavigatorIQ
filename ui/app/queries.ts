import type {
  ServiceHealthResult,
  LogErrorsResult,
  HostHealthResult,
  K8sResult,
  SecurityResult,
  DatabaseResult,
  NetworkResult,
  DigitalExpResult,
  DeploymentResult,
  DigitalTimelapseResult,
  PlatformTimelineResult,
  SecurityTimelapseResult,
  HeatMetricConfig,
  MetricDisplayUnit,
} from "./types";

// ─── DQL Query Builders ────────────────────────────────────────────────────

export function serviceHealthQuery(from: string, to: string, interval = "auto"): string {
  return `timeseries
  err=sum(dt.service.request.failure_count),
  total=sum(dt.service.request.count),
  rt=avg(dt.service.request.response_time),
  interval:${interval}, from:${from}, to:${to}
| fieldsAdd
  totalErrors=arraySum(err),
  totalRequests=arraySum(total),
  avgRtMs=arrayAvg(rt)/1000000,
  errorRatePct=if(totalRequests>0, toDouble(totalErrors)/toDouble(totalRequests)*100, else:0.0)`;
}

export function logErrorsQuery(from: string, to: string): string {
  return `fetch logs, from:${from}, to:${to}
| filter status == "ERROR" or status == "FATAL"
| summarize totalLogErrors=count()`;
}

export function hostHealthQuery(from: string, to: string): string {
  return `timeseries
  cpu=avg(dt.host.cpu.usage),
  mem=avg(dt.host.memory.usage),
  interval:auto, from:${from}, to:${to}, by:{dt.entity.host}
| fieldsAdd avgCpu=arrayAvg(cpu), avgMem=arrayAvg(mem)
| summarize
  avgCpuPct=avg(avgCpu),
  avgMemPct=avg(avgMem),
  highCpuHosts=countIf(avgCpu>80),
  highMemHosts=countIf(avgMem>85),
  totalHosts=count(),
  cpuTimeline=collectArray(avgCpu)`;
}

export function k8sQuery(from: string, to: string): string {
  return `fetch events, from:${from}, to:${to}
| filter event.type == "KUBERNETES_POD_RESTART_RATE_HIGH" or event.type == "KUBERNETES_CONTAINER_OOM_KILL" or event.type == "KUBERNETES_NODE_UNSCHEDULABLE" or (isNotNull(dt.entity.cloud_application_namespace) and (matchesPhrase(event.title, "restart") or matchesPhrase(event.title, "CrashLoop")))
| summarize
  totalPodRestarts=countIf(event.type == "KUBERNETES_POD_RESTART_RATE_HIGH" or event.type == "KUBERNETES_CONTAINER_OOM_KILL" or matchesPhrase(event.title, "restart") or matchesPhrase(event.title, "CrashLoop")),
  totalNotReadyPods=countIf(event.type == "KUBERNETES_NODE_UNSCHEDULABLE")`;
}

export function securityQuery(_from: string, _to: string): string {
  return `fetch events, from:now()-90d, to:now()
| filter event.type == "VULNERABILITY_STATE_REPORT_EVENT" and vulnerabilityStatus == "OPEN"
| summarize
  criticalVulns=countIf(vulnerabilityRiskLevel=="CRITICAL"),
  highVulns=countIf(vulnerabilityRiskLevel=="HIGH"),
  mediumVulns=countIf(vulnerabilityRiskLevel=="MEDIUM"),
  totalVulns=count()`;
}

export function attacksQuery(from: string, to: string): string {
  return `fetch events, from:${from}, to:${to}
| filter event.type == "ATTACK_CANDIDATE_EVENT" or event.type == "SECURITY_ATTACK_DETECTION_EVENT"
| summarize
  totalAttacks=count(),
  exploitedAttacks=countIf(attack.state=="EXPLOITING" or attack.state=="EXPLOITED")`;
}

export function databaseQuery(from: string, to: string, interval = "auto"): string {
  return `timeseries
  rt=avg(dt.service.request.response_time),
  err=sum(dt.service.request.failure_count),
  total=sum(dt.service.request.count),
  interval:${interval}, from:${from}, to:${to}
| fieldsAdd
  avgRtMs=arrayAvg(rt)/1000000,
  totalErrors=arraySum(err),
  totalRequests=arraySum(total)
| fieldsAdd slowQueries=if(avgRtMs>500, totalRequests, else:0)`;
}

export function networkQuery(from: string, to: string): string {
  return `fetch events, from:${from}, to:${to}
| filter event.type == "CUSTOM_INFO" and (event.category == "CONNECTIVITY" or matchesPhrase(event.title, "network") or matchesPhrase(event.title, "connect"))
| summarize connectivityEvents=count()`;
}

export function networkErrorsQuery(from: string, to: string): string {
  return `timeseries
  retx=sum(dt.process.network.packets.re_tx),
  interval:auto, from:${from}, to:${to}
| summarize totalNetErrors=sum(arraySum(retx))`;
}

export function digitalExpQuery(from: string, to: string): string {
  return `fetch user.events, from:${from}, to:${to}
| filter dt.rum.user_type != "robot"
| summarize
  totalSessions=countDistinct(dt.rum.session.id),
  totalEvents=count(),
  totalErrors=countIf(characteristics.has_error == true),
  avgLcpMs=avg(web_vitals.largest_contentful_paint)/1000000.0,
  avgTtfbMs=avg(web_vitals.time_to_first_byte)/1000000.0,
  avgFcpMs=avg(web_vitals.first_contentful_paint)/1000000.0,
  avgDurationMs=avg(duration)/1000000.0
| fieldsAdd sessionErrorRatePct=if(totalEvents>0, toDouble(totalErrors)/toDouble(totalEvents)*100, else:0)`;
}

export function syntheticQuery(from: string, to: string): string {
  return `fetch events, from:${from}, to:${to}
| filter event.type == "SYNTHETIC_NODE_OUTAGE" or event.type == "SYNTHETIC_TEST_EXECUTION_FAILED"
| summarize syntheticFailures=count()`;
}

export function deploymentQuery(from: string, to: string): string {
  return `fetch events, from:${from}, to:${to}
| filter event.type == "DEPLOYMENT_EVENT" or event.type == "APPLICATION_DEPLOYMENT" or event.type == "CUSTOM_DEPLOYMENT"
| summarize totalDeployments=count()`;
}

// Per-bucket RUM timelapse — drives Digital Experience heat strip
// Query is verbatim from user-confirmed working Frontend Overview / User Journey app queries.
// Only addition: from:/to: on the fetch line. Field names, spacing, and overwrite pattern preserved.
export function digitalTimelapseQuery(from: string, to: string, _interval = "auto"): string {
  return `fetch user.events, from:${from}, to:${to}, scanLimitGBytes: 500
| filterOut dt.rum.user_type == "synthetic" OR isNull(dt.rum.user_type)
| filter characteristics.has_page_summary or characteristics.has_w3c_navigation_timings
| fieldsAdd web_vitals.largest_contentful_paint = web_vitals.largest_contentful_paint / 1000000
| makeTimeseries { timeseries = percentile(web_vitals.largest_contentful_paint, 75), value = percentile(web_vitals.largest_contentful_paint, 75, scalar: true) }`;
}

// Per-bucket host CPU/mem timelapse (no by: → truly temporal) — drives Platform heat strip
export function platformTimelineQuery(from: string, to: string, interval = "auto"): string {
  return `timeseries
  cpu=avg(dt.host.cpu.usage),
  mem=avg(dt.host.memory.usage),
  interval:${interval}, from:${from}, to:${to}`;
}

export function workflowQuery(from: string, to: string): string {
  return `fetch events, from:${from}, to:${to}
| filter event.type == "WORKFLOW_EXECUTION_FAILED" or (event.type == "CUSTOM_INFO" and matchesPhrase(event.title, "workflow") and matchesPhrase(event.title, "fail"))
| summarize workflowFailures=count()`;
}

// ─── Result Parsers ────────────────────────────────────────────────────────

type DqlRecord = Record<string, unknown>;

function num(record: DqlRecord, key: string, def = 0): number {
  const v = record[key];
  if (v == null) return def;
  const n = Number(v);
  return isFinite(n) ? n : def;
}

function arr(record: DqlRecord, key: string): number[] {
  const v = record[key];
  if (!Array.isArray(v)) return [];
  return (v as unknown[]).map((x) => (x == null ? 0 : Number(x))).filter(isFinite);
}

export function parseServiceHealth(records: DqlRecord[] | undefined): ServiceHealthResult | null {
  const r = records?.[0];
  if (!r) return null;
  return {
    totalErrors: num(r, "totalErrors"),
    totalRequests: num(r, "totalRequests"),
    avgRtMs: num(r, "avgRtMs"),
    errorRatePct: num(r, "errorRatePct"),
    rtTimeline: arr(r, "rt").map((v) => v / 1000000),
    errorTimeline: arr(r, "err"),
    requestTimeline: arr(r, "total"),
  };
}

export function parseLogErrors(records: DqlRecord[] | undefined): LogErrorsResult | null {
  const r = records?.[0];
  if (!r) return null;
  return { totalLogErrors: num(r, "totalLogErrors") };
}

export function parseHostHealth(records: DqlRecord[] | undefined): HostHealthResult | null {
  const r = records?.[0];
  if (!r) return null;
  return {
    avgCpuPct: num(r, "avgCpuPct"),
    avgMemPct: num(r, "avgMemPct"),
    highCpuHosts: num(r, "highCpuHosts"),
    highMemHosts: num(r, "highMemHosts"),
    totalHosts: num(r, "totalHosts"),
    cpuTimeline: arr(r, "cpuTimeline"),
  };
}

export function parseK8s(records: DqlRecord[] | undefined): K8sResult | null {
  const r = records?.[0];
  if (!r) return null;
  return {
    totalPodRestarts: num(r, "totalPodRestarts"),
    totalNotReadyPods: num(r, "totalNotReadyPods"),
  };
}

export function parseSecurity(secRecords: DqlRecord[] | undefined, attackRecords: DqlRecord[] | undefined): SecurityResult | null {
  const s = secRecords?.[0] ?? {};
  const a = attackRecords?.[0] ?? {};
  if (!secRecords?.[0] && !attackRecords?.[0]) return null;
  return {
    criticalVulns: num(s, "criticalVulns"),
    highVulns: num(s, "highVulns"),
    mediumVulns: num(s, "mediumVulns"),
    totalAttacks: num(a, "totalAttacks"),
    exploitedAttacks: num(a, "exploitedAttacks"),
  };
}

export function parseDatabase(records: DqlRecord[] | undefined): DatabaseResult | null {
  const r = records?.[0];
  if (!r) return null;
  return {
    avgRtMs: num(r, "avgRtMs"),
    totalErrors: num(r, "totalErrors"),
    slowQueries: num(r, "slowQueries"),
    rtTimeline: arr(r, "rt").map((v) => v / 1000000),
  };
}

export function parseNetwork(errRecords: DqlRecord[] | undefined, connRecords: DqlRecord[] | undefined): NetworkResult | null {
  const e = errRecords?.[0] ?? {};
  const c = connRecords?.[0] ?? {};
  if (!errRecords?.[0] && !connRecords?.[0]) return null;
  return {
    totalNetErrors: num(e, "totalNetErrors"),
    connectivityEvents: num(c, "connectivityEvents"),
  };
}

export function parseDigitalExp(dxRecords: DqlRecord[] | undefined, synthRecords: DqlRecord[] | undefined): DigitalExpResult | null {
  const d = dxRecords?.[0] ?? {};
  const s = synthRecords?.[0] ?? {};
  if (!dxRecords?.[0] && !synthRecords?.[0]) return null;
  return {
    sessionErrorRatePct: num(d, "sessionErrorRatePct"),
    totalSessions: num(d, "totalSessions"),
    totalErrors: num(d, "totalErrors"),
    avgLcpMs: num(d, "avgLcpMs"),
    avgTtfbMs: num(d, "avgTtfbMs"),
    avgFcpMs: num(d, "avgFcpMs"),
    avgDurationMs: num(d, "avgDurationMs"),
    avgApdex: num(d, "avgApdex"),
    syntheticFailures: num(s, "syntheticFailures"),
    lcpTimeline: arr(d, "lcpTimeline"),
  };
}

export function parseDigitalTimelapse(records: DqlRecord[] | undefined): DigitalTimelapseResult | null {
  const r = records?.[0];
  if (!r) return null;
  // Field name "timeseries" matches the makeTimeseries output field in the proven query pattern
  const lcpTimeline = arr(r, "timeseries");
  const eventCountTl = arr(r, "eventCount");
  if (lcpTimeline.length < 2) return null;
  return {
    errorRateTimeline: [],
    durationTimeline: [],
    lcpTimeline,
    ttfbTimeline: [],
    eventsTimeline: eventCountTl,
  };
}

export function parsePlatformTimeline(records: DqlRecord[] | undefined): PlatformTimelineResult | null {
  const r = records?.[0];
  if (!r) return null;
  const cpuTimeline = arr(r, "cpu");
  const memTimeline = arr(r, "mem");
  if (cpuTimeline.length === 0) return null;
  return { cpuTimeline, memTimeline };
}

export function parseDeployments(deployRecords: DqlRecord[] | undefined, workflowRecords: DqlRecord[] | undefined): DeploymentResult | null {
  const d = deployRecords?.[0] ?? {};
  const w = workflowRecords?.[0] ?? {};
  if (!deployRecords?.[0] && !workflowRecords?.[0]) return null;
  return {
    totalDeployments: num(d, "totalDeployments"),
    workflowFailures: num(w, "workflowFailures"),
    releaseEvents: num(d, "totalDeployments"),
  };
}

// ─── Security timelapse (attack events per bucket) ─────────────────────────

// makeTimeseries always produces a full timeline for the time range (zero-filled when no attacks),
// so the heat strip correctly shows flat/normal when quiet and spikes during actual attack bursts
export function securityTimelapseQuery(from: string, to: string, _interval = "auto"): string {
  return `fetch events, from:${from}, to:${to}
| filter event.type == "ATTACK_CANDIDATE_EVENT" or event.type == "SECURITY_ATTACK_DETECTION_EVENT"
| fieldsAdd _c = 1.0
| makeTimeseries { timeseries = sum(_c) }`;
}

export function parseSecurityTimelapse(records: DqlRecord[] | undefined): SecurityTimelapseResult | null {
  const r = records?.[0];
  if (!r) return null;
  const attackTimeline = arr(r, "timeseries");
  if (attackTimeline.length < 2) return null;
  return { attackTimeline };
}

// ─── Custom Heat Metrics Query ─────────────────────────────────────────────

export function buildCustomHeatQuery(metrics: HeatMetricConfig[], from: string, to: string, interval: string): string {
  const standard = metrics.filter((m) => m.type !== "dql" && !m.dqlQuery?.trim());
  if (standard.length === 0) return "fetch logs | limit 0";
  const fields = standard.flatMap((m, i) => {
    if (m.type === "ratio" && m.denominatorKey) {
      return [`  m${i}_n=${m.aggregation}(${m.metricKey})`, `  m${i}_d=${m.aggregation}(${m.denominatorKey})`];
    }
    return [`  m${i}=${m.aggregation}(${m.metricKey})`];
  }).join(",\n");
  return `timeseries\n${fields},\n  interval:${interval}, from:${from}, to:${to}`;
}

export function buildDqlHeatQuery(metric: HeatMetricConfig, from: string, to: string, interval: string): string {
  if (!metric.dqlQuery?.trim()) return "fetch logs | limit 0";
  // 1. Substitute any placeholders the user included
  let query = metric.dqlQuery
    .replace(/\$\{from\}/g, from)
    .replace(/\$\{to\}/g, to)
    .replace(/\$\{interval\}/g, interval);
  // 2. On every fetch line, inject from/to if not already present
  query = query.split("\n").map((line) => {
    if (!/^\s*fetch\s/.test(line)) return line;
    let result = line.trimEnd();
    if (!result.includes("from:")) result += `, from:${from}`;
    if (!result.includes("to:")) result += `, to:${to}`;
    return result;
  }).join("\n");
  return query;
}

export function parseDqlHeatResult(records: DqlRecord[] | undefined, metric: HeatMetricConfig): ParsedCustomMetric | null {
  if (!records || records.length === 0) return null;
  let timeline: number[];
  if (records.length === 1 && Array.isArray(records[0]["value"])) {
    timeline = arr(records[0], "value");
  } else {
    timeline = records.map((r) => { const v = r["value"]; const n = Number(v); return isFinite(n) ? n : 0; });
  }
  if (timeline.length < 2) return null;
  const suffix = metric.displaySuffix?.trim();
  const fmt = suffix
    ? (v: number) => (Number.isInteger(v) ? String(v) : parseFloat(v.toFixed(2)).toString()) + suffix
    : makeMetricFmt(metric.displayUnit);
  return { label: metric.label, timeline, isTraffic: metric.isTraffic, inverted: isInverted(metric), fmt };
}

const fmtMs = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}s`;
  if (v >= 10) return `${Math.round(v)}ms`;
  if (v > 0) return `${v.toFixed(2)}ms`;
  return "0ms";
};

export function makeMetricFmt(unit?: MetricDisplayUnit): (v: number) => string {
  switch (unit) {
    case "ms":      return fmtMs;
    case "ns->ms":
    case "µs->ms":  return fmtMs;
    case "pct":     return (v: number) => `${v.toFixed(2)}%`;
    default:        return (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : Math.round(v).toLocaleString();
  }
}

function parseMetricTimeline(raw: number[], unit?: MetricDisplayUnit): number[] {
  switch (unit) {
    case "ns->ms": return raw.map((v) => v / 1000000);
    case "µs->ms": return raw.map((v) => v / 1000);
    default: return raw;  // "ms", "raw", "pct", "count" — value already in correct scale
  }
}

export interface ParsedCustomMetric { label: string; timeline: number[]; isTraffic?: boolean; inverted?: boolean; fmt: (v: number) => string }

function isInverted(m: HeatMetricConfig): boolean {
  return m.warningThreshold !== undefined && m.criticalThreshold !== undefined && m.warningThreshold > m.criticalThreshold;
}

export function parseCustomHeat(records: DqlRecord[] | undefined, metrics: HeatMetricConfig[]): ParsedCustomMetric[] {
  const r = records?.[0];
  if (!r) return [];
  const standard = metrics.filter((m) => m.type !== "dql" && !m.dqlQuery?.trim());
  return standard
    .map((m, i) => {
      if (m.type === "ratio" && m.denominatorKey) {
        const numRaw = arr(r, `m${i}_n`);
        const denRaw = arr(r, `m${i}_d`);
        const timeline = numRaw.map((num, j) => {
          const den = denRaw[j] ?? 0;
          return den > 0 ? (num / den) * 100 : 0;
        });
        return { label: m.label, timeline, isTraffic: m.isTraffic, inverted: isInverted(m), fmt: makeMetricFmt("pct") };
      }
      return {
        label: m.label,
        timeline: parseMetricTimeline(arr(r, `m${i}`), m.displayUnit),
        isTraffic: m.isTraffic,
        inverted: isInverted(m),
        fmt: makeMetricFmt(m.displayUnit),
      };
    })
    .filter((pm) => pm.timeline.length > 1);
}
